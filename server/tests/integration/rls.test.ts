import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

// Explicit opt-in. No migrations or remote production defaults; all fixtures roll back.
const url = process.env.TEST_DATABASE_URL;
test(
  'PostgreSQL isolates owners and permits only explicit, enrolled friend sharing',
  {
    skip: !url ? 'Set TEST_DATABASE_URL to a prepared disposable *_test database.' : false,
  },
  async () => {
    const parsed = new URL(url!);
    assert.match(
      parsed.pathname,
      /_test$/,
      'Only a disposable database ending in _test is permitted.',
    );
    assert.ok(
      ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname),
      'Integration tests require a local database.',
    );
    const db = new pg.Client({ connectionString: url });
    await db.connect();
    const a = randomUUID(),
      b = randomUUID(),
      c = randomUUID(),
      course = `test-${randomUUID()}`,
      lecture = randomUUID();
    const identity = (id: string) => db.query("SELECT set_config('app.user_id',$1,true)", [id]);
    try {
      const {
        rows: [role],
      } = await db.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
      assert.equal(role.rolsuper, false);
      assert.equal(role.rolbypassrls, false);
      await db.query('BEGIN');
      for (const user of [a, b, c]) {
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
        "INSERT INTO chalkwise.lectures(id,owner_id,course_id,title,summary) VALUES($1,$2,$3,'Private','Source')",
        [lecture, a, course],
      );
      await db.query('INSERT INTO chalkwise.friendships(requester_id,addressee_id) VALUES($1,$2)', [
        a,
        b,
      ]);
      await identity(b);
      assert.equal(
        (await db.query('SELECT id FROM chalkwise.lectures WHERE id=$1', [lecture])).rowCount,
        0,
      );
      await db.query(
        "UPDATE chalkwise.friendships SET status='accepted' WHERE requester_id=$1 AND addressee_id=$2",
        [a, b],
      );
      await db.query('INSERT INTO chalkwise.course_memberships(user_id,course_id) VALUES($1,$2)', [
        b,
        course,
      ]);
      assert.equal(
        (await db.query('SELECT id FROM chalkwise.lectures WHERE id=$1', [lecture])).rowCount,
        0,
        'Friendship alone must not share a private note',
      );
      await identity(a);
      await db.query('UPDATE chalkwise.lectures SET shared=true WHERE id=$1', [lecture]);
      await identity(b);
      assert.equal(
        (await db.query('SELECT id FROM chalkwise.lectures WHERE id=$1', [lecture])).rowCount,
        1,
      );
      assert.equal(
        (await db.query('UPDATE chalkwise.lectures SET shared=false WHERE id=$1', [lecture]))
          .rowCount,
        0,
        'A recipient cannot change ownership settings',
      );
      await identity(c);
      assert.equal(
        (await db.query('SELECT id FROM chalkwise.lectures WHERE id=$1', [lecture])).rowCount,
        0,
      );
      await identity(a);
      await db.query('UPDATE chalkwise.lectures SET shared=false WHERE id=$1', [lecture]);
      await identity(b);
      assert.equal(
        (await db.query('SELECT id FROM chalkwise.lectures WHERE id=$1', [lecture])).rowCount,
        0,
        'Revocation stops future reads',
      );
      await db.query('ROLLBACK');
      assert.equal(
        (await db.query('SELECT chalkwise.user_id() AS id')).rows[0].id,
        null,
        'User context must not leak after rollback',
      );
    } finally {
      await db.query('ROLLBACK').catch(() => {});
      await db.end();
    }
  },
);
