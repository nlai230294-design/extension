import StatusBadge from "./StatusBadge.jsx";

function detailUrl(userId) {
  return chrome.runtime.getURL(`detail.html?user_id=${userId}`);
}

function UserScoreTable({ users }) {
  if (users.length === 0) {
    return <p className="user-score-table__empty">Chưa có dữ liệu người dùng.</p>;
  }

  const sorted = [...users].sort((a, b) => b.overall_risk_score - a.overall_risk_score);

  return (
    <div className="user-score-table__scroll">
      <table className="user-score-table">
        <thead>
          <tr>
            <th>Người dùng</th>
            <th>Bài đăng</th>
            <th>Điểm rủi ro</th>
            <th>Mức độ</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((user) => (
            <tr key={user.user_id}>
              <td>
                <a href={detailUrl(user.user_id)} target="_blank" rel="noreferrer">
                  {user.display_name || "Không rõ"}
                </a>
                {user.profile_url && (
                  <a
                    href={user.profile_url}
                    target="_blank"
                    rel="noreferrer"
                    title="Hồ sơ Facebook"
                    className="user-score-table__fb-link"
                  >
                    ↗
                  </a>
                )}
              </td>
              <td>{user.post_count}</td>
              <td>{Number(user.overall_risk_score).toFixed(2)}</td>
              <td>
                <StatusBadge riskLevel={user.risk_level} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default UserScoreTable;
