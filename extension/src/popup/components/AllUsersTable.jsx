import StatusBadge from "./StatusBadge.jsx";

function detailUrl(userId) {
  return chrome.runtime.getURL(`detail.html?user_id=${userId}`);
}

function AllUsersTable({ users }) {
  if (users.length === 0) {
    return <p className="user-score-table__empty">Chưa có dữ liệu tổng hợp.</p>;
  }

  return (
    <div className="user-score-table__scroll">
      <table className="user-score-table">
        <thead>
          <tr>
            <th>Người dùng</th>
            <th>Bài đăng</th>
            <th>Risk tối đa</th>
            <th>Mức độ</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
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
              <td>{user.total_post_count}</td>
              <td>{user.max_overall_risk_score.toFixed(2)}</td>
              <td>
                <StatusBadge riskLevel={user.latest_risk_level} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AllUsersTable;
