import Redis from 'ioredis';

import { getEnv } from '@/src/backend/config/env';

let redisClient: Redis | null | undefined;

export function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient;

  const url = getEnv().REDIS_URL;
  if (!url) {
    redisClient = null;
    return redisClient;
  }

  redisClient = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  redisClient.on('error', () => {
    // best effort cache connection
  });

  return redisClient;
}
