export interface CallRecordingStorage {
  storeFromUrl(params: {
    sourceUrl: string;
    objectKey: string;
    contentType: string;
  }): Promise<void>;
  createPlaybackUrl(params: {
    objectKey: string;
    expiresInSeconds?: number;
  }): Promise<string>;
}
