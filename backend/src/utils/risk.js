import { RISK_THRESHOLDS, RISK_WEIGHTS } from "./constants.js";

// Điểm rủi ro tổng từ 4 chỉ số (dùng chung cho aggregate theo user và cho từng
// bài đăng đơn lẻ) — cùng một bộ trọng số để kết quả nhất quán.
export function computeOverallRiskScore({ toxicity, spam, manipulation, extremism_risk }) {
  return Number(
    (
      toxicity * RISK_WEIGHTS.toxicity +
      spam * RISK_WEIGHTS.spam +
      manipulation * RISK_WEIGHTS.manipulation +
      extremism_risk * RISK_WEIGHTS.extremism_risk
    ).toFixed(4)
  );
}

export function riskLevelFor(overallRiskScore) {
  if (overallRiskScore >= RISK_THRESHOLDS.highMin) return "high";
  if (overallRiskScore >= RISK_THRESHOLDS.mediumMin) return "medium";
  return "low";
}
