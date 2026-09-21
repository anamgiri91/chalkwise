import { File } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { apiRequest } from '@/lib/api';
import { getApiSession } from '@/lib/cognito';
import type { Material, MaterialUploadInput } from '@/types';

const attempts = new Map<string, string>();
const inflight = new Map<string, Promise<Material>>();
export async function uploadApiMaterial(input: MaterialUploadInput): Promise<Material> {
  if (input.type !== 'photo' || !input.uri.startsWith('file://'))
    throw new Error('Choose a local photo to upload.');
  const session = await getApiSession();
  if (!session) throw new Error('Sign in before uploading.');
  const key = `${session.userId}:${input.uri}`;
  const pending = inflight.get(key);
  if (pending) return pending;
  const id = attempts.get(key) ?? randomUUID();
  attempts.set(key, id);
  const task = (async () => {
    const file = new File(input.uri);
    if (!file.exists || file.size <= 0 || file.size > 10 * 1024 * 1024)
      throw new Error('Choose a photo no larger than 10 MiB.');
    const data = await file.base64();
    return apiRequest<Material>('/materials', {
      method: 'POST',
      body: { id, mimeType: input.mimeType, data },
    });
  })();
  inflight.set(key, task);
  try {
    const material = await task;
    attempts.delete(key);
    return material;
  } finally {
    inflight.delete(key);
  }
}
