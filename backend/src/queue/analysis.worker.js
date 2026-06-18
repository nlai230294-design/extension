import { Worker } from "bullmq";

import { prisma } from "../db/prisma.js";
import { analyzeBatch } from "../services/ai.service.js";
import { recalcUserScores } from "../services/aggregation.service.js";
import { getCachedAnalysis, touchCachedAnalysis, upsertCachedAnalysis } from "../services/cache.service.js";
import { BATCH_SIZE, QUEUE_NAME } from "../utils/constants.js";
import { contentHash } from "../utils/hash.js";
import { createLogger } from "../utils/logger.js";
import { connection } from "./analysis.queue.js";

const logger = createLogger("analysis.worker");

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function upsertAnalysis(result) {
  const postId = BigInt(result.id);
  const data = {
    toxicity_score: result.toxicity_score,
    spam_score: result.spam_score,
    manipulation_score: result.manipulation_score,
    extremism_risk_score: result.extremism_risk_score,
    sentiment_score: result.sentiment_score,
    label: result.label,
    explanation: result.explanation,
    model_name: result.model_name,
    raw_response: result,
  };

  await prisma.postAnalysis.upsert({
    where: { post_id: postId },
    create: { post_id: postId, ...data },
    update: data,
  });
}

// Reshapes a cached row (AnalysisCache) into the same shape analyzeBatch()
// returns, so it can flow through upsertAnalysis/upsertCachedAnalysis uniformly.
function cachedToResult(postId, cached) {
  return {
    id: postId.toString(),
    toxicity_score: Number(cached.toxicity_score),
    spam_score: Number(cached.spam_score),
    manipulation_score: Number(cached.manipulation_score),
    extremism_risk_score: Number(cached.extremism_risk_score),
    sentiment_score: Number(cached.sentiment_score),
    label: cached.label,
    explanation: cached.explanation,
    model_name: cached.model_name,
  };
}

async function processAnalysisJob(job) {
  const sessionId = BigInt(job.data.session_id);
  const postIds = job.data.comment_ids.map((id) => BigInt(id));

  logger.info(`Job ${job.id}: analyzing ${postIds.length} posts (session=${sessionId})`);

  const posts = await prisma.post.findMany({
    where: { id: { in: postIds } },
    select: { id: true, content: true, user_id: true },
  });

  for (const batch of chunk(posts, BATCH_SIZE)) {
    const toAnalyze = [];
    let cacheHits = 0;

    for (const post of batch) {
      const hash = contentHash(post.content);
      const cached = await getCachedAnalysis(hash);

      if (cached) {
        cacheHits += 1;
        await upsertAnalysis(cachedToResult(post.id, cached));
        await touchCachedAnalysis(hash);
      } else {
        toAnalyze.push({ post, hash });
      }
    }

    logger.info(
      `Job ${job.id}: batch of ${batch.length} -> ${cacheHits} cache hit(s), ${toAnalyze.length} sent to AI`
    );

    if (toAnalyze.length > 0) {
      const results = await analyzeBatch(
        toAnalyze.map(({ post }) => ({ id: post.id.toString(), content: post.content }))
      );

      for (let i = 0; i < results.length; i += 1) {
        const result = results[i];
        await upsertAnalysis(result);
        await upsertCachedAnalysis(toAnalyze[i].hash, result);
      }
    }
  }

  const affectedUserIds = [...new Set(posts.map((post) => post.user_id.toString()))];
  for (const userId of affectedUserIds) {
    await recalcUserScores(sessionId, BigInt(userId));
  }

  logger.info(`Job ${job.id}: done, recalculated scores for ${affectedUserIds.length} user(s)`);
}

export function createAnalysisWorker() {
  const worker = new Worker(QUEUE_NAME, processAnalysisJob, { connection });

  worker.on("completed", (job) => {
    logger.info(`Job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    logger.error(`Job ${job?.id} failed:`, error.message);
  });

  return worker;
}
