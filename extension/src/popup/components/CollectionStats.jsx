function CollectionStats({ summary }) {
  if (!summary) return null;

  return (
    <div className="collection-stats">
      <div className="collection-stats__item">
        <span className="collection-stats__value">{summary.total_users}</span>
        <span className="collection-stats__label">Người dùng</span>
      </div>
      <div className="collection-stats__item">
        <span className="collection-stats__value">{summary.total_posts}</span>
        <span className="collection-stats__label">Bài đăng</span>
      </div>
      <div className="collection-stats__item">
        <span className="collection-stats__value">{summary.processed_posts}</span>
        <span className="collection-stats__label">Đã phân tích</span>
      </div>
    </div>
  );
}

export default CollectionStats;
