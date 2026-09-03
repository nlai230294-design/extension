import { prisma } from "../db/prisma.js";
import { computeOverallRiskScore, riskLevelFor } from "../utils/risk.js";
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

// Tách chuỗi từ khóa nhập vào thành danh sách: phân tách theo dấu phẩy hoặc
// xuống dòng (giữ nguyên cụm nhiều từ như "hồ chí minh"), bỏ mục rỗng.
function parseKeywordList(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(/[,\n]/)
    .map((k) => k.trim())
    .filter(Boolean);
}

export async function getUserPosts(userId, { limit, offset, keywords }) {
  let id;
  try {
    id = BigInt(userId);
  } catch {
    throw new UserNotFoundError(`User ${userId} not found`);
  }

  const user = await prisma.socialUser.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw new UserNotFoundError(`User ${userId} not found`);

  // Lọc theo từ khóa ngay trong DB (LIKE %kw%) để tìm trên TẤT CẢ bài của user,
  // kể cả khi user có hàng trăm bài — không phụ thuộc trang đã tải về client.
  // So khớp OR: bài chứa 1 trong các từ khóa là đạt. LIKE của MySQL không phân
  // biệt hoa/thường theo collation mặc định (utf8mb4 *_ci).
  const keywordList = parseKeywordList(keywords);
  const where = { user_id: id };
  if (keywordList.length > 0) {
    where.OR = keywordList.map((kw) => ({ content: { contains: kw } }));
  }

  const [total, matched, posts] = await Promise.all([
    prisma.post.count({ where: { user_id: id } }),
    keywordList.length > 0 ? prisma.post.count({ where }) : null,
    prisma.post.findMany({
      where,
      include: {
        session: { select: { session_uuid: true, source_url: true } },
        analysis: true,
      },
      orderBy: { collected_at: "desc" },
      take: limit,
      skip: offset,
    }),
  ]);

  logger.info(
    `User ${userId}: ${posts.length}/${matched ?? total} post(s)` +
      (keywordList.length ? ` matching [${keywordList.join(", ")}]` : "") +
      ` (limit=${limit}, offset=${offset}, total=${total})`
  );

  return {
    total,
    // Số bài khớp bộ lọc (bằng total khi không lọc) — client dùng để hiển thị
    // "N khớp bộ lọc" và biết còn bài chưa hiển thị hay không.
    matched: matched ?? total,
    posts: posts.map((p) => ({
      post_id: p.id.toString(),
      content: p.content,
      post_url: p.post_url,
      source_url: p.source_url,
      posted_at_text: p.posted_at_text,
      session_id: p.session.session_uuid,
      session_source_url: p.session.source_url,
      collected_at: p.collected_at,
      // Điểm rủi ro của riêng bài này (null nếu chưa được AI phân tích).
      analysis: buildPostAnalysis(p.analysis),
    })),
  };
}

// Tính điểm rủi ro tổng + mức độ cho 1 bài từ bản ghi post_analysis (nếu có).
function buildPostAnalysis(analysis) {
  if (!analysis) return null;
  const scores = {
    toxicity: Number(analysis.toxicity_score),
    spam: Number(analysis.spam_score),
    manipulation: Number(analysis.manipulation_score),
    extremism_risk: Number(analysis.extremism_risk_score),
  };
  const overall_risk_score = computeOverallRiskScore(scores);
  return {
    overall_risk_score,
    risk_level: riskLevelFor(overall_risk_score),
    label: analysis.label,
    explanation: analysis.explanation,
    ...scores,
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
