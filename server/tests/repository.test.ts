import test from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import { repository } from '../src/repository.ts';
import type { Database } from '../src/db.ts';
import type { Storage } from '../src/storage.ts';
import { hash } from '../src/storage.ts';

const user='bd90d574-fd6c-4ce4-bf77-897162f7180d';
const photoId='433f1f90-534d-401f-af36-d5fb0ad58ea9';
test('upload retries recover a pending intent after an object-store failure',async()=>{
  let row: Record<string,unknown>|null=null;
  let uploads=0;
  const bytes=Buffer.from('ffd8ffe00000','hex');
  const database:Database={ ping:async()=>{},close:async()=>{},asUser:async(id,work)=>{
    assert.equal(id,user);
    return work({ query:async(sql:string,params:unknown[])=>{
      if(sql.startsWith('INSERT')) row??={ id:photoId,sha256:hash(bytes),mime_type:'image/jpeg',status:'pending' };
      if(sql.startsWith('UPDATE')) row!['status']='ready';
      return { rows:sql.startsWith('SELECT')&&row?[row]:[] };
    } } as unknown as PoolClient);
  } };
  const storage:Storage={ read:async()=>{ throw new Error('unused'); },url:async()=>'',put:async()=>{ if(++uploads===1) throw new Error('lost connection'); } };
  const repo=repository(database,storage);
  const input={ id:photoId,mimeType:'image/jpeg' as const,data:bytes.toString('base64') };
  await assert.rejects(repo.upload(user,input),/lost connection/);
  const saved=await repo.upload(user,input);
  assert.equal(saved.id,photoId); assert.equal(saved.status,'ready'); assert.equal(uploads,2);
});
test('attaching to an inaccessible lecture fails before a photo update',async()=>{
  const database:Database={ ping:async()=>{},close:async()=>{},asUser:async(_id,work)=>work({ query:async(sql:string)=>{
    assert.ok(sql.startsWith('SELECT')); return { rows:[] };
  } } as unknown as PoolClient) };
  const repo=repository(database,{} as Storage);
  await assert.rejects(repo.attach(user,photoId,'someone-elses-lecture'),{ statusCode:404 });
});
