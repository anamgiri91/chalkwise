import { createHash } from 'node:crypto';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ApiError } from './errors.ts';

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export type Photo = { bytes: Uint8Array; mimeType: string };
export type Storage = {
  put(path: string, photo: Photo): Promise<void>;
  read(path: string): Promise<Photo>;
  url(path: string): Promise<string>;
};
export const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export function validatePhoto(data: string, mimeType: string): Buffer {
  const bytes = Buffer.from(data, 'base64');
  if (bytes.toString('base64') !== data || bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) {
    throw new ApiError(400, 'INVALID_PHOTO', 'Use a photo no larger than 10 MiB.');
  }
  const hex = bytes.subarray(0, 12).toString('hex');
  const matches = mimeType === 'image/jpeg' ? hex.startsWith('ffd8ff')
    : mimeType === 'image/png' ? hex.startsWith('89504e470d0a1a0a')
    : mimeType === 'image/webp' ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
    : bytes.toString('ascii', 4, 8) === 'ftyp' && ['heic','heix','hevc','hevx','mif1','msf1'].includes(bytes.toString('ascii', 8, 12));
  if (!matches) throw new ApiError(400, 'INVALID_PHOTO', 'The photo format does not match its content type.');
  return bytes;
}

export function s3Storage(region: string, bucket: string): Storage {
  const client = new S3Client({ region, maxAttempts: 2 });
  const options = () => ({ abortSignal: AbortSignal.timeout(30000) });
  return {
    async put(path, photo) {
      try {
        await client.send(new PutObjectCommand({ Bucket: bucket, Key: path, Body: photo.bytes,
          ContentType: photo.mimeType, IfNoneMatch: '*', Metadata: { sha256: hash(photo.bytes) },
          ServerSideEncryption: 'AES256' }), options());
      } catch (error) {
        // Resolve lost responses and retries without ever overwriting an original.
        const existing = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: path }), options()).catch(() => null);
        if (existing?.Metadata?.sha256 !== hash(photo.bytes) || existing.ContentLength !== photo.bytes.length) throw error;
      }
    },
    async read(path) {
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: path }), options());
      if (!result.Body || !result.ContentLength || result.ContentLength > MAX_PHOTO_BYTES) {
        throw new ApiError(422, 'INVALID_PHOTO', 'The original photo cannot be processed.');
      }
      const bytes = await result.Body.transformToByteArray();
      if (bytes.length > MAX_PHOTO_BYTES) throw new ApiError(422, 'INVALID_PHOTO', 'The original is too large.');
      return { bytes, mimeType: result.ContentType ?? 'application/octet-stream' };
    },
    async url(path) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: path }), { expiresIn: 300 });
    },
  };
}
