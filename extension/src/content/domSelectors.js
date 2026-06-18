// Facebook's class names are obfuscated and rotate frequently, so each role is
// matched against an ordered list of fallback selectors (first match wins).

// All [role="article"] elements on the page; top-level vs nested is filtered
// in queryAllPosts() in collector.js via parent traversal.
export const POST_CONTAINER_SELECTOR = 'div[class="x1n2onr6 xh8yej3 x1ja2u2z xod5an3"]';

export const AUTHOR_LINK_SELECTORS = [
  'h2 a[role="link"]',
  'h2 a[href*="/user/"]',
  'h2 a[href*="/profile.php"]',
  'a[role="link"][tabindex=0]'
];

export const TEXT_CONTENT_SELECTORS = [
  '[data-ad-comet-preview="message"]',
  '[data-ad-rendering-role="story_message"]',
  'div[dir="auto"][style*="text-align"]',
  'div[dir="auto"]',
];

// Text labels of the "See more" expand button across languages Facebook may render.
export const SEE_MORE_LABELS = ["Xem thêm", "See more"];
