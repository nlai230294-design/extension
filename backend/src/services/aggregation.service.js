import { prisma } from "../db/prisma.js";
import { RISK_THRESHOLDS, RISK_WEIGHTS } from "../utils/constants.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("aggregation.service");

function average(values) {
  if (values.length === 0) return 0;
  const sum = values.reduce((total, value) => total + value, 0);
  return Number((sum / values.length).toFixed(4));
}

function maximum(values) {
  if (values.length === 0) return 0;
  return Number(Math.max(...values).toFixed(4));
}

function riskLevelFor(overallRiskScore) {
  if (overallRiskScore >= RISK_THRESHOLDS.highMin) return "high";
  if (overallRiskScore >= RISK_THRESHOLDS.mediumMin) return "medium";
  return "low";
}

// Recomputes a single user's aggregate scores for a session from all of their
// analyzed posts.
export async function recalcUserScores(sessionId, userId) {
  const posts = await prisma.post.findMany({
    where: { session_id: sessionId, user_id: userId },
    include: { analysis: true },
  });

  const analyzed = posts.map((post) => post.analysis).filter(Boolean);

  const avg_toxicity = average(analyzed.map((a) => Number(a.toxicity_score)));
  const max_toxicity = maximum(analyzed.map((a) => Number(a.toxicity_score)));
  const avg_spam = average(analyzed.map((a) => Number(a.spam_score)));
  const avg_manipulation = average(analyzed.map((a) => Number(a.manipulation_score)));
  const avg_extremism_risk = average(analyzed.map((a) => Number(a.extremism_risk_score)));

  const overall_risk_score = Number(
    (
      avg_toxicity * RISK_WEIGHTS.toxicity +
      avg_spam * RISK_WEIGHTS.spam +
      avg_manipulation * RISK_WEIGHTS.manipulation +
      avg_extremism_risk * RISK_WEIGHTS.extremism_risk
    ).toFixed(4)
  );

  const data = {
    avg_toxicity,
    max_toxicity,
    avg_spam,
    avg_manipulation,
    avg_extremism_risk,
    overall_risk_score,
    post_count: posts.length,
    risk_level: riskLevelFor(overall_risk_score),
  };

  await prisma.userScore.upsert({
    where: { session_id_user_id: { session_id: sessionId, user_id: userId } },
    create: { session_id: sessionId, user_id: userId, ...data },
    update: data,
  });

  logger.info(
    `User ${userId} (session=${sessionId}): overall_risk_score=${overall_risk_score} (${data.risk_level}), posts=${data.post_count}`
  );
}
