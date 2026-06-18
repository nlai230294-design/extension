import { Queue } from "bullmq";
import IORedis from "ioredis";

import { env } from "../config/env.js";
import { AI_RETRY_ATTEMPTS, QUEUE_NAME } from "../utils/constants.js";
import { createLogger } from "../utils/logger.js";

const redisLogger = createLogger("redis");
const queueLogger = createLogger("queue");

// Shared connection for both the queue producer and the worker. BullMQ requires
// maxRetriesPerRequest: null on the underlying ioredis connection.
export const connection = new IORedis(env.redisUrl, {
  maxRetriesPerRequest: null,
});

// ioredis retries every ~50-100ms and would flood stderr with one ECONNREFUSED
// per attempt - log the first error and the eventual recovery only.
let redisErrorLogged = false;

connection.on("connect", () => {
  redisLogger.info(`Connected to Redis at ${env.redisUrl}`);
  redisErrorLogged = false;
});

connection.on("error", (error) => {
  if (redisErrorLogged) return;
  redisLogger.warn(`Connection error, retrying in background: ${error.message}`);
  redisErrorLogged = true;
});

export const analysisQueue = new Queue(QUEUE_NAME, { connection });

// BigInt ids can't be JSON-serialized directly, so job payloads use strings.
export async function enqueueAnalysisJob(sessionId, postIds) {
  const job = await analysisQueue.add(
    "analyze-posts",
    {
      session_id: sessionId.toString(),
      comment_ids: postIds.map((id) => id.toString()),
    },
    {
      attempts: AI_RETRY_ATTEMPTS,
      backoff: { type: "exponential", delay: 2000 },
    }
  );

  queueLogger.info(`Enqueued job ${job.id} (session=${sessionId}, posts=${postIds.length})`);
  return job;
}
