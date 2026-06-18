import { AUTO_SCROLL_INTERVAL_MS, AUTO_SCROLL_PAUSE_MS, AUTO_SCROLL_STEP_PX } from "../utils/constants.js";

const LOG_PREFIX = "[SCA:content]";

let scrollIntervalId = null;
let pauseTimerId = null;
let isPaused = false;

function onUserScroll() {
  if (!isPaused) {
    console.log(`${LOG_PREFIX} auto-scroll paused (user scrolling)`);
    isPaused = true;
  }
  clearTimeout(pauseTimerId);
  pauseTimerId = setTimeout(() => {
    isPaused = false;
    console.log(`${LOG_PREFIX} auto-scroll resumed`);
  }, AUTO_SCROLL_PAUSE_MS);
}

export function startAutoScroll() {
  if (scrollIntervalId) return;

  isPaused = false;
  window.addEventListener("wheel", onUserScroll, { passive: true });
  window.addEventListener("touchmove", onUserScroll, { passive: true });

  console.log(`${LOG_PREFIX} auto-scroll started`);
  scrollIntervalId = setInterval(() => {
    if (!isPaused) {
      window.scrollBy(0, AUTO_SCROLL_STEP_PX);
    }
  }, AUTO_SCROLL_INTERVAL_MS);
}

export function stopAutoScroll() {
  if (!scrollIntervalId) return;

  clearInterval(scrollIntervalId);
  clearTimeout(pauseTimerId);
  window.removeEventListener("wheel", onUserScroll);
  window.removeEventListener("touchmove", onUserScroll);
  scrollIntervalId = null;
  pauseTimerId = null;
  isPaused = false;

  console.log(`${LOG_PREFIX} auto-scroll stopped`);
}
