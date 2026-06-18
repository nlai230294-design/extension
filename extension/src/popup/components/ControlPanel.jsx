const STATUS_LABELS = {
  idle: "Chưa bắt đầu",
  running: "Đang thu thập",
  stopped: "Đã dừng",
};

function ControlPanel({ status, onStart, onStop }) {
  const isRunning = status === "running";

  return (
    <div className="control-panel">
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
  );
}

export default ControlPanel;
