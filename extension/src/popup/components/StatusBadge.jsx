const RISK_LABELS = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
};

function StatusBadge({ riskLevel }) {
  return (
    <span className={`risk-badge risk-badge--${riskLevel}`}>{RISK_LABELS[riskLevel] || riskLevel}</span>
  );
}

export default StatusBadge;
