import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { Database } from './db.ts';
import type { Storage } from './storage.ts';
import { hash, validatePhoto } from './storage.ts';
import { ApiError, found } from './errors.ts';
import { nextReviewAt } from '../../src/features/study/schedule.ts';
import type { ReviewConfidence } from '../../src/features/study/schedule.ts';
import type { z } from 'zod';
import type { courseInput, lectureInput, profileInput, uploadInput } from './validation.ts';

const lectureColumns = `id, course_id AS "courseId", title, summary, key_concepts AS "keyConcepts",
  important_points AS "importantPoints", assignments, exam_mentions AS "examMentions", created_at AS "createdAt"`;
const materialColumns = `id, lecture_id AS "lectureId", 'photo' AS type, storage_path AS "filePath"`;
const reviewColumns = `lecture_id AS "lectureId", confidence, reviewed_at AS "reviewedAt", next_review_at AS "nextReviewAt"`;
const one = async (db: PoolClient, sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] ?? null;
const many = async (db: PoolClient, sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows;
const stableUuid = (value: string) => {
  const h = createHash('sha256').update(value).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
};

export function repository(database: Database, storage: Storage) {
  const run = <T>(user: string, work: (db: PoolClient) => Promise<T>) => database.asUser(user, work);
  return {
    profile: (user: string, id = user) => run(user, db => one(db, 'SELECT id,name,year,major FROM classlens.profiles WHERE id=$1', [id])),
    saveProfile: (user: string, input: z.infer<typeof profileInput>) => run(user, db => one(db,
      `INSERT INTO classlens.profiles(id,name,year,major) VALUES($1,$2,$3,$4)
       ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,year=EXCLUDED.year,major=EXCLUDED.major RETURNING id,name,year,major`, [user,input.name,input.year,input.major])),
    searchProfiles: (user: string, query: string) => run(user, db => many(db,
      "SELECT id,name,year,major FROM classlens.profiles WHERE id<>$1 AND name ILIKE $2 ESCAPE '\\' ORDER BY name,id LIMIT 20",
      [user, `%${query.replace(/[\\%_]/g, '\\$&')}%`])),
    courses: (user: string, enrolled = false) => run(user, db => many(db,
      `SELECT c.id,c.code,c.name,c.professor FROM classlens.courses c ${enrolled ? 'JOIN classlens.course_memberships m ON m.course_id=c.id AND m.user_id=$1' : ''} ORDER BY c.code,c.id LIMIT 500`, enrolled ? [user] : [])),
    course: (user: string, id: string) => run(user, db => one(db, 'SELECT id,code,name,professor FROM classlens.courses WHERE id=$1', [id])),
    createCourse: (user: string, input: z.infer<typeof courseInput>) => run(user, async db => {
      const id = input.code.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || randomUUID();
      await db.query('INSERT INTO classlens.courses(id,code,name,professor) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', [id,input.code,input.name,input.professor]);
      return one(db, 'SELECT id,code,name,professor FROM classlens.courses WHERE id=$1', [id]);
    }),
    enroll: (user: string, id: string, join: boolean) => run(user, async db => {
      if (join) await db.query('INSERT INTO classlens.course_memberships(user_id,course_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[user,id]);
      else await db.query('DELETE FROM classlens.course_memberships WHERE user_id=$1 AND course_id=$2',[user,id]);
    }),
    lectures: (user: string, courseId: string) => run(user, db => many(db,
      `SELECT ${lectureColumns} FROM classlens.lectures WHERE course_id=$1 AND owner_id=$2 ORDER BY created_at DESC,id LIMIT 500`, [courseId,user])),
    lecture: (user: string, id: string) => run(user, db => one(db, `SELECT ${lectureColumns} FROM classlens.lectures WHERE id=$1`, [id])),
    createLecture: (user: string, id: string, input: z.infer<typeof lectureInput>) => run(user, async db => {
      await db.query(`INSERT INTO classlens.lectures(id,owner_id,course_id,title,summary,key_concepts,important_points,assignments,exam_mentions)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING`,
      [id,user,input.courseId,input.title,input.summary,input.keyConcepts,input.importantPoints,input.assignments,input.examMentions]);
      const saved = found(await one(db, `SELECT ${lectureColumns} FROM classlens.lectures WHERE id=$1 AND owner_id=$2`,[id,user]));
      if (Object.keys(input).some(key => JSON.stringify(saved[key]) !== JSON.stringify(input[key as keyof typeof input]))) {
        throw new ApiError(409,'IDEMPOTENCY_CONFLICT','This save key was already used for different notes.');
      }
      return saved;
    }),
    sharing: (user: string, id: string) => run(user, db => one(db,
      'SELECT shared,owner_id=$2 AS "canEdit" FROM classlens.lectures WHERE id=$1',[id,user])),
    setSharing: (user: string, id: string, shared: boolean) => run(user, async db => found(await one(db,
      'UPDATE classlens.lectures SET shared=$3 WHERE id=$1 AND owner_id=$2 RETURNING shared,true AS "canEdit"',[id,user,shared]))),
    sharedLectures: (user: string, owners: string[]) => run(user, db => many(db,
      `SELECT ${lectureColumns},owner_id AS "ownerId" FROM classlens.lectures WHERE owner_id=ANY($1::uuid[]) AND owner_id<>$2 ORDER BY created_at DESC,id LIMIT 100`,[owners,user])),
    friendships: (user: string) => run(user, db => many(db,
      `SELECT f.id,f.status,f.addressee_id=$1 AS incoming,p.id AS "profileId",p.name,p.year,p.major
       FROM classlens.friendships f JOIN classlens.profiles p ON p.id=CASE WHEN f.requester_id=$1 THEN f.addressee_id ELSE f.requester_id END ORDER BY p.name,p.id`, [user])),
    requestFriend: (user: string, addressee: string) => run(user, async db => {
      if (user===addressee) throw new ApiError(400,'INVALID_REQUEST','You cannot add yourself.');
      await db.query('INSERT INTO classlens.friendships(requester_id,addressee_id) VALUES($1,$2)', [user,addressee]);
    }),
    acceptFriend: (user: string, id: string) => run(user, async db => found(await one(db,
      "UPDATE classlens.friendships SET status='accepted' WHERE id=$1 AND addressee_id=$2 AND status='pending' RETURNING id",[id,user]))),
    materials: (user: string, lectureId: string) => run(user, db => many(db,
      `SELECT ${materialColumns} FROM classlens.materials WHERE lecture_id=$1 AND status='ready' ORDER BY created_at,id`, [lectureId])),
    upload: async (user: string, input: z.infer<typeof uploadInput>) => {
      const bytes = validatePhoto(input.data,input.mimeType);
      const digest = hash(bytes);
      const path = `${user}/${input.id}/original`;
      // Persist the intent first. A retry can finish the same intent after any lost response.
      const row = await run(user,async db => {
        await db.query(`INSERT INTO classlens.materials(id,owner_id,storage_path,mime_type,byte_size,sha256)
          VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING`,[input.id,user,path,input.mimeType,bytes.length,digest]);
        return found(await one(db,'SELECT * FROM classlens.materials WHERE id=$1 AND owner_id=$2',[input.id,user]));
      });
      if (row.sha256!==digest || row.mime_type!==input.mimeType) throw new ApiError(409,'IDEMPOTENCY_CONFLICT','This upload key belongs to another photo.');
      await storage.put(path,{ bytes,mimeType: input.mimeType });
      return run(user,async db => {
        await db.query("UPDATE classlens.materials SET status='ready' WHERE id=$1 AND owner_id=$2 AND status='pending'",[input.id,user]);
        return found(await one(db,`SELECT ${materialColumns} FROM classlens.materials WHERE id=$1 AND status='ready'`,[input.id]));
      });
    },
    attach: (user: string, id: string, lectureId: string) => run(user,async db => {
      found(await one(db,'SELECT id FROM classlens.lectures WHERE id=$1 AND owner_id=$2',[lectureId,user]));
      const row = await one(db,`UPDATE classlens.materials SET lecture_id=$2 WHERE id=$1 AND owner_id=$3 AND lecture_id IS NULL AND status='ready' RETURNING ${materialColumns}`,[id,lectureId,user]);
      if (!row) throw new ApiError(409,'ATTACHMENT_CONFLICT','Photo is unavailable or already attached.');
      return row;
    }),
    materialUrl: async (user: string, id: string) => {
      const row = found(await run(user,db => one(db,"SELECT storage_path FROM classlens.materials WHERE id=$1 AND status='ready'",[id])));
      return { url: await storage.url(row.storage_path) };
    },
    context: async (user: string, id: string, material = false) => {
      const data = await run(user, async db => {
        const lecture = material ? null : found(await one(db,`SELECT ${lectureColumns} FROM classlens.lectures WHERE id=$1`,[id]));
        const rows = await many(db,`SELECT storage_path,byte_size FROM classlens.materials WHERE ${material ? 'id' : 'lecture_id'}=$1 AND status='ready' ORDER BY created_at,id LIMIT 7`,[id]);
        if (material && !rows.length) found(null);
        if (rows.length>6 || rows.reduce((total,r)=>total+r.byte_size,0)>10*1024*1024) throw new ApiError(422,'CONTEXT_TOO_LARGE','Use at most six photos totaling 10 MiB.');
        return { lecture,rows };
      });
      const photos = await Promise.all(data.rows.map(row => storage.read(row.storage_path)));
      return { lecture: data.lecture,photos };
    },
    reviews: (user: string) => run(user,db => many(db,`SELECT ${reviewColumns} FROM classlens.reviews WHERE user_id=$1 ORDER BY next_review_at LIMIT 500`,[user])),
    review: (user: string, id: string, confidence: ReviewConfidence) => run(user,async db => {
      found(await one(db,'SELECT id FROM classlens.lectures WHERE id=$1 AND owner_id=$2',[id,user]));
      return one(db,`INSERT INTO classlens.reviews(user_id,lecture_id,confidence,next_review_at) VALUES($1,$2,$3,$4)
        ON CONFLICT(user_id,lecture_id) DO UPDATE SET confidence=EXCLUDED.confidence,reviewed_at=now(),next_review_at=EXCLUDED.next_review_at RETURNING ${reviewColumns}`, [user,id,confidence,nextReviewAt(confidence)]);
    }),
    copyLecture: async (user: string, sourceId: string) => {
      const targetId = `copy:${user}:${sourceId}`;
      const source = await run(user,async db => ({
        lecture: found(await one(db,'SELECT * FROM classlens.lectures WHERE id=$1 AND owner_id<>$2',[sourceId,user])),
        photos: await many(db,"SELECT * FROM classlens.materials WHERE lecture_id=$1 AND status='ready' ORDER BY created_at,id LIMIT 7",[sourceId]),
      }));
      if (source.photos.length>6) throw new ApiError(422,'TOO_MANY_PHOTOS','This notebook has too many originals to copy.');
      for (const photo of source.photos) {
        const id = stableUuid(`${targetId}:${photo.id}`);
        const bytes = await storage.read(photo.storage_path);
        await storage.put(`${user}/${id}/original`,bytes);
      }
      return run(user,async db => {
        // Recheck sharing inside the final transaction; revocation during copying prevents publication.
        const l = found(await one(db,'SELECT * FROM classlens.lectures WHERE id=$1 AND owner_id<>$2',[sourceId,user]));
        await db.query(`INSERT INTO classlens.lectures(id,owner_id,course_id,title,summary,key_concepts,important_points,assignments,exam_mentions,source_lecture_id)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,[targetId,user,l.course_id,l.title,l.summary,l.key_concepts,l.important_points,l.assignments,l.exam_mentions,sourceId]);
        for (const p of source.photos) {
          const id = stableUuid(`${targetId}:${p.id}`);
          await db.query(`INSERT INTO classlens.materials(id,owner_id,lecture_id,storage_path,mime_type,byte_size,sha256,status)
            VALUES($1,$2,$3,$4,$5,$6,$7,'ready') ON CONFLICT DO NOTHING`,[id,user,targetId,`${user}/${id}/original`,p.mime_type,p.byte_size,p.sha256]);
        }
        return found(await one(db,`SELECT ${lectureColumns} FROM classlens.lectures WHERE id=$1 AND owner_id=$2`,[targetId,user]));
      });
    },
  };
}
export type Repository = ReturnType<typeof repository>;
