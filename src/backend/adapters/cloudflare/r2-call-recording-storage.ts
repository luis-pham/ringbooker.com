import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { CallRecordingStorage } from '@/src/backend/services/calls/call-recording-storage';

const RECORDING_DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_RECORDING_BYTES = 50 * 1024 * 1024;
const DEFAULT_PLAYBACK_EXPIRY_SECONDS = 300;

export class R2CallRecordingStorage implements CallRecordingStorage {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    params: {
      accountId: string;
      accessKeyId: string;
      secretAccessKey: string;
    },
  ) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${params.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: params.accessKeyId,
        secretAccessKey: params.secretAccessKey,
      },
    });
  }

  async storeFromUrl(params: {
    sourceUrl: string;
    objectKey: string;
    contentType: string;
  }): Promise<void> {
    const response = await fetch(params.sourceUrl, {
      signal: AbortSignal.timeout(RECORDING_DOWNLOAD_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`telnyx_recording_download_failed:${response.status}`);
    }
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_RECORDING_BYTES) {
      throw new Error('telnyx_recording_download_too_large');
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > MAX_RECORDING_BYTES) {
      throw new Error('telnyx_recording_download_too_large');
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.objectKey,
        Body: bytes,
        ContentType: params.contentType,
      }),
    );
  }

  async createPlaybackUrl(params: {
    objectKey: string;
    expiresInSeconds?: number;
  }): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: params.objectKey }),
      { expiresIn: params.expiresInSeconds ?? DEFAULT_PLAYBACK_EXPIRY_SECONDS },
    );
  }
}
