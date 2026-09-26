import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { repository } from '../../src/repository.ts';
import type { Database } from '../../src/db.ts';
import type { Storage } from '../../src/storage.ts';

// Explicit opt-in, like rls.test.ts. Needs migrations 001-003. Every row is removed
// afterwards by rolling back, except through the repository, which commits; those
// rows belong to random test users in a disposable *_test database.
const url = process.env.TEST_DATABASE_URL;
const skip = !url ? 'Set TEST_DATABASE_URL to a prepared disposable *_test database.' : false;

function local(connection: string) {
  const parsed = new URL(connection);
  assert.match(parsed.pathname, /_test$/, 'Only a disposable database ending in _test.');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname));
}

test('meeting times, note edits and quiz attempts stay with their owner', { skip }, async () => {
  local(url!);
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  const a = randomUUID(),
    b = randomUUID(),
    course = `t-${a.slice(0, 8)}`,
    lecture = randomUUID();
  const as = (id: string) => db.query("SELECT set_config('app.user_id',$1,true)", [id]);
  const rejects = async (sql: string, params: unknown[], message: string) => {
    await db.query('SAVEPOINT expected_failure');
    await assert.rejects(db.query(sql, params), Error, message);
    await db.query('ROLLBACK TO SAVEPOINT expected_failure');
  };
  try {
    await db.query('BEGIN');
    for (const user of [a, b]) {
      await as(user);
      await db.query(
        "INSERT INTO chalkwise.profiles(id,name,year,major) VALUES($1,'T','Senior','CS')",
        [user],
      );
    }
    await as(a);
    await db.query("INSERT INTO chalkwise.courses(id,code,name) VALUES($1,$1,'T')", [course]);
    await db.query('INSERT INTO chalkwise.course_memberships(user_id,course_id) VALUES($1,$2)', [
      a,
      course,
    ]);
    await db.query(
      "INSERT INTO chalkwise.lectures(id,owner_id,course_id,title,summary) VALUES($1,$2,$3,'Mine','S')",
      [lecture, a, course],
    );
    const meeting = `INSERT INTO chalkwise.course_meetings(user_id,course_id,weekday,starts_at,ends_at) VALUES($1,$2,2,'09:30','10:50')`;
    await db.query(meeting, [a, course]);
    await db.query(
      "UPDATE chalkwise.lectures SET summary='Fixed', note_sources='{\"keyConcepts\":[1]}', edited_at=now() WHERE id=$1",
      [lecture],
    );
    await db.query(
      'INSERT INTO chalkwise.quiz_attempts(user_id,lecture_id,score,total) VALUES($1,$2,4,5)',
      [a, lecture],
    );

    await as(b);
    await rejects(meeting, [b, course], 'Meeting times need an enrollment in the course');
    assert.equal(
      (await db.query('SELECT 1 FROM chalkwise.course_meetings WHERE course_id=$1', [course]))
        .rowCount,
      0,
      "Another student cannot see someone's class times",
    );
    assert.equal(
      (await db.query("UPDATE chalkwise.lectures SET summary='Hijacked' WHERE id=$1", [lecture]))
        .rowCount,
      0,
      "Another student cannot edit someone's notes",
    );
    await rejects(
      'INSERT INTO chalkwise.quiz_attempts(user_id,lecture_id,score,total) VALUES($1,$2,1,5)',
      [b, lecture],
      'Quiz attempts need a lecture you own',
    );
    assert.equal(
      (await db.query('SELECT 1 FROM chalkwise.quiz_attempts WHERE lecture_id=$1', [lecture]))
        .rowCount,
      0,
    );
    await as(a);
    await rejects(
      'UPDATE chalkwise.quiz_attempts SET score=5 WHERE lecture_id=$1',
      [lecture],
      'Quiz attempts are append-only',
    );
    await rejects(
      'UPDATE chalkwise.lectures SET owner_id=$2 WHERE id=$1',
      [lecture, b],
      'Ownership is not editable',
    );
    await db.query('ROLLBACK');
  } finally {
    await db.query('ROLLBACK').catch(() => {});
    await db.end();
  }
});

test('the repository saves sources, edits, meeting times and attempts', { skip }, async () => {
  local(url!);
  const pool = new pg.Pool({ connectionString: url });
  const database: Database = {
    ping: async () => {},
    close: () => pool.end(),
    async asUser(userId, work) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.user_id',$1,true)", [userId]);
        const result = await work(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
  const repo = repository(database, {} as Storage);
  const user = randomUUID();
  const course = `r-${user.slice(0, 8)}`;
  try {
    await repo.saveProfile(user, { name: 'R', year: 'Senior', major: 'CS' });
    await repo.createCourse(user, { code: course, name: 'Repo', professor: '' });
    await repo.enroll(user, course, true);
    const notes = {
      courseId: course,
      title: 'Trees',
      summary: 'S',
      keyConcepts: ['BST', 'AVL'],
      importantPoints: [],
      assignments: ['HW 4 due Friday'],
      examMentions: [],
      sources: { keyConcepts: [1, 2], assignments: [null] },
    };
    const key = randomUUID();
    const saved = await repo.createLecture(user, key, notes);
    assert.deepEqual(saved.sources, notes.sources);
    // Retrying the same save is still idempotent now that sources are stored as jsonb.
    assert.equal((await repo.createLecture(user, key, notes)).id, saved.id);

    const edited = await repo.editLecture(user, saved.id, {
      ...notes,
      keyConcepts: ['Binary search tree', 'AVL'],
    });
    assert.deepEqual(edited.keyConcepts, ['Binary search tree', 'AVL']);
    assert.ok(edited.editedAt);

    const meetings = await repo.setMeetings(user, course, {
      meetings: [
        { weekday: 2, start: '09:30', end: '10:50' },
        { weekday: 4, start: '09:30', end: '10:50' },
      ],
    });
    assert.deepEqual(meetings, [
      { courseId: course, weekday: 2, start: '09:30', end: '10:50' },
      { courseId: course, weekday: 4, start: '09:30', end: '10:50' },
    ]);
    assert.equal((await repo.setMeetings(user, course, { meetings: [] })).length, 0);

    const missed = [
      { question: 'Q', options: ['a', 'b'], correctAnswer: 'a', explanation: 'Because.' },
    ];
    const attempt = await repo.recordQuizAttempt(user, saved.id, { score: 4, total: 5, missed });
    assert.deepEqual(attempt.missed, missed);
    assert.equal((await repo.quizAttempts(user, saved.id)).length, 1);
  } finally {
    await pool.end();
  }
});
