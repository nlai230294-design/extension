import * as api from "../api/client.js";
import { MESSAGE_TYPES } from "../utils/constants.js";

const LOG_PREFIX = "[SCA:background]";

// { [tabId: string]: { sessionId, status, sourceUrl, startedAt, acceptedCount } }
// Lưu trong chrome.storage.local (không phải biến module) vì service worker
// MV3 bị unload sau ~30s idle - biến module sẽ mất, storage thì không. Đây
// cũng là cách duy nhất để theo dõi NHIỀU session đang chạy đồng thời ở
// nhiều tab khác nhau (trước đây chỉ có 1 session toàn cục).
const SESSIONS_KEY = "social_analyzer_sessions";

async function getSessionsMap() {
  const stored = await chrome.storage.local.get([SESSIONS_KEY]);
  return stored[SESSIONS_KEY] || {};
}

async function setSessionsMap(map) {
  await chrome.storage.local.set({ [SESSIONS_KEY]: map });
}

async function updateBadge() {
  const map = await getSessionsMap();
  const total = Object.values(map).reduce((sum, s) => sum + (s.acceptedCount || 0), 0);
  chrome.action.setBadgeText({ text: total > 0 ? String(total) : "" });
}

// Content scripts can't reliably fetch() the backend directly (Facebook's page
// CSP blocks requests to localhost), so the background worker acts as the API
// gateway for both the popup and the content script.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(`${LOG_PREFIX} received ${message.type}`, message);

  (async () => {
    try {
      switch (message.type) {
        case MESSAGE_TYPES.CREATE_SESSION: {
          const data = await api.createSession(message.sourceUrl);
          const map = await getSessionsMap();
          map[message.tabId] = {
            sessionId: data.session_id,
            status: data.status,
            sourceUrl: message.sourceUrl,
            startedAt: Date.now(),
            acceptedCount: 0,
          };
          await setSessionsMap(map);
          await updateBadge();
          sendResponse({ ok: true, data });
          break;
        }
        case MESSAGE_TYPES.STOP_SESSION: {
          const data = await api.stopSession(message.sessionId);
          const map = await getSessionsMap();
          delete map[message.tabId];
          await setSessionsMap(map);
          await updateBadge();
          sendResponse({ ok: true, data });
          break;
        }
        case MESSAGE_TYPES.STOP_ALL_SESSIONS: {
          const map = await getSessionsMap();
          const entries = Object.entries(map);
          await Promise.all(
            entries.map(async ([tabId, entry]) => {
              try {
                await api.stopSession(entry.sessionId);
              } catch (error) {
                console.warn(
                  `${LOG_PREFIX} failed to stop session ${entry.sessionId} (tab=${tabId}):`,
                  error.message
                );
              }
            })
          );
          // Ghi map rỗng một lần duy nhất sau khi tất cả lệnh stop hoàn tất,
          // tránh race condition đọc/sửa/ghi nếu xử lý từng tab riêng lẻ.
          await setSessionsMap({});
          await updateBadge();
          sendResponse({ ok: true, data: { stopped: entries.length } });
          break;
        }
        case MESSAGE_TYPES.GET_ACTIVE_SESSIONS: {
          const map = await getSessionsMap();
          sendResponse({ ok: true, data: map });
          break;
        }
        case MESSAGE_TYPES.GET_RESULTS: {
          const data = await api.getResults(message.sessionId);
          sendResponse({ ok: true, data });
          break;
        }
        case MESSAGE_TYPES.SUBMIT_BATCH: {
          const data = await api.submitBatch(message.sessionId, message.items);
          // sender.tab có giá trị vì message này luôn được gửi từ content
          // script (gắn với một tab cụ thể), khác với CREATE_SESSION/
          // STOP_SESSION gửi từ popup (không có sender.tab).
          const tabId = sender.tab?.id;
          if (tabId != null) {
            const map = await getSessionsMap();
            if (map[tabId]) {
              map[tabId].acceptedCount = (map[tabId].acceptedCount || 0) + (data.accepted ?? 0);
              await setSessionsMap(map);
            }
          }
          await updateBadge();
          sendResponse({ ok: true, data });
          break;
        }
        default:
          console.warn(`${LOG_PREFIX} unknown message type: ${message.type}`);
          sendResponse({ ok: false, error: `Unknown message type: ${message.type}` });
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} error handling ${message.type}:`, error);
      // Forward the HTTP status (when available) so the popup can tell a real
      // failure apart from "session not found" (404) and react accordingly.
      sendResponse({
        ok: false,
        error: error.message || String(error),
        status: error.response?.status,
      });
    }
  })();

  return true; // keep the message channel open for the async sendResponse above
});

// Tab bị đóng mà chưa bấm "Dừng" trong popup - tự đóng session ở backend
// (best-effort) để không kẹt mãi ở trạng thái "running", và dọn khỏi danh
// sách đang theo dõi.
chrome.tabs.onRemoved.addListener((tabId) => {
  (async () => {
    const map = await getSessionsMap();
    const entry = map[tabId];
    if (!entry) return;

    try {
      await api.stopSession(entry.sessionId);
    } catch (error) {
      console.warn(
        `${LOG_PREFIX} failed to auto-stop session for closed tab ${tabId}:`,
        error.message
      );
    }
    delete map[tabId];
    await setSessionsMap(map);
    await updateBadge();
  })();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log(`${LOG_PREFIX} extension installed/updated`);
  chrome.action.setBadgeBackgroundColor({ color: "#aa3bff" });
});
