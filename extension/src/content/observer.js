import { POST_CONTAINER_SELECTOR } from "./domSelectors.js";

const LOG_PREFIX = "[SCA:content]";

let observer = null;
let debounceId = null;

function isPostNode(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  return node.matches?.(POST_CONTAINER_SELECTOR) || node.querySelector?.(POST_CONTAINER_SELECTOR);
}

// Watches for new post containers being added to the page (e.g. via
// infinite scroll) and triggers onNewPosts, debounced so a burst of
// mutations only causes a single re-scan.
export function startObserver(onNewPosts, debounceMs) {
  if (observer) return;

  observer = new MutationObserver((mutations) => {
    const hasNewPost = mutations.some((mutation) =>
      Array.from(mutation.addedNodes).some(isPostNode)
    );
    if (!hasNewPost) return;

    if (debounceId) clearTimeout(debounceId);
    debounceId = setTimeout(() => {
      console.log(`${LOG_PREFIX} observer detected new posts, re-scanning`);
      onNewPosts();
    }, debounceMs);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  console.log(`${LOG_PREFIX} mutation observer started`);
}

export function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
    console.log(`${LOG_PREFIX} mutation observer stopped`);
  }
  if (debounceId) {
    clearTimeout(debounceId);
    debounceId = null;
  }
}
