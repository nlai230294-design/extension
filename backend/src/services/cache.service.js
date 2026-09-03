import { prisma } from "../db/prisma.js";

// Dedup toàn hệ thống: bỏ qua bài nếu post_hash (profile_url|content) đã từng
// được thu thập ở BẤT KỲ session nào — không thu thập lại cùng một bài của cùng
// một người quá 1 lần. Dùng index posts_post_hash_idx nên chỉ tốn 1 lần tra
// cứu index, không phải full scan.
export async function postHashExists(postHash) {
  const existing = await prisma.post.findFirst({
    where: { post_hash: postHash },
    select: { id: true },
  });
  return existing !== null;
}

// AI-cost cache: looks up a previously analyzed result by content hash alone
// (independent of who posted it), so identical text doesn't trigger another AI call.
export async function getCachedAnalysis(contentHash) {
  return prisma.analysisCache.findUnique({ where: { content_hash: contentHash } });
}

// Records that a cached result was reused for another post, without
// touching the cached scores themselves.
export async function touchCachedAnalysis(contentHash) {
  return prisma.analysisCache.update({
    where: { content_hash: contentHash },
    data: { hit_count: { increment: 1 } },
  });
}

export async function upsertCachedAnalysis(contentHash, result) {
  const data = {
    toxicity_score: result.toxicity_score,
    spam_score: result.spam_score,
    manipulation_score: result.manipulation_score,
    extremism_risk_score: result.extremism_risk_score,
    sentiment_score: result.sentiment_score,
    label: result.label,
    explanation: result.explanation,
    model_name: result.model_name,
  };

  return prisma.analysisCache.upsert({
    where: { content_hash: contentHash },
    create: { content_hash: contentHash, ...data },
    update: { ...data, hit_count: { increment: 1 } },
  });
}
