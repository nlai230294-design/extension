const STATUS_LABELS = {
  idle: "Chưa bắt đầu",
  running: "Đang thu thập",
  stopped: "Đã dừng",
};

function ControlPanel({ status, keywords, onKeywordsChange, onStart, onStop }) {
  const isRunning = status === "running";

  return (
    <div className="control-panel">
      <div className="control-panel__filter">
        <label className="control-panel__label" htmlFor="keyword-filter">
          Bộ lọc từ khóa
        </label>
        <input
          id="keyword-filter"
          type="text"
          className="control-panel__input"
          placeholder="VD: việt nam, máy bay, tàu"
          value={keywords}
          onChange={(e) => onKeywordsChange(e.target.value)}
          disabled={isRunning}
        />
        <span className="control-panel__hint">
          Chỉ phân tích bài chứa 1 trong các từ khóa (phân tách bằng dấu phẩy). Để trống = thu thập
          tất cả.
        </span>
      </div>

      <div className="control-panel__row">
        <div className="control-panel__buttons">
          <button type="button" className="btn btn--primary" onClick={onStart} disabled={isRunning}>
            Bắt đầu
          </button>
          <button type="button" className="btn btn--danger" onClick={onStop} disabled={!isRunning}>
            Dừng
          </button>
        </div>
        <span className={`status-pill status-pill--${status}`}>
          <span className="status-pill__dot" />
          {STATUS_LABELS[status] || status}
        </span>
      </div>
    </div>
  );
}

export default ControlPanel;
