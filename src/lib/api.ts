import { createApiClient } from './http';
import { getApiSession } from './cognito';

export function apiRequest<T>(path:string,options: { method?:string;body?:unknown;idempotencyKey?:string }={}):Promise<T> {
  const baseUrl=process.env.EXPO_PUBLIC_API_URL?.trim();
  if(!baseUrl) throw new Error('Set EXPO_PUBLIC_API_URL to your ClassLens API.');
  const url=new URL(baseUrl);
  if(url.username || url.password || url.search || url.hash) throw new Error('Use an API origin without credentials or query parameters.');
  if(url.protocol!=='https:' && !(typeof __DEV__!=='undefined' && __DEV__ && url.protocol==='http:')) {
    throw new Error('The ClassLens API requires HTTPS outside development.');
  }
  return createApiClient({ baseUrl,getToken:async()=> (await getApiSession())?.accessToken ?? null })(path,options);
}
