import * as api from "../api/client.js";
import { MESSAGE_TYPES } from "../utils/constants.js";

const LOG_PREFIX = "[SCA:background]";

let submittedCount = 0;

function updateBadge() {
  chrome.action.setBadgeText({ text: submittedCount > 0 ? String(submittedCount) : "" });
}

// Content scripts can't reliably fetch() the backend directly (Facebook's page
// CSP blocks requests to localhost), so the background worker acts as the API
// gateway for both the popup and the content script.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log(`${LOG_PREFIX} received ${message.type}`, message);

  (async () => {
    try {
      switch (message.type) {
        case MESSAGE_TYPES.CREATE_SESSION: {
          const data = await api.createSession(message.sourceUrl);
          submittedCount = 0;
          updateBadge();
          sendResponse({ ok: true, data });
          break;
        }
        case MESSAGE_TYPES.STOP_SESSION: {
          const data = await api.stopSession(message.sessionId);
          sendResponse({ ok: true, data });
          break;
        }
        case MESSAGE_TYPES.GET_RESULTS: {
          const data = await api.getResults(message.sessionId);
          sendResponse({ ok: true, data });
          break;
        }
        case MESSAGE_TYPES.SUBMIT_BATCH: {
          const data = await api.submitBatch(message.sessionId, message.items);
          submittedCount += data.accepted ?? 0;
          updateBadge();
          sendResponse({ ok: true, data });
          break;
        }
        default:
          console.warn(`${LOG_PREFIX} unknown message type: ${message.type}`);
          sendResponse({ ok: false, error: `Unknown message type: ${message.type}` });
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} error handling ${message.type}:`, error);
      sendResponse({ ok: false, error: error.message || String(error) });
    }
  })();

  return true; // keep the message channel open for the async sendResponse above
});

chrome.runtime.onInstalled.addListener(() => {
  console.log(`${LOG_PREFIX} extension installed/updated`);
  chrome.action.setBadgeBackgroundColor({ color: "#aa3bff" });
});
