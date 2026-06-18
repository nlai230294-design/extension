import { prisma } from "../db/prisma.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("dashboard.service");

export class UserNotFoundError extends Error { }

export async function listSessions({ limit, offset }) {
  const sessions = await prisma.session.findMany({
    orderBy: { started_at: "desc" },
    take: limit,
    skip: offset,
    include: {
      _count: { select: { posts: true, user_scores: true } },
    },
  });

  logger.info(`Listed ${sessions.length} session(s) (limit=${limit}, offset=${offset})`);

  return sessions.map((session) => ({
    session_id: session.session_uuid,
    source_url: session.source_url,
    status: session.status,
    started_at: session.started_at,
    ended_at: session.ended_at,
    total_posts: session._count.posts,
    total_users: session._count.user_scores,
  }));
}

// Cross-session view for moderators: every user seen so far, ranked by the
// highest risk score they've ever received in any session.
export async function listUsers({ limit, offset }) {
  const users = await prisma.socialUser.findMany({
    include: {
      user_scores: true,
      _count: { select: { posts: true } },
    },
  });

  const mapped = users.map((user) => {
    const scores = user.user_scores;
    const maxOverallRiskScore = scores.reduce(
      (max, score) => Math.max(max, Number(score.overall_risk_score)),
      0
    );
    const latest = scores.reduce(
      (latest, score) => (!latest || score.updated_at > latest.updated_at ? score : latest),
      null
    );

    return {
      user_id: user.id.toString(),
      display_name: user.display_name,
      profile_url: user.profile_url,
      total_post_count: user._count.posts,
      max_overall_risk_score: Number(maxOverallRiskScore.toFixed(4)),
      latest_risk_level: latest?.risk_level ?? null,
    };
  });

  mapped.sort((a, b) => b.max_overall_risk_score - a.max_overall_risk_score);
  const page = mapped.slice(offset, offset + limit);

  logger.info(`Listed ${page.length}/${mapped.length} user(s) (limit=${limit}, offset=${offset})`);
  return page;
}

export async function getUserPosts(userId, { limit, offset }) {
  let id;
  try {
    id = BigInt(userId);
  } catch {
    throw new UserNotFoundError(`User ${userId} not found`);
  }

  const user = await prisma.socialUser.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw new UserNotFoundError(`User ${userId} not found`);

  const [total, posts] = await Promise.all([
    prisma.post.count({ where: { user_id: id } }),
    prisma.post.findMany({
      where: { user_id: id },
      include: { session: { select: { session_uuid: true, source_url: true } } },
      orderBy: { collected_at: "desc" },
      take: limit,
      skip: offset,
    }),
  ]);

  logger.info(`User ${userId}: ${posts.length}/${total} post(s) (limit=${limit}, offset=${offset})`);

  return {
    total,
    posts: posts.map((p) => ({
      post_id: p.id.toString(),
      content: p.content,
      post_url: p.post_url,
      source_url: p.source_url,
      session_id: p.session.session_uuid,
      session_source_url: p.session.source_url,
      collected_at: p.collected_at,
    })),
  };
}

export async function getUserDetail(userId) {
  let id;
  try {
    id = BigInt(userId);
  } catch {
    throw new UserNotFoundError(`User ${userId} not found`);
  }

  const user = await prisma.socialUser.findUnique({
    where: { id },
    include: {
      user_scores: {
        include: { session: true },
        orderBy: { updated_at: "desc" },
      },
      _count: { select: { posts: true } },
    },
  });

  if (!user) {
    throw new UserNotFoundError(`User ${userId} not found`);
  }

  logger.info(`User ${userId}: ${user.user_scores.length} session score(s)`);

  return {
    user_id: user.id.toString(),
    display_name: user.display_name,
    profile_url: user.profile_url,
    total_post_count: user._count.posts,
    sessions: user.user_scores.map((score) => ({
      session_id: score.session.session_uuid,
      status: score.session.status,
      started_at: score.session.started_at,
      ended_at: score.session.ended_at,
      overall_risk_score: Number(score.overall_risk_score),
      risk_level: score.risk_level,
      post_count: score.post_count,
      avg_toxicity: Number(score.avg_toxicity),
      avg_spam: Number(score.avg_spam),
      avg_manipulation: Number(score.avg_manipulation),
      avg_extremism_risk: Number(score.avg_extremism_risk),
    })),
  };
}
