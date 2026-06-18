import { v4 as uuidv4 } from "uuid";

import { prisma } from "../db/prisma.js";
import { enqueueAnalysisJob } from "../queue/analysis.queue.js";
import { createLogger } from "../utils/logger.js";
import { postHash, userHash } from "../utils/hash.js";
import { postHashExists } from "./cache.service.js";

const logger = createLogger("analysis.service");

export class SessionNotFoundError extends Error {}
export class SessionNotRunningError extends Error {}

const PRISMA_UNIQUE_CONSTRAINT_ERROR = "P2002";

export async function createSession(sourceUrl) {
  const session = await prisma.session.create({
    data: {
      session_uuid: uuidv4(),
      source_url: sourceUrl,
    },
  });

  logger.info(`Created session ${session.session_uuid} (source_url=${sourceUrl})`);
  return { session_id: session.session_uuid, status: session.status };
}

export async function stopSession(sessionUuid) {
  const session = await prisma.session.findUnique({ where: { session_uuid: sessionUuid } });
  if (!session) {
    throw new SessionNotFoundError(`Session ${sessionUuid} not found`);
  }

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { status: "completed", ended_at: new Date() },
  });

  logger.info(`Stopped session ${updated.session_uuid}`);
  return { session_id: updated.session_uuid, status: updated.status };
}

async function insertPost(session, item, hash) {
  const uHash = userHash(item.profile_url, item.display_name);

  try {
    return await prisma.$transaction(async (tx) => {
      const socialUser = await tx.socialUser.upsert({
        where: { user_hash: uHash },
        create: {
          user_hash: uHash,
          display_name: item.display_name,
          profile_url: item.profile_url,
        },
        update: {
          display_name: item.display_name,
          profile_url: item.profile_url,
        },
      });

      return tx.post.create({
        data: {
          session_id: session.id,
          user_id: socialUser.id,
          post_hash: hash,
          content: item.content,
          post_url: item.post_url,
          source_url: item.source_url,
        },
      });
    });
  } catch (error) {
    if (error.code === PRISMA_UNIQUE_CONSTRAINT_ERROR) {
      return null;
    }
    throw error;
  }
}

export async function ingestBatch(sessionUuid, items) {
  const session = await prisma.session.findUnique({ where: { session_uuid: sessionUuid } });
  if (!session) {
    throw new SessionNotFoundError(`Session ${sessionUuid} not found`);
  }
  if (session.status !== "running") {
    throw new SessionNotRunningError(
      `Session ${sessionUuid} is not accepting data (status=${session.status})`
    );
  }

  let accepted = 0;
  let skipped_duplicates = 0;
  const createdPostIds = [];

  for (const item of items) {
    const hash = item.post_hash || postHash(item.profile_url, item.content);

    if (await postHashExists(hash, session.id)) {
      skipped_duplicates += 1;
      continue;
    }

    const post = await insertPost(session, item, hash);
    if (post === null) {
      skipped_duplicates += 1;
      continue;
    }

    createdPostIds.push(post.id);
    accepted += 1;
  }

  let job_id = null;
  if (createdPostIds.length > 0) {
    const job = await enqueueAnalysisJob(session.id, createdPostIds);
    job_id = job.id;
  }

  logger.info(
    `Session ${sessionUuid}: batch of ${items.length} -> accepted=${accepted}, skipped_duplicates=${skipped_duplicates}, job_id=${job_id ?? "none"}`
  );

  return { job_id, accepted, skipped_duplicates };
}

export async function getResults(sessionUuid) {
  const session = await prisma.session.findUnique({ where: { session_uuid: sessionUuid } });
  if (!session) {
    throw new SessionNotFoundError(`Session ${sessionUuid} not found`);
  }

  const [totalPosts, processedPosts, distinctUsers, userScores] = await Promise.all([
    prisma.post.count({ where: { session_id: session.id } }),
    prisma.post.count({ where: { session_id: session.id, analysis: { isNot: null } } }),
    prisma.post.findMany({
      where: { session_id: session.id },
      distinct: ["user_id"],
      select: { user_id: true },
    }),
    prisma.userScore.findMany({
      where: { session_id: session.id },
      include: { user: true },
      orderBy: { overall_risk_score: "desc" },
    }),
  ]);

  return {
    session_id: session.session_uuid,
    status: session.status,
    summary: {
      total_users: distinctUsers.length,
      total_posts: totalPosts,
      processed_posts: processedPosts,
    },
    users: userScores.map((score) => ({
      user_id: score.user_id.toString(),
      display_name: score.user.display_name,
      profile_url: score.user.profile_url,
      post_count: score.post_count,
      overall_risk_score: Number(score.overall_risk_score),
      risk_level: score.risk_level,
      avg_toxicity: Number(score.avg_toxicity),
      avg_spam: Number(score.avg_spam),
      avg_manipulation: Number(score.avg_manipulation),
      avg_extremism_risk: Number(score.avg_extremism_risk),
    })),
  };
}
