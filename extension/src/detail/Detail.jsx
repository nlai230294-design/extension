import { useEffect, useState } from "react";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import { FiInfo } from "react-icons/fi";

import { BACKEND_BASE_URL } from "../utils/constants.js";

const RISK_LABEL = { low: "Thấp", medium: "Trung bình", high: "Cao" };

function RiskBadge({ level }) {
  return <span className={`risk-badge risk-badge--${level}`}>{RISK_LABEL[level] ?? level}</span>;
}

function ScoreRow({ label, value }) {
  return (
    <div className="score-row">
      <span className="score-row__label">{label}</span>
      <span className="score-row__bar">
        <span className="score-row__fill" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span className="score-row__value">{Number(value).toFixed(2)}</span>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function apiFetch(path) {
  const res = await fetch(`${BACKEND_BASE_URL}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function Detail() {
  const userId = new URLSearchParams(window.location.search).get("user_id");

  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setError("Thiếu tham số user_id trong URL.");
      return;
    }

    Promise.all([
      apiFetch(`/api/users/${userId}`),
      apiFetch(`/api/users/${userId}/posts?limit=100`),
    ])
      .then(([userDetail, postData]) => {
        setUser(userDetail);
        setPosts(postData);
      })
      .catch((err) => setError(err.message));
  }, [userId]);

  if (error) {
    return (
      <div className="detail">
        <p className="detail__error">{error}</p>
      </div>
    );
  }

  if (!user || !posts) {
    return (
      <div className="detail">
        <p className="detail__loading">Đang tải...</p>
      </div>
    );
  }

  // Weighted average across all sessions (weight = post_count per session).
  const aggregate = (() => {
    const sessions = user.sessions;
    if (!sessions.length) return null;
    const totalPosts = sessions.reduce((sum, s) => sum + s.post_count, 0);
    const wavg = (field) => {
      if (totalPosts === 0)
        return sessions.reduce((sum, s) => sum + Number(s[field]), 0) / sessions.length;
      return sessions.reduce((sum, s) => sum + Number(s[field]) * s.post_count, 0) / totalPosts;
    };
    const overall = wavg("overall_risk_score");
    return {
      overall_risk_score: overall,
      avg_toxicity: wavg("avg_toxicity"),
      avg_spam: wavg("avg_spam"),
      avg_manipulation: wavg("avg_manipulation"),
      avg_extremism_risk: wavg("avg_extremism_risk"),
      risk_level: overall >= 0.7 ? "high" : overall >= 0.4 ? "medium" : "low",
    };
  })();

  return (
    <div className="detail">
      <header className="detail__header">
        <div className="detail__brand">
          <span className="detail__logo">SCA</span>
          <div>
            <h1 className="detail__name">{user.display_name || "Không rõ tên"}</h1>
            {user.profile_url && (
              <a
                className="detail__profile-link"
                href={user.profile_url}
                target="_blank"
                rel="noreferrer"
              >
                Xem hồ sơ Facebook ↗
              </a>
            )}
          </div>
          {aggregate && <RiskBadge level={aggregate.risk_level} />}
        </div>
      </header>

      {aggregate && (
        <section className="card">
          <h2 className="section-title">
            Chỉ số rủi ro trung bình ({user.sessions.length} phiên)
          </h2>
          <div className="score-overview">
            <div className="score-overview__overall">
              <span className="score-overview__number">
                {Number(aggregate.overall_risk_score).toFixed(2)}
              </span>
              <span className="score-overview__label">Điểm rủi ro tổng</span>
            </div>
            <div className="score-overview__details">
              <ScoreRow label="Độc hại" value={aggregate.avg_toxicity} />
              <ScoreRow label="Spam" value={aggregate.avg_spam} />
              <ScoreRow label="Thao túng" value={aggregate.avg_manipulation} />
              <ScoreRow label="Cực đoan" value={aggregate.avg_extremism_risk} />
            </div>
          </div>
        </section>
      )}

      {user.sessions.length > 0 && (
        <section className="card">
          <h2 className="section-title">Lịch sử phiên ({user.sessions.length} phiên)</h2>
          <div className="session-table__scroll">
            <table className="session-table">
              <thead>
                <tr>
                  <th>Điểm rủi ro</th>
                  <th>Mức độ</th>
                  <th>Bài đăng</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {user.sessions.map((s) => (
                  <tr key={s.session_id}>
                    <td
                      data-tooltip-id="session-score-tip"
                      data-tooltip-content={JSON.stringify({
                        toxicity: Number(s.avg_toxicity),
                        spam: Number(s.avg_spam),
                        manipulation: Number(s.avg_manipulation),
                        extremism: Number(s.avg_extremism_risk),
                      })}
                      className="session-score-cell"
                    >
                      <FiInfo className="session-score-cell__icon" />
                      {Number(s.overall_risk_score).toFixed(2)}
                    </td>
                    <td>
                      <RiskBadge level={s.risk_level} />
                    </td>
                    <td>{s.post_count}</td>
                    <td>{formatDate(s.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Tooltip
            id="session-score-tip"
            render={({ content }) => {
              if (!content) return null;
              const d = JSON.parse(content);
              return (
                <div className="score-tooltip__box">
                  <div className="score-tooltip__row">
                    <span className="score-tooltip__name">Độc hại</span>
                    <span className="score-tooltip__val">{d.toxicity.toFixed(2)}</span>
                  </div>
                  <div className="score-tooltip__row">
                    <span className="score-tooltip__name">Spam</span>
                    <span className="score-tooltip__val">{d.spam.toFixed(2)}</span>
                  </div>
                  <div className="score-tooltip__row">
                    <span className="score-tooltip__name">Thao túng</span>
                    <span className="score-tooltip__val">{d.manipulation.toFixed(2)}</span>
                  </div>
                  <div className="score-tooltip__row">
                    <span className="score-tooltip__name">Cực đoan</span>
                    <span className="score-tooltip__val">{d.extremism.toFixed(2)}</span>
                  </div>
                </div>
              );
            }}
          />
        </section>
      )}

      <section className="card">
        <h2 className="section-title">
          Bài đăng ({posts.total} tổng
          {posts.posts.length < posts.total
            ? `, hiển thị ${posts.posts.length}`
            : ""}
          )
        </h2>
        {posts.posts.length === 0 ? (
          <p className="detail__empty">Chưa có bài đăng nào.</p>
        ) : (
          <div className="comment-table__scroll">
            <table className="comment-table">
              <thead>
                <tr>
                  <th>Nội dung bài đăng</th>
                  <th>Thời gian thu thập</th>
                </tr>
              </thead>
              <tbody>
                {posts.posts.map((p) => (
                  <tr key={p.post_id}>
                    <td className="comment-table__content">{p.content}</td>
                    <td className="comment-table__time">{formatDate(p.collected_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
