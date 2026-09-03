import {
  BATCH_SIZE,
  HIGHLIGHT_INTERVAL_MS,
  MESSAGE_TYPES,
  OBSERVER_DEBOUNCE_MS,
  SCAN_INTERVAL_MS,
} from "../utils/constants.js";
import { matchesKeywords, parseKeywords } from "../utils/keywords.js";
import { startAutoScroll, stopAutoScroll } from "./autoScroll.js";
import { collectVisiblePosts } from "./collector.js";
import { applyHighlights, clearHighlights } from "./highlighter.js";
import { startObserver, stopObserver } from "./observer.js";

const LOG_PREFIX = "[SCA:content]";

let sessionId = null;
let scanIntervalId = null;
let highlightIntervalId = null;
const seenKeys = new Set();
// Bộ lọc từ khóa do người dùng nhập ở popup trước khi bắt đầu. Rỗng = thu
// thập tất cả bài (hành vi mặc định cũ).
let keywordFilter = [];

function postKey(item) {
  return item.dom_key;
}

async function scanAndSubmit() {
  if (!sessionId) return;

  const visible = await collectVisiblePosts();
  const newItems = [];

  const MAX_CONTENT = 10000;

  let filteredOut = 0;
  for (const post of visible) {
    const key = postKey(post);
    if (seenKeys.has(key)) continue;
    // Không khớp bộ lọc từ khóa -> bỏ qua, KHÔNG đánh dấu seen để nếu nội dung
    // được mở rộng ("Xem thêm") ở lần quét sau thì vẫn có cơ hội khớp lại.
    if (!matchesKeywords(post.content, keywordFilter)) {
      filteredOut += 1;
      continue;
    }
    seenKeys.add(key);
    newItems.push({
      client_post_id: crypto.randomUUID(),
      ...post,
      content: post.content.slice(0, MAX_CONTENT),
    });
  }

  console.log(
    `${LOG_PREFIX} scan: found ${visible.length} visible, ${newItems.length} new` +
      (keywordFilter.length ? `, ${filteredOut} skipped by keyword filter` : "")
  );

  for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
    const items = newItems.slice(i, i + BATCH_SIZE);
    console.log(`${LOG_PREFIX} submitting batch of ${items.length} item(s)`);
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SUBMIT_BATCH, sessionId, items }, (response) => {
      if (!response?.ok) {
        console.error(`${LOG_PREFIX} batch submit failed:`, response?.error);
      } else {
        console.log(`${LOG_PREFIX} batch submit ok:`, response.data);
      }
    });
  }
}

// Pulls the latest per-user risk results and highlights matching post
// containers on the page, so moderators see risk levels without opening the
// popup.
function refreshHighlights() {
  if (!sessionId) return;

  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_RESULTS, sessionId }, (response) => {
    if (!response?.ok) {
      console.warn(`${LOG_PREFIX} highlight refresh failed:`, response?.error);
      return;
    }
    applyHighlights(response.data.users || []);
  });
}

function startCollection(newSessionId, rawKeywords) {
  keywordFilter = parseKeywords(rawKeywords);
  console.log(
    `${LOG_PREFIX} starting collection (session=${newSessionId}, keywords=${
      keywordFilter.length ? keywordFilter.join(" | ") : "(none)"
    })`
  );
  sessionId = newSessionId;
  seenKeys.clear();
  scanAndSubmit();
  scanIntervalId = setInterval(scanAndSubmit, SCAN_INTERVAL_MS);
  startObserver(scanAndSubmit, OBSERVER_DEBOUNCE_MS);
  startAutoScroll();
  refreshHighlights();
  highlightIntervalId = setInterval(refreshHighlights, HIGHLIGHT_INTERVAL_MS);
}

function stopCollection() {
  console.log(`${LOG_PREFIX} stopping collection`);
  sessionId = null;
  if (scanIntervalId) {
    clearInterval(scanIntervalId);
    scanIntervalId = null;
  }
  if (highlightIntervalId) {
    clearInterval(highlightIntervalId);
    highlightIntervalId = null;
  }
  keywordFilter = [];
  stopObserver();
  stopAutoScroll();
  clearHighlights();
}

// Idle until the popup tells us to start — must not auto-run on page load.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === MESSAGE_TYPES.START_COLLECTION) {
    startCollection(message.sessionId, message.keywords);
    sendResponse({ ok: true });
  } else if (message.type === MESSAGE_TYPES.STOP_COLLECTION) {
    stopCollection();
    sendResponse({ ok: true });
  }
});
