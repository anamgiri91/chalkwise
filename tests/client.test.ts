import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/lib/http.ts';
import { createSessionManager, type AuthSession } from '../src/lib/sessionManager.ts';

const session:AuthSession={ accessToken:'access',refreshToken:'refresh',userId:'student',expiresAt:999999 };
test('concurrent session reads perform one refresh and do not persist access tokens',async()=>{
  let count=0; const writes:unknown[]=[];
  const manager=createSessionManager({ now:()=>0,store:{ read:async()=>'saved-refresh',write:async value=>{ writes.push(value); } },refresh:async token=>{ count++; assert.equal(token,'saved-refresh'); return session; } });
  const result=await Promise.all([manager.get(),manager.get(),manager.get()]);
  assert.equal(count,1);assert.equal(result[2]?.accessToken,'access');assert.equal(writes.length,0);
  await manager.set(session);assert.deepEqual(writes,['refresh']);
});
test('sign-out during refresh cannot resurrect the session',async()=>{
  let finish!:(session:AuthSession)=>void;
  const refreshing=new Promise<AuthSession>(resolve=>{ finish=resolve; });
  const manager=createSessionManager({ store:{ read:async()=>'old',write:async()=>{} },refresh:()=>refreshing });
  const pending=manager.get();await Promise.resolve();await manager.clear();finish(session);
  assert.equal(await pending,null);assert.equal(await manager.get(),null);
});
test('an initial network failure retains the ability to restore a session',async()=>{
  let attempts=0;
  const manager=createSessionManager({ store:{ read:async()=>'saved',write:async()=>{} },refresh:async()=>{ if(++attempts===1) throw new Error('offline'); return session; } });
  await assert.rejects(manager.get(),/offline/);
  assert.equal((await manager.get())?.userId,'student');assert.equal(attempts,2);
});
test('missing sessions never issue API requests',async()=>{
  let called=false;
  const client=createApiClient({ baseUrl:'https://api.example',getToken:async()=>null,fetch:async()=>{ called=true;return new Response(); } });
  await assert.rejects(client('/profile'),{ status:401 });assert.equal(called,false);
});
test('API writes propagate stable keys without implicit retries',async()=>{
  let calls=0;
  const client=createApiClient({ baseUrl:'https://api.example/',getToken:async()=>'access',fetch:async(url,options)=>{
    calls++;assert.equal(url,'https://api.example/v1/lectures');
    assert.equal((options?.headers as Record<string,string>)['Idempotency-Key'],'stable-id');
    return new Response(JSON.stringify({ error:{code:'CONFLICT',message:'Retry safely',requestId:'trace'} }),{status:409});
  } });
  await assert.rejects(client('/lectures',{method:'POST',body:{title:'Note'},idempotencyKey:'stable-id'}),{ status:409,requestId:'trace' });assert.equal(calls,1);
});
test('malformed successful responses fail rather than looking like missing records',async()=>{
  const client=createApiClient({baseUrl:'https://api.example',getToken:async()=>'access',fetch:async()=>new Response('{bad',{headers:{'content-type':'application/json'}})});
  await assert.rejects(client('/profile'),{code:'INVALID_RESPONSE'});
});
