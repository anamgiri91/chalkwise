import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

// Explicit opt-in, like rls.test.ts. Needs 001 and 002 applied; all fixtures roll back.
const url = process.env.TEST_DATABASE_URL;
test(
  'the review log is private to its owner and append-only',
  {
    skip: !url ? 'Set TEST_DATABASE_URL to a prepared disposable *_test database.' : false,
  },
  async () => {
    const parsed = new URL(url!);
    assert.match(parsed.pathname, /_test$/, 'Only a disposable database ending in _test.');
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname));
    const db = new pg.Client({ connectionString: url });
    await db.connect();
    const a = randomUUID(),
      b = randomUUID(),
      course = `test-${randomUUID().slice(0, 8)}`,
      lecture = randomUUID();
    const identity = (id: string) => db.query("SELECT set_config('app.user_id',$1,true)", [id]);
    const log = (user: string, lectureId = lecture) =>
      db.query(
        `INSERT INTO chalkwise.review_events(user_id,lecture_id,confidence,next_review_at)
         VALUES($1,$2,'good',now() + interval '1 day')`,
        [user, lectureId],
      );
    // A failed statement aborts the transaction, so expected failures run in a savepoint.
    const rejects = async (work: () => Promise<unknown>, message: string) => {
      await db.query('SAVEPOINT expected_failure');
      await assert.rejects(work, Error, message);
      await db.query('ROLLBACK TO SAVEPOINT expected_failure');
    };
    try {
      await db.query('BEGIN');
      for (const user of [a, b]) {
        await identity(user);
        await db.query(
          "INSERT INTO chalkwise.profiles(id,name,year,major) VALUES($1,'Test','Senior','CS')",
          [user],
        );
      }
      await identity(a);
      await db.query("INSERT INTO chalkwise.courses(id,code,name) VALUES($1,$1,'Test')", [course]);
      await db.query('INSERT INTO chalkwise.course_memberships(user_id,course_id) VALUES($1,$2)', [
        a,
        course,
      ]);
      await db.query(
        "INSERT INTO chalkwise.lectures(id,owner_id,course_id,title,summary) VALUES($1,$2,$3,'Mine','Source')",
        [lecture, a, course],
      );
      await log(a);
      await log(a);
      assert.equal(
        (await db.query('SELECT id FROM chalkwise.review_events WHERE lecture_id=$1', [lecture]))
          .rowCount,
        2,
        'Every review is kept, not overwritten',
      );

      await rejects(() => log(b), 'Nobody can log a review as someone else');
      await identity(b);
      assert.equal(
        (await db.query('SELECT id FROM chalkwise.review_events WHERE lecture_id=$1', [lecture]))
          .rowCount,
        0,
        'Another student cannot read the log',
      );
      await rejects(() => log(b), 'A student cannot log reviews of a lecture they do not own');

      await identity(a);
      await rejects(
        () => db.query("UPDATE chalkwise.review_events SET confidence='easy'"),
        'The log cannot be edited',
      );
      await rejects(() => db.query('DELETE FROM chalkwise.review_events'), 'Nor deleted');
      await db.query('ROLLBACK');
    } finally {
      await db.query('ROLLBACK').catch(() => {});
      await db.end();
    }
  },
);
