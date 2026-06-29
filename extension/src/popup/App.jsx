import { useEffect, useState } from "react";

import { BACKEND_BASE_URL, FACEBOOK_GROUP_URL_PATTERN, MESSAGE_TYPES, POLL_INTERVAL_MS } from "../utils/constants.js";
import AllUsersTable from "./components/AllUsersTable.jsx";
import CollectionStats from "./components/CollectionStats.jsx";
import ControlPanel from "./components/ControlPanel.jsx";
import RiskFilter from "./components/RiskFilter.jsx";
import RunningSessionsList from "./components/RunningSessionsList.jsx";
import UserScoreTable from "./components/UserScoreTable.jsx";

const LOG_PREFIX = "[SCA:popup]";

function sendToBackground(message, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Background response timeout")),
      timeoutMs
    );
    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.ok) {
        const error = new Error(response?.error || "Unknown error");
        error.status = response?.status;
        reject(error);
        return;
      }
      resolve(response.data);
    });
  });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Không tìm thấy tab đang hoạt động");
  return tab;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// If Facebook navigated client-side after the page first loaded (or the
// extension was reloaded after the tab was already open), the content script
// from manifest's content_scripts never got injected and sendMessage fails
// with "Could not establish connection. Receiving end does not exist." -
// recover by injecting it on demand and retrying.
async function sendToTab(tabId, message) {
  const isNoReceiver = (e) => /Receiving end does not exist/i.test(e?.message || "");

  // The content script loader uses a dynamic import, so the onMessage listener
  // may not be ready immediately after document_idle fires. Retry a few times
  // before deciding injection is needed.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (err) {
      if (!isNoReceiver(err)) throw err;
      if (attempt < 3) await sleep(400);
    }
  }

  // Still not reachable — inject on demand (e.g. tab was open before extension loaded).
  const files = chrome.runtime.getManifest().content_scripts?.[0]?.js;
  if (files?.length) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files });
    } catch (injectErr) {
      // Script may already be injected but module not yet ready — log and continue.
      console.warn(`${LOG_PREFIX} executeScript:`, injectErr?.message);
    }
  }

  // Wait up to 2 s for the module to initialize after injection.
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await sleep(400);
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (retryErr) {
      if (!isNoReceiver(retryErr)) throw retryErr;
      if (attempt === 5) {
        throw new Error(
          "Không thể kết nối tới trang. Vui lòng tải lại trang Facebook (F5) rồi thử lại."
        );
      }
    }
  }
  return undefined;
}

