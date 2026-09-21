import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePhoto } from '../src/storage.ts';
test('rejects disguised documents, corrupt encoding, and oversized photos',()=>{
  for (const data of [Buffer.from('<script>bad</script>').toString('base64'),'not base64!',Buffer.alloc(10*1024*1024+1).toString('base64')]) {
    assert.throws(()=>validatePhoto(data,'image/jpeg'),{ statusCode:400 });
  }
});
test('accepts a photo with the declared PNG signature',()=>{
  const bytes=Buffer.from('89504e470d0a1a0a00000000','hex');
  assert.deepEqual(validatePhoto(bytes.toString('base64'),'image/png'),bytes);
  assert.throws(()=>validatePhoto(bytes.toString('base64'),'image/jpeg'));
});
