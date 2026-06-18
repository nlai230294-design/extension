export const BATCH_SIZE = 20;
export const MAX_BATCH_SIZE = 30;
export const POST_MAX_LENGTH = 10000;

export const AI_RETRY_ATTEMPTS = 2;

export const RISK_WEIGHTS = {
  toxicity: 0.3,
  spam: 0.15,
  manipulation: 0.3,
  extremism_risk: 0.25,
};

// overall_risk_score >= highMin => "high", >= mediumMin => "medium", otherwise "low"
export const RISK_THRESHOLDS = {
  mediumMin: 0.4,
  highMin: 0.7,
};

export const QUEUE_NAME = "analyze-posts";
