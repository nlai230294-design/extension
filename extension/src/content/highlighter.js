import { getAuthorInfo, queryAllPosts } from "./collector.js";

const STYLE_ID = "sca-highlight-style";
const RISK_ATTR = "data-sca-risk";
const LABEL_ATTR = "data-sca-risk-label";

const RISK_LABELS = {
  low: "Rủi ro thấp",
  medium: "Rủi ro trung bình",
  high: "Rủi ro cao",
};

const RISK_COLORS = {
  low: "#16a34a",
  medium: "#b45309",
  high: "#dc2626",
};

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = Object.entries(RISK_COLORS)
    .map(
      ([level, color]) => `
        [${RISK_ATTR}="${level}"] {
          outline: 2px solid ${color};
          background: ${color}0f;
        }
        [${RISK_ATTR}="${level}"]::before {
          content: attr(${LABEL_ATTR});
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          background: ${color};
          padding: 1px 8px;
          border-radius: 4px 4px 0 0;
        }
      `
    )
    .join("\n");

  document.head.appendChild(style);
}

// Marks each visible comment container with its author's risk_level (from the
// latest /api/analysis/results), so moderators can spot high-risk authors
// directly on the Facebook page without opening the popup.
export function applyHighlights(users) {
  ensureStyles();

  const byProfile = new Map();
  for (const user of users) {
    if (user.profile_url) byProfile.set(user.profile_url, user);
  }

  for (const container of queryAllPosts()) {
    const { profile_url } = getAuthorInfo(container);
    const user = profile_url && byProfile.get(profile_url);

    if (!user) {
      container.removeAttribute(RISK_ATTR);
      container.removeAttribute(LABEL_ATTR);
      continue;
    }

    const label = RISK_LABELS[user.risk_level] || user.risk_level;
    container.setAttribute(RISK_ATTR, user.risk_level);
    container.setAttribute(LABEL_ATTR, `${label} (${user.overall_risk_score})`);
  }
}

export function clearHighlights() {
  for (const container of queryAllPosts()) {
    container.removeAttribute(RISK_ATTR);
    container.removeAttribute(LABEL_ATTR);
  }
  document.getElementById(STYLE_ID)?.remove();
}
