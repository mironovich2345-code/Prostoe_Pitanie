/**
 * Cloudflare R2 storage layer — S3-compatible via @aws-sdk/client-s3.
 *
 * Required environment variables:
 *   R2_ENDPOINT          — https://<account-id>.r2.cloudflarestorage.com
 *   R2_ACCESS_KEY_ID     — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret key
 *   R2_BUCKET            — bucket name
 *
 * If any variable is missing, all calls throw StorageNotConfiguredError
 * so the callers can fall back to legacy behaviour gracefully.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

export class StorageNotConfiguredError extends Error {
  constructor() {
    super('R2 storage is not configured (missing env vars)');
    this.name = 'StorageNotConfiguredError';
  }
}

function getClient(): { client: S3Client; bucket: string } {
  const endpoint = process.env['R2_ENDPOINT'];
  const accessKeyId = process.env['R2_ACCESS_KEY_ID'];
  const secretAccessKey = process.env['R2_SECRET_ACCESS_KEY'];
  const bucket = process.env['R2_BUCKET'];

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new StorageNotConfiguredError();
  }

  const client = new S3Client({
    endpoint,
    region: 'auto',
    credentials: { accessKeyId, secretAccessKey },
  });

  return { client, bucket };
}

/**
 * Upload a buffer to R2.
 *
 * @param key        - object key, e.g. `trainer-documents/123456/42.pdf`
 * @param body       - raw file bytes
 * @param mimeType   - Content-Type to store with the object
 */
export async function uploadObject(key: string, body: Buffer, mimeType: string): Promise<void> {
  const { client, bucket } = getClient();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: mimeType,
  }));
}

/**
 * Download an object from R2 and return its bytes.
 *
 * @param key - object key used during upload
 */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const { client, bucket } = getClient();
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

  if (!response.Body) {
    throw new Error(`R2: empty body for key "${key}"`);
  }

  // Node.js SDK returns a Readable stream; collect it into a Buffer
  const stream = response.Body as Readable;
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/**
 * Delete an object from R2.
 * Silently succeeds even if the key does not exist (idempotent).
 *
 * @param key - object key used during upload
 */
export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Build the canonical storage key for a TrainerDocument.
 *
 * @param chatId - trainer's chatId
 * @param docId  - TrainerDocument.id (numeric, assigned by DB)
 * @param ext    - file extension without dot, e.g. 'pdf', 'jpg'
 */
export function trainerDocKey(chatId: string, docId: number, ext: string): string {
  return `trainer-documents/${chatId}/${docId}.${ext}`;
}

/** Derive a file extension from a MIME type. Falls back to 'bin'. */
export function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg':      'jpg',
    'image/jpg':       'jpg',
    'image/png':       'png',
    'image/webp':      'webp',
    'application/pdf': 'pdf',
  };
  return map[mimeType] ?? 'bin';
}
