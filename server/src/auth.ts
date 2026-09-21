import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';
import { ApiError } from './errors.ts';

export type VerifyToken = (token: string) => Promise<string>;
export function cognitoVerifier(region: string, poolId: string, clientId: string): VerifyToken {
  const issuer = `https://cognito-idp.${region}.amazonaws.com/${poolId}`;
  const keys = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  return (token) => verifyCognitoToken(token, keys, issuer, clientId);
}

/** Separate claim verification permits real signed-token tests without a network. */
export async function verifyCognitoToken(
  token: string,
  keys: JWTVerifyGetKey,
  issuer: string,
  clientId: string,
): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer,
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat', 'sub'],
    });
    if (payload.token_use !== 'access' || payload.client_id !== clientId)
      throw new Error('Wrong token type or client.');
    return z.uuid().parse(payload.sub);
  } catch {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in again to continue.');
  }
}
