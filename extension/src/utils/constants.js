export const BACKEND_BASE_URL = "http://localhost:3000";

export const BATCH_SIZE = 20;
export const SCAN_INTERVAL_MS = 5000;
export const POLL_INTERVAL_MS = 4000;

export const AUTO_SCROLL_INTERVAL_MS = 2000;
export const AUTO_SCROLL_STEP_PX = 600;
export const AUTO_SCROLL_PAUSE_MS = 3000;
export const OBSERVER_DEBOUNCE_MS = 1000;
export const HIGHLIGHT_INTERVAL_MS = 6000;

export const MESSAGE_TYPES = {
  CREATE_SESSION: "CREATE_SESSION",
  STOP_SESSION: "STOP_SESSION",
  GET_RESULTS: "GET_RESULTS",
  SUBMIT_BATCH: "SUBMIT_BATCH",
  START_COLLECTION: "START_COLLECTION",
  STOP_COLLECTION: "STOP_COLLECTION",
};

export const RISK_LEVELS = ["low", "medium", "high"];

export const FACEBOOK_GROUP_URL_PATTERN = /^https:\/\/[^/]*\.facebook\.com\/groups\//;
