import {
  AUTHOR_LINK_SELECTORS,
  POST_CONTAINER_SELECTOR,
  SEE_MORE_LABELS,
  TEXT_CONTENT_SELECTORS,
} from "./domSelectors.js";

function queryFirst(root, selectors) {
  for (const selector of selectors) {
    const el = root.querySelector(selector);
    if (el) return el;
  }
  return null;
}

// Returns only Facebook post containers, not comments.
// Posts have a [data-ad-rendering-role="profile_name"] block for the author;
// comment articles do not.
export function queryAllPosts() {
  return Array.from(document.querySelectorAll(POST_CONTAINER_SELECTOR)).filter(
    (el) => el.querySelector('[data-ad-rendering-role="profile_name"]') !== null
  );
}

function extractText(root) {
  for (const selector of TEXT_CONTENT_SELECTORS) {
    const el = root.querySelector(selector);
    const text = el?.textContent?.trim();
    if (text) return text;
  }
  return "";
}

function isInViewport(el) {
  const rect = el.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

// Clicks the "Xem thêm" / "See more" expand button if present and waits for
// Facebook's async DOM update before returning, so extractText reads full content.
async function expandSeeMore(container) {
  const textEl = queryFirst(container, TEXT_CONTENT_SELECTORS);
  if (!textEl) return;

  for (const btn of textEl.querySelectorAll('[role="button"]')) {
    if (SEE_MORE_LABELS.includes(btn.textContent?.trim())) {
      btn.click();
      await new Promise((resolve) => setTimeout(resolve, 300));
      return;
    }
  }
}

// Shared by the collector and the highlighter.
export function getAuthorInfo(container) {
  const authorLink = queryFirst(container, AUTHOR_LINK_SELECTORS);
  // Facebook post author name lives in a > b > span, not directly in the <a>.
  const nameEl = authorLink?.querySelector("b > span") ?? authorLink;

  // Strip Facebook tracking query params (?__cft__[...]) so the same user
  // gets the same profile_url hash across page loads.
  let profile_url = "";
  if (authorLink?.href) {
    try {
      const u = new URL(authorLink.href);
      profile_url = u.origin + u.pathname;
    } catch {
      profile_url = authorLink.href;
    }
  }

  return {
    display_name: nameEl?.textContent?.trim() || "",
    profile_url,
  };
}

// Scans top-level Facebook posts currently visible in the viewport.
export async function collectVisiblePosts() {
  const posts = queryAllPosts();
  const results = [];

  for (const container of posts) {
    if (!isInViewport(container)) continue;

    // Skip already-processed elements — dom_key in seenKeys will filter them
    // in content.js anyway, but skipping here avoids the expandSeeMore wait.
    if (!container.dataset.scaKey) {
      await expandSeeMore(container);
    }

    const content = extractText(container);
    if (!content) continue;

    if (!container.dataset.scaKey) {
      container.dataset.scaKey = crypto.randomUUID();
    }

    results.push({
      dom_key: container.dataset.scaKey,
      ...getAuthorInfo(container),
      content,
      source_url: window.location.href,
    });
  }

  return results;
}
