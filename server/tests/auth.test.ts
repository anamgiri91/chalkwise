import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
import { verifyCognitoToken } from '../src/auth.ts';

const issuer='https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TEST';
const user='bd90d574-fd6c-4ce4-bf77-897162f7180d';
const pair=await generateKeyPair('RS256');
const publicKey=await exportJWK(pair.publicKey);
const keys=createLocalJWKSet({ keys:[{ ...publicKey,kid:'test',alg:'RS256',use:'sig' }] });
const token=(claims: Record<string,unknown>={})=>new SignJWT({ sub:user,token_use:'access',client_id:'client',iss:issuer,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+60,...claims })
  .setProtectedHeader({ alg:'RS256',kid:'test' }).sign(pair.privateKey);

test('accepts a signed Cognito access token for the configured pool and client',async()=>{
  assert.equal(await verifyCognitoToken(await token(),keys,issuer,'client'),user);
});
for (const [name,claims] of Object.entries({ expired:{ exp:1 },wrongIssuer:{ iss:'https://evil.example' },wrongClient:{ client_id:'other' },idToken:{ token_use:'id' },invalidSubject:{ sub:'admin' },missingExpiry:{ exp:undefined } })) {
  test(`rejects ${name}`,async()=>{
    await assert.rejects(verifyCognitoToken(await token(claims),keys,issuer,'client'),{ statusCode:401 });
  });
}
test('rejects unsigned and tampered tokens',async()=>{
  await assert.rejects(verifyCognitoToken('e30.e30.',keys,issuer,'client'),{ statusCode:401 });
  const valid=await token();
  const parts=valid.split('.');
  parts[1]=Buffer.from(JSON.stringify({ sub:user,token_use:'access',client_id:'client',iss:issuer,exp:9999999999 })).toString('base64url');
  await assert.rejects(verifyCognitoToken(parts.join('.'),keys,issuer,'client'),{ statusCode:401 });
});
