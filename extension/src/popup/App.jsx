import { useEffect, useRef, useState } from "react";

import { BACKEND_BASE_URL, FACEBOOK_GROUP_URL_PATTERN, MESSAGE_TYPES, POLL_INTERVAL_MS } from "../utils/constants.js";
import AllUsersTable from "./components/AllUsersTable.jsx";
import CollectionStats from "./components/CollectionStats.jsx";
import ControlPanel from "./components/ControlPanel.jsx";
import RiskFilter from "./components/RiskFilter.jsx";
import UserScoreTable from "./components/UserScoreTable.jsx";

const STORAGE_KEY = "social_analyzer_session";
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
        reject(new Error(response?.error || "Unknown error"));
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
  const [activeTab, setActiveTab] = useState("session"); // "session" | "all"
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | running | stopped
  const [results, setResults] = useState(null);
  const [riskFilter, setRiskFilter] = useState("all");
  const [allUsers, setAllUsers] = useState(null);
  const [allUsersFilter, setAllUsersFilter] = useState("all");
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    (async () => {
      const stored = await new Promise((resolve) => chrome.storage.local.get([STORAGE_KEY], resolve));
      const saved = stored[STORAGE_KEY];

      if (saved?.sessionId) {
        console.log(`${LOG_PREFIX} restored session from storage:`, saved);
        setSessionId(saved.sessionId);
        setStatus(saved.status || "idle");
        fetchResults(saved.sessionId);
        return;
      }

      // No stored session — load the most recent completed session from backend.
      try {
        const res = await fetch(`${BACKEND_BASE_URL}/api/sessions?limit=10`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return;
        const sessions = await res.json();
        const last = sessions.find((s) => s.total_posts > 0);
        if (!last) return;
        console.log(`${LOG_PREFIX} loaded last session from backend:`, last.session_id);
        setSessionId(last.session_id);
        setStatus("stopped");
        fetchResults(last.session_id);
      } catch (err) {
        console.warn(`${LOG_PREFIX} could not load previous session:`, err.message);
      }
    })();
  }, []);

  useEffect(() => {
    chrome.storage.local.set({ [STORAGE_KEY]: { sessionId, status } });
  }, [sessionId, status]);

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

  const fetchResults = async (id) => {
    try {
      const data = await sendToBackground({ type: MESSAGE_TYPES.GET_RESULTS, sessionId: id });
      console.log(`${LOG_PREFIX} fetched results:`, data);
      setResults(data);
    } catch (err) {
      console.error(`${LOG_PREFIX} fetchResults failed:`, err);
      setError(err.message);
    }
  };

  useEffect(() => {
    if (status !== "running" || !sessionId) return undefined;

    let cancelled = false;
    const poll = () => {
      sendToBackground({ type: MESSAGE_TYPES.GET_RESULTS, sessionId })
        .then((data) => {
          if (!cancelled) {
            console.log(`${LOG_PREFIX} poll results:`, data);
            setResults(data);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            console.error(`${LOG_PREFIX} poll failed:`, err);
            setError(err.message);
          }
        });
    };

    console.log(`${LOG_PREFIX} starting polling (session=${sessionId})`);
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (pollRef.current) {
        console.log(`${LOG_PREFIX} stopping polling`);
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [status, sessionId]);

  const handleStart = async () => {
    setError(null);
    try {
      const tab = await getActiveTab();
      if (!FACEBOOK_GROUP_URL_PATTERN.test(tab.url || "")) {
        throw new Error(
          "Vui lòng mở một bài viết trong nhóm Facebook (facebook.com/groups/...) trước khi bắt đầu."
        );
      }
      console.log(`${LOG_PREFIX} starting session for ${tab.url}`);
      const data = await sendToBackground({
        type: MESSAGE_TYPES.CREATE_SESSION,
        sourceUrl: tab.url || "",
      });
      console.log(`${LOG_PREFIX} session created:`, data);
      setSessionId(data.session_id);
      setStatus("running");
      await sendToTab(tab.id, { type: MESSAGE_TYPES.START_COLLECTION, sessionId: data.session_id });
    } catch (err) {
      console.error(`${LOG_PREFIX} handleStart failed:`, err);
      setError(err.message);
    }
  };

  const handleStop = async () => {
    setError(null);
    try {
      const tab = await getActiveTab();
      try {
        await sendToTab(tab.id, { type: MESSAGE_TYPES.STOP_COLLECTION });
      } catch (err) {
        // Best-effort - the content script may already be gone (tab closed/navigated away).
        console.warn(`${LOG_PREFIX} failed to notify content script of stop:`, err);
      }
      if (sessionId) {
        console.log(`${LOG_PREFIX} stopping session ${sessionId}`);
        await sendToBackground({ type: MESSAGE_TYPES.STOP_SESSION, sessionId });
        await fetchResults(sessionId);
      }
      setStatus("stopped");
    } catch (err) {
      console.error(`${LOG_PREFIX} handleStop failed:`, err);
      setError(err.message);
    }
  };

  const filteredUsers = (results?.users || []).filter(
    (user) => riskFilter === "all" || user.risk_level === riskFilter
  );

  const filteredAllUsers = (allUsers || []).filter(
    (user) => allUsersFilter === "all" || user.latest_risk_level === allUsersFilter
  );

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
          Session hiện tại
        </button>
        <button
          className={`tabs__tab ${activeTab === "all" ? "tabs__tab--active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          Tổng hợp
        </button>
      </div>

      {activeTab === "session" && (
        <>
          <section className="card">
            <ControlPanel status={status} onStart={handleStart} onStop={handleStop} />
          </section>

          {error && <p className="app__error">{error}</p>}

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
