import { useEffect, useState } from "react";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import { FiAlertTriangle, FiAlertCircle, FiCheckCircle, FiClock, FiInfo } from "react-icons/fi";

import { BACKEND_BASE_URL } from "../utils/constants.js";

const POSTS_LIMIT = 20;

const RISK_LABEL = { low: "Thấp", medium: "Trung bình", high: "Cao" };

function RiskBadge({ level }) {
  return <span className={`risk-badge risk-badge--${level}`}>{RISK_LABEL[level] ?? level}</span>;
}

const POST_RISK_ICON = {
  high: FiAlertTriangle,
  medium: FiAlertCircle,
  low: FiCheckCircle,
};

// Điểm rủi ro tổng của 1 bài: icon + màu đổi theo mức độ cảnh báo. Bài chưa
// được AI phân tích (analysis == null) hiển thị trạng thái "đang chờ".
function PostRiskBadge({ analysis }) {
  if (!analysis) {
    return (
      <span className="post-risk post-risk--pending" title="Bài chưa được phân tích">
        <FiClock className="post-risk__icon" />
        —
      </span>
    );
  }
  const level = analysis.risk_level;
  const Icon = POST_RISK_ICON[level] ?? FiInfo;
  const title =
    `${RISK_LABEL[level] ?? level} (${analysis.overall_risk_score.toFixed(2)})` +
    (analysis.explanation ? `\n${analysis.explanation}` : "");
  return (
    <span className={`post-risk post-risk--${level}`} title={title}>
      <Icon className="post-risk__icon" />
      {analysis.overall_risk_score.toFixed(2)}
    </span>
  );
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

// Bỏ dấu + hạ chữ thường 1 ký tự để so khớp không phân biệt hoa/thường VÀ
// không phân biệt dấu tiếng Việt (é↔e, ô↔o, đ↔d...). NFD tách ký tự và dấu
// tổ hợp rồi loại dấu; đ/Đ không phân rã nên xử lý riêng.
function foldStr(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}

// Bọc các đoạn nội dung khớp từ khóa trong <mark>. Khớp không phân biệt
// hoa/thường và dấu — trùng hành vi lọc phía server. Giữ nguyên chuỗi gốc
// (kèm dấu) khi hiển thị bằng cách ánh xạ vị trí khớp trên chuỗi đã fold về
// chuỗi gốc. Trả về mảng node React.
function highlightContent(content, rawKeywords) {
  const list = (rawKeywords || "")
    .split(/[,\n]/)
    .map((k) => foldStr(k.trim()))
    .filter(Boolean);
  if (list.length === 0) return content;

  // Fold từng ký tự để giữ ánh xạ vị trí: idxMap[k] = chỉ số ký tự gốc tương
  // ứng với ký tự thứ k trong chuỗi đã fold.
  let folded = "";
  const idxMap = [];
  for (let i = 0; i < content.length; i += 1) {
    const f = foldStr(content[i]);
    for (const ch of f) {
      folded += ch;
      idxMap.push(i);
    }
  }

  // Tìm mọi khoảng khớp (theo tọa độ chuỗi fold) cho từng từ khóa.
  const ranges = [];
  for (const kw of list) {
    let from = 0;
    let idx = folded.indexOf(kw, from);
    while (idx !== -1) {
      ranges.push([idx, idx + kw.length]);
      from = idx + kw.length;
      idx = folded.indexOf(kw, from);
    }
  }
  if (ranges.length === 0) return content;

  // Gộp các khoảng chồng/liền nhau rồi ánh xạ về chỉ số chuỗi gốc.
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [s, e] of ranges) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }

  const nodes = [];
  let cursor = 0;
  merged.forEach(([fs, fe], k) => {
    const s = idxMap[fs];
    const e = idxMap[fe - 1] + 1;
    if (s > cursor) nodes.push(content.slice(cursor, s));
    nodes.push(
      <mark key={k} className="kw-highlight">
        {content.slice(s, e)}
      </mark>
    );
    cursor = e;
  });
  if (cursor < content.length) nodes.push(content.slice(cursor));
  return nodes;
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
  const [keywords, setKeywords] = useState(""); // bộ lọc từ khóa cho danh sách bài đăng

  // Thông tin user + lịch sử phiên: chỉ tải 1 lần theo userId.
  useEffect(() => {
    if (!userId) {
      setError("Thiếu tham số user_id trong URL.");
      return;
    }
    apiFetch(`/api/users/${userId}`)
      .then(setUser)
      .catch((err) => setError(err.message));
  }, [userId]);

  // Danh sách bài đăng: lọc phía server theo từ khóa (tìm trên toàn bộ bài của
  // user, kể cả >100 bài), chỉ lấy tối đa POSTS_LIMIT bài. Debounce 300ms để
  // không gọi API mỗi lần gõ phím.
  useEffect(() => {
    if (!userId) return;
    const handle = setTimeout(() => {
      const params = new URLSearchParams({ limit: String(POSTS_LIMIT) });
      const kw = keywords.trim();
      if (kw) params.set("keywords", kw);
      apiFetch(`/api/users/${userId}/posts?${params.toString()}`)
        .then((data) => {
          setPosts(data);
          setError(null);
        })
        .catch((err) => setError(err.message));
    }, 300);
    return () => clearTimeout(handle);
  }, [userId, keywords]);

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

  // Bộ lọc do server xử lý; `matched` = số bài khớp trên toàn bộ, `posts.posts`
  // = tối đa POSTS_LIMIT bài đang hiển thị.
  const hasFilter = keywords.trim().length > 0;
  const shownCount = posts.posts.length;

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
          {hasFilter
            ? `, ${posts.matched} khớp bộ lọc${
                posts.matched > shownCount ? `, hiển thị ${shownCount}` : ""
              }`
            : shownCount < posts.total
              ? `, hiển thị ${shownCount}`
              : ""}
          )
        </h2>

        <div className="keyword-filter">
          <input
            type="text"
            className="keyword-filter__input"
            placeholder="Lọc bài đăng theo từ khóa, VD: hồ chí minh, máy bay"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
          {hasFilter && (
            <button
              type="button"
              className="keyword-filter__clear"
              onClick={() => setKeywords("")}
            >
              Xóa lọc
            </button>
          )}
        </div>

        {posts.total === 0 ? (
          <p className="detail__empty">Chưa có bài đăng nào.</p>
        ) : shownCount === 0 ? (
          <p className="detail__empty">Không có bài đăng nào chứa từ khóa đã nhập.</p>
        ) : (
          <div className="comment-table__scroll">
            <table className="comment-table">
              <thead>
                <tr>
                  <th className="comment-table__risk-col">Rủi ro</th>
                  <th>Nội dung bài đăng</th>
                  <th>Ngày đăng</th>
                  <th>Thời gian thu thập</th>
                </tr>
              </thead>
              <tbody>
                {posts.posts.map((p) => (
                  <tr key={p.post_id}>
                    <td className="comment-table__risk-col">
                      <PostRiskBadge analysis={p.analysis} />
                    </td>
                    <td className="comment-table__content">
                      <div>{hasFilter ? highlightContent(p.content, keywords) : p.content}</div>
                      {p.post_url && (
                        <a
                          className="comment-table__link"
                          href={p.post_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Xem bài gốc ↗
                        </a>
                      )}
                    </td>
                    <td className="comment-table__time">{p.posted_at_text || "—"}</td>
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
