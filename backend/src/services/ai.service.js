import { createHash } from "crypto";

import { env } from "../config/env.js";
import { RISK_THRESHOLDS } from "../utils/constants.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("ai.service");

const MOCK_MODEL_NAME = "mock-classifier-v1";

function pseudoScore(content, salt) {
  const digest = createHash("sha256").update(`${salt}:${content}`).digest("hex");
  const intVal = parseInt(digest.slice(0, 8), 16);
  return Number((intVal / 0xffffffff).toFixed(4));
}

function deriveLabel({ toxicity_score, spam_score, manipulation_score, extremism_risk_score }) {
  const signals = [
    ["toxic", toxicity_score],
    ["spam", spam_score],
    ["manipulative", manipulation_score],
    ["extremism_risk", extremism_risk_score],
  ];
  const active = signals.filter(([, score]) => score >= RISK_THRESHOLDS.highMin);
  if (active.length === 0) return "safe";
  if (active.length > 1) return "mixed";
  return active[0][0];
}

function mockAnalyzeOne(item) {
  const toxicity_score = pseudoScore(item.content, "toxicity");
  const spam_score = pseudoScore(item.content, "spam");
  const manipulation_score = pseudoScore(item.content, "manipulation");
  const extremism_risk_score = pseudoScore(item.content, "extremism");
  const sentiment_score = pseudoScore(item.content, "sentiment");

  const label = deriveLabel({
    toxicity_score,
    spam_score,
    manipulation_score,
    extremism_risk_score,
  });

  return {
    id: item.id,
    toxicity_score,
    spam_score,
    manipulation_score,
    extremism_risk_score,
    sentiment_score,
    label,
    explanation: `Phân tích mô phỏng (mock) dựa trên nội dung bài đăng. Nhãn được gán: ${label}.`,
    model_name: MOCK_MODEL_NAME,
  };
}

// Returns one result per input item, shaped like the AI prompt contract in the project
// spec (section 9.2): { id, *_score, label, explanation }. Swapping AI_PROVIDER to a real
// provider later only requires replacing the body of this function.
export async function analyzeBatch(items) {
  logger.info(`AI_PROVIDER=${env.aiProvider}: analyzing ${items.length} post(s)`);

  if (env.aiProvider === "mock") {
    const results = items.map(mockAnalyzeOne);
    logger.info(`Done: ${results.map((r) => `#${r.id}=${r.label}`).join(", ")}`);
    return results;
  }

  throw new Error(`AI_PROVIDER "${env.aiProvider}" is not implemented yet`);
}