function App() {
  const [activeTab, setActiveTab] = useState("session"); // UI tab: "session" | "all"
  const [currentTabId, setCurrentTabId] = useState(null); // tab Chrome bạn đang xem ngay bây giờ
  const [runningSessions, setRunningSessions] = useState({}); // { [tabId]: {sessionId, sourceUrl, acceptedCount, ...} }
  const [viewingTabId, setViewingTabId] = useState(null); // session nào đang hiển thị kết quả trong popup
  const [results, setResults] = useState(null);
  const [riskFilter, setRiskFilter] = useState("all");
  const [allUsers, setAllUsers] = useState(null);
  const [allUsersFilter, setAllUsersFilter] = useState("all");
  const [error, setError] = useState(null);

  const refreshRunningSessions = async () => {
    try {
      const map = await sendToBackground({ type: MESSAGE_TYPES.GET_ACTIVE_SESSIONS });
      setRunningSessions(map || {});
      return map || {};
    } catch (err) {
      console.warn(`${LOG_PREFIX} refreshRunningSessions failed:`, err.message);
      return {};
    }
  };

  const fetchResultsForSession = async (sessionId) => {
    try {
      const data = await sendToBackground({ type: MESSAGE_TYPES.GET_RESULTS, sessionId });
      setResults(data);
      setError(null);
    } catch (err) {
      if (err.status === 404) {
        // Session không còn tồn tại ở backend (ví dụ DB đã được reset) - đây
        // không phải lỗi cần báo cho người dùng, chỉ đơn giản là chưa có dữ liệu.
        console.warn(`${LOG_PREFIX} session ${sessionId} not found`);
        setResults(null);
        return;
      }
      console.error(`${LOG_PREFIX} fetchResultsForSession failed:`, err);
      setError(err.message);
    }
  };

  // Mount: mặc định LUÔN xem session của chính tab đang mở popup - không tự
  // động nhảy sang session của tab khác dù tab khác đó đang chạy, để tránh
  // hiện nhầm kết quả của session khác vào tab không liên quan.
  useEffect(() => {
    (async () => {
      const tab = await getActiveTab().catch(() => null);
      const tabId = tab ? String(tab.id) : null;
      if (tabId) {
        setCurrentTabId(tabId);
        setViewingTabId(tabId);
      }

      const map = await refreshRunningSessions();
      if (tabId && map[tabId]) return; // có session đang chạy cho tab này - poll effect sẽ tự fetch

      // Tab hiện tại không chạy gì. Nếu có session khác đang chạy ở tab khác,
      // KHÔNG tự ý hiện kết quả của session đó vào đây - giữ trống/idle.
      if (Object.keys(map).length > 0) return;

      // Không có session nào đang chạy ở bất kỳ đâu - thử nạp lại session gần
      // nhất đã hoàn tất (nói chung, không gắn với tab nào) để xem lại kết quả
      // cũ thay vì màn hình trống hoàn toàn.
      try {
        const res = await fetch(`${BACKEND_BASE_URL}/api/sessions?limit=10`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return;
        const list = await res.json();
        const last = list.find((s) => s.total_posts > 0);
        if (!last) return;
        console.log(`${LOG_PREFIX} loaded last completed session from backend:`, last.session_id);
        await fetchResultsForSession(last.session_id);
      } catch (err) {
        console.warn(`${LOG_PREFIX} could not load previous session:`, err.message);
      }
    })();
  }, []);

  const loadAllUsers = async () => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/users?limit=200`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return;
      const data = await res.json();
      setAllUsers(data);
    } catch (err) {
      console.warn(`${LOG_PREFIX} loadAllUsers failed:`, err.message);
    }
  };

  useEffect(() => {
    if (activeTab === "all") loadAllUsers();
  }, [activeTab]);

  // Poll: làm mới danh sách session đang chạy (để phát hiện tab bị đóng ở
  // nơi khác) và kết quả của session đang xem, nếu có.
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      const map = await refreshRunningSessions();
      if (cancelled) return;
      const entry = viewingTabId ? map[viewingTabId] : null;
      if (entry) await fetchResultsForSession(entry.sessionId);
    };

    console.log(`${LOG_PREFIX} starting polling (viewing=${viewingTabId})`);
    poll();
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [viewingTabId]);

  const handleStart = async () => {
    setError(null);
    try {
      const tab = await getActiveTab();
      if (!FACEBOOK_GROUP_URL_PATTERN.test(tab.url || "")) {
        throw new Error(
          "Vui lòng mở một bài viết trong nhóm Facebook (facebook.com/groups/...) trước khi bắt đầu."
        );
      }
      const tabId = String(tab.id);
      setCurrentTabId(tabId);

      if (runningSessions[tabId]) {
        // Tab này đã có session đang chạy rồi - chỉ chuyển sang xem nó.
        setViewingTabId(tabId);
        return;
      }

      console.log(`${LOG_PREFIX} starting session for ${tab.url}`);
      const data = await sendToBackground({
        type: MESSAGE_TYPES.CREATE_SESSION,
        sourceUrl: tab.url || "",
        tabId,
      });
      console.log(`${LOG_PREFIX} session created:`, data);
      await sendToTab(tab.id, { type: MESSAGE_TYPES.START_COLLECTION, sessionId: data.session_id });
      await refreshRunningSessions();
      setViewingTabId(tabId);
    } catch (err) {
      console.error(`${LOG_PREFIX} handleStart failed:`, err);
      setError(err.message);
    }
  };

  // Dùng chung cho cả nút "Dừng" của tab hiện tại và nút "Dừng" của từng dòng
  // trong danh sách "Đang chạy" - luôn nhận đúng tabId/sessionId cần dừng,
  // không còn dựa vào "tab đang active" hay state toàn cục dễ gây nhầm session.
  const handleStopSession = async (tabId, sessionId) => {
    setError(null);
    try {
      try {
        await sendToTab(Number(tabId), { type: MESSAGE_TYPES.STOP_COLLECTION });
      } catch (err) {
        // Best-effort - content script có thể đã không còn (tab đã đóng/điều hướng đi).
        console.warn(`${LOG_PREFIX} failed to notify content script of stop (tab=${tabId}):`, err);
      }
      console.log(`${LOG_PREFIX} stopping session ${sessionId} (tab=${tabId})`);
      await sendToBackground({ type: MESSAGE_TYPES.STOP_SESSION, sessionId, tabId });
      await refreshRunningSessions();
      if (tabId === viewingTabId) {
        // Lấy snapshot cuối cùng của ĐÚNG session vừa dừng - không tự chuyển
        // sang xem session khác, dù session khác vẫn đang chạy.
        await fetchResultsForSession(sessionId);
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} handleStopSession(${tabId}) failed:`, err);
      setError(err.message);
    }
  };

  const handleStop = () => {
    if (!currentTabId || !runningSessions[currentTabId]) return Promise.resolve();
    return handleStopSession(currentTabId, runningSessions[currentTabId].sessionId);
  };

  const handleStopAll = async () => {
    setError(null);
    const entries = Object.entries(runningSessions);
    if (entries.length === 0) return;
    try {
      await Promise.all(
        entries.map(([tabId]) =>
          sendToTab(Number(tabId), { type: MESSAGE_TYPES.STOP_COLLECTION }).catch((err) => {
            console.warn(`${LOG_PREFIX} failed to notify content script of stop (tab=${tabId}):`, err);
          })
        )
      );
      await sendToBackground({ type: MESSAGE_TYPES.STOP_ALL_SESSIONS });

      // Nếu session đang xem nằm trong số vừa dừng, lấy snapshot cuối cùng
      // của đúng nó - không tự chuyển sang xem gì khác.
      const viewingEntry = viewingTabId ? entries.find(([tabId]) => tabId === viewingTabId) : null;
      if (viewingEntry) await fetchResultsForSession(viewingEntry[1].sessionId);

      await refreshRunningSessions();
    } catch (err) {
      console.error(`${LOG_PREFIX} handleStopAll failed:`, err);
      setError(err.message);
    }
  };

  const filteredUsers = (results?.users || []).filter(
    (user) => riskFilter === "all" || user.risk_level === riskFilter
  );

  const filteredAllUsers = (allUsers || []).filter(
    (user) => allUsersFilter === "all" || user.latest_risk_level === allUsersFilter
  );

  const runningSessionRows = Object.entries(runningSessions).map(([tabId, entry]) => ({
    tabId,
    ...entry,
  }));
  const controlStatus = currentTabId && runningSessions[currentTabId] ? "running" : "idle";

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo">SCA</span>
          <h1>Social Post Analyzer</h1>
        </div>
        <p className="app__disclaimer">
          Kết quả phân tích AI chỉ mang tính tham khảo về nội dung, không kết luận về cá nhân.
          Cần kiểm duyệt viên xem xét trước khi hành động.
        </p>
      </header>

      <div className="tabs">
        <button
          className={`tabs__tab ${activeTab === "session" ? "tabs__tab--active" : ""}`}
          onClick={() => setActiveTab("session")}
        >
          Phiên hiện tại
        </button>
        <button
          className={`tabs__tab ${activeTab === "sessions" ? "tabs__tab--active" : ""}`}
          onClick={() => setActiveTab("sessions")}
        >
          Tất cả phiên
        </button>
      </div>

      <div className="tabs">
        <button
          className={`tabs__tab ${activeTab === "all" ? "tabs__tab--active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          Tổng hợp toàn hệ thống
        </button>
      </div>

      {error && <p className="app__error">{error}</p>}

      {activeTab === "session" && (
        <>
          <section className="card">
            <ControlPanel status={controlStatus} onStart={handleStart} onStop={handleStop} />
          </section>

          {results && (
            <>
              <section className="card">
                <CollectionStats summary={results.summary} />
              </section>
              <section className="card">
                <RiskFilter value={riskFilter} onChange={setRiskFilter} />
                <UserScoreTable users={filteredUsers} />
              </section>
            </>
          )}
        </>
      )}

      {activeTab === "sessions" && (
        <section className="card">
          <div className="tabs__toolbar">
            <span className="running-sessions__title">Đang chạy ({runningSessionRows.length})</span>
            <button
              type="button"
              className="btn btn--danger"
              onClick={handleStopAll}
              disabled={runningSessionRows.length === 0}
            >
              Dừng tất cả
            </button>
          </div>
          {runningSessionRows.length > 0 ? (
            <RunningSessionsList
              sessions={runningSessionRows}
              viewingTabId={viewingTabId}
              currentTabId={currentTabId}
              onView={(tabId) => {
                setViewingTabId(tabId);
                setActiveTab("session");
              }}
              onStop={handleStopSession}
            />
          ) : (
            <p className="running-sessions__empty">Không có session nào đang chạy.</p>
          )}
        </section>
      )}

      {activeTab === "all" && (
        <section className="card">
          <div className="tabs__toolbar">
            <RiskFilter value={allUsersFilter} onChange={setAllUsersFilter} />
            <button className="btn btn--secondary" onClick={loadAllUsers}>
              Làm mới
            </button>
          </div>
          <AllUsersTable users={filteredAllUsers} />
        </section>
      )}
    </div>
  );
}

export default App;
