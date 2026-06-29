function shortLabel(sourceUrl) {
  if (!sourceUrl) return "Không rõ nguồn";
  try {
    const u = new URL(sourceUrl);
    const match = u.pathname.match(/\/groups\/([^/]+)/);
    return match ? `Group ${match[1]}` : `${u.hostname}${u.pathname}`;
  } catch {
    return sourceUrl;
  }
}

// Hiển thị mọi session đang chạy (mỗi tab một session độc lập), cho phép
// chuyển qua xem kết quả của session khác và dừng đúng session đó - không
// còn phụ thuộc vào việc tab đó có đang active hay không.
function RunningSessionsList({ sessions, viewingTabId, currentTabId, onView, onStop }) {
  if (!sessions.length) return null;

  return (
    <div className="running-sessions">
      <ul className="running-sessions__list">
        {sessions.map(({ tabId, sessionId, sourceUrl, acceptedCount }) => (
          <li
            key={tabId}
            className={`running-sessions__item ${
              tabId === viewingTabId ? "running-sessions__item--active" : ""
            }`}
          >
            <button type="button" className="running-sessions__label" onClick={() => onView(tabId)}>
              {tabId === currentTabId && <span className="running-sessions__tag">Tab hiện tại</span>}
              <span className="running-sessions__name">{shortLabel(sourceUrl)}</span>
              <span className="running-sessions__count">{acceptedCount || 0} bài</span>
            </button>
            <button
              type="button"
              className="btn btn--danger running-sessions__stop"
              onClick={() => onStop(tabId, sessionId)}
              title="Dừng session này"
            >
              Dừng
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default RunningSessionsList;
