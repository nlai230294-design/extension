import {
  AUTHOR_LINK_SELECTORS,
  POST_ATTACHMENT_HREF_PATTERNS,
  POST_CONTAINER_SELECTOR,
  POST_PERMALINK_PRIMARY_PATTERNS,
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

// Tham số cần GIỮ khi chuẩn hóa link (định danh bài/ảnh/video). Mọi tham số
// theo dõi khác (__cft__, __tn__, mibextid...) đều bị bỏ.
const KEEP_URL_PARAMS = ["story_fbid", "id", "fbid", "set", "v", "multi_permalinks"];

// Chuẩn hóa link: giữ origin + pathname + chỉ các tham số định danh trong
// KEEP_URL_PARAMS, để link ngắn gọn nhưng vẫn mở đúng bài/ảnh.
function normalizePostUrl(rawHref) {
  try {
    const u = new URL(rawHref, window.location.href);
    const keep = new URLSearchParams();
    for (const key of KEEP_URL_PARAMS) {
      if (u.searchParams.has(key)) keep.set(key, u.searchParams.get(key));
    }
    const qs = keep.toString();
    return u.origin + u.pathname + (qs ? `?${qs}` : "");
  } catch {
    return "";
  }
}

// ID nhóm từ URL trang hiện tại (nếu đang xem trong 1 group Facebook).
function groupIdFromLocation() {
  const m = window.location.pathname.match(/\/groups\/([^/]+)/);
  return m ? m[1] : null;
}

// Thử suy ra permalink BÀI VIẾT từ link ảnh/đính kèm của bài trong group.
// Link ảnh group có dạng /photo/?fbid=<ảnh>&set=gm.<postId> (gm = group media,
// pcb = photo comment...) trong đó <postId> chính là id story của bài -> dựng
// lại /groups/<groupId>/posts/<postId>/. Không suy ra được thì trả null.
function canonicalPostUrlFromAttachment(rawHref) {
  try {
    const u = new URL(rawHref, window.location.href);
    const set = u.searchParams.get("set") || "";
    const m = set.match(/^(?:gm|pcb)\.(\d+)/);
    const groupId = groupIdFromLocation();
    if (m && groupId) return `${u.origin}/groups/${groupId}/posts/${m[1]}/`;
    return null;
  } catch {
    return null;
  }
}

// Lấy các href hợp lệ (bỏ "#", "javascript:") trong container, dạng tuyệt đối.
function collectAnchorHrefs(container) {
  return Array.from(container.querySelectorAll("a[href]"))
    .filter((a) => {
      const raw = a.getAttribute("href") || "";
      return raw && !raw.startsWith("#") && !raw.startsWith("javascript");
    })
    .map((a) => a.href);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Chuỗi CÓ CẤU TRÚC thời gian thật (ngày tuyệt đối / giờ:phút / tương đối /
// "vừa xong"). Dùng để loại chuỗi rác do Facebook xáo trộn ký tự chống scrape
// (vd "eSspndoort83fgh..." — không khớp mẫu nào nên bị loại).
function isValidTimestampText(text) {
  if (!text) return false;
  const t = text.trim();
  if (!t || t.length > 60) return false;
  return (
    /\btháng\b|\bthg\b/i.test(t) || // ngày tuyệt đối VN
    /\d{1,2}:\d{2}/.test(t) || // có giờ:phút
    /^\d+\s*(giây|phút|giờ|ngày|tuần|năm)/i.test(t) || // tương đối VN
    /vừa xong|just now|hôm qua|yesterday/i.test(t)
  );
}

// Tìm link timestamp trong header bài = link permalink bài (chứa /posts/,
// /permalink/, story_fbid...). Facebook xáo trộn ký tự nên KHÔNG dựa vào text
// hiển thị để nhận diện; link permalink đầu tiên (trong header) chính là nó.
function findTimestampEl(container) {
  const anchors = Array.from(container.querySelectorAll("a[href]"));
  for (const a of anchors) {
    if (POST_PERMALINK_PRIMARY_PATTERNS.some((p) => (a.href || "").includes(p))) return a;
  }
  return null;
}

// Facebook xáo trộn các <span> ký tự của timestamp, nhưng gắn timestamp SẠCH
// vào một node ẩn được tham chiếu qua aria-labelledby (cho trình đọc màn hình).
// Đọc node đó để lấy chuỗi thời gian đúng thứ tự. Fallback: aria-label trực tiếp.
function resolveAriaTimestamp(el) {
  const holder = el.matches("[aria-labelledby]") ? el : el.querySelector("[aria-labelledby]");
  if (holder) {
    const ids = (holder.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
    const text = ids
      .map((id) => document.getElementById(id)?.textContent || "")
      .join(" ")
      .trim();
    if (text) return text;
  }
  const direct = (el.getAttribute("aria-label") || "").trim();
  return direct;
}

// Chuỗi trông giống NGÀY TUYỆT ĐỐI (có năm 4 chữ số, tên tháng, hoặc giờ:phút).
function looksLikeAbsoluteDate(text) {
  return /\b\d{4}\b|tháng|thg|\d{1,2}:\d{2}/i.test(text || "");
}

// Hover lên phần tử timestamp để ép Facebook render tooltip ngày đầy đủ, đọc
// nội dung tooltip rồi bỏ hover. Tooltip được FB gắn vào portal cuối <body>
// (thường là [role="tooltip"]). Trả "" nếu không xuất hiện trong thời hạn.
async function readTooltipDate(el) {
  const before = new Set(document.querySelectorAll('[role="tooltip"]'));
  const opts = { bubbles: true, cancelable: true, view: window };
  const fireMouse = (type) => el.dispatchEvent(new MouseEvent(type, opts));
  const firePointer = (type) => {
    try {
      el.dispatchEvent(new PointerEvent(type, opts));
    } catch {
      /* PointerEvent có thể không dựng được ở môi trường cũ */
    }
  };

  firePointer("pointerover");
  firePointer("pointerenter");
  fireMouse("mouseover");
  fireMouse("mouseenter");
  fireMouse("mousemove");

  let result = "";
  const deadline = Date.now() + 900;
  while (Date.now() < deadline) {
    await sleep(80);
    const fresh = Array.from(document.querySelectorAll('[role="tooltip"]')).find(
      (t) => !before.has(t) && looksLikeAbsoluteDate(t.textContent)
    );
    if (fresh) {
      result = fresh.textContent.trim();
      break;
    }
  }

  firePointer("pointerout");
  firePointer("pointerleave");
  fireMouse("mouseout");
  fireMouse("mouseleave");
  return result;
}

const pad2 = (n) => String(n).padStart(2, "0");

// Định dạng chuẩn của dự án: "HH:mm dd/MM/yyyy" (giờ địa phương của trình duyệt,
// khớp múi giờ Facebook đang hiển thị).
function formatDateTime(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} ${pad2(d.getDate())}/${pad2(
    d.getMonth() + 1
  )}/${d.getFullYear()}`;
}

// Chuẩn hóa mọi dạng timestamp của Facebook về "HH:mm dd/MM/yyyy":
//  - Ngày tuyệt đối: "Thứ Tư, 8 Tháng 7, 2026 lúc 18:49" -> "18:49 08/07/2026"
//  - Chỉ giờ: "18:45" -> hôm nay lúc 18:45
//  - "Vừa xong" -> đúng thời điểm hiện tại
//  - Tương đối: "2 giờ" -> hiện tại trừ đi 2 giờ (neo theo lúc thu thập)
// Không nhận dạng được thì giữ nguyên chuỗi gốc.
function normalizeTimestamp(raw, now = new Date()) {
  if (!raw) return "";
  const text = raw.replace(/\s+/g, " ").trim();

  // 1) Ngày tuyệt đối (có "Tháng <số>").
  if (/tháng\s*\d/i.test(text)) {
    const dm = text.match(/(\d{1,2})\s*tháng\s*(\d{1,2})/i);
    const ym = text.match(/\b(\d{4})\b/);
    const tm = text.match(/(\d{1,2}):(\d{2})/);
    if (dm) {
      const d = new Date(
        ym ? +ym[1] : now.getFullYear(),
        +dm[2] - 1,
        +dm[1],
        tm ? +tm[1] : 0,
        tm ? +tm[2] : 0
      );
      if (!Number.isNaN(d.getTime())) return formatDateTime(d);
    }
  }

  // 2) Chỉ có giờ "18:45" -> mặc định ngày hôm nay.
  const only = text.match(/^(\d{1,2}):(\d{2})$/);
  if (only) {
    return formatDateTime(
      new Date(now.getFullYear(), now.getMonth(), now.getDate(), +only[1], +only[2])
    );
  }

  // 3) "Vừa xong" / "just now".
  if (/vừa xong|just now/i.test(text)) return formatDateTime(now);

  // 4) Tương đối "X <đơn vị>" -> hiện tại trừ đi khoảng đó.
  const rel = text.match(
    /(\d+)\s*(giây|giay|phút|phut|giờ|gio|ngày|ngay|tuần|tuan|second|minute|min|hour|hr|day|week)s?/i
  );
  if (rel) {
    const n = +rel[1];
    const u = rel[2].toLowerCase();
    const d = new Date(now);
    if (/giây|giay|second/.test(u)) d.setSeconds(d.getSeconds() - n);
    else if (/phút|phut|minute|min/.test(u)) d.setMinutes(d.getMinutes() - n);
    else if (/giờ|gio|hour|hr/.test(u)) d.setHours(d.getHours() - n);
    else if (/ngày|ngay|day/.test(u)) d.setDate(d.getDate() - n);
    else if (/tuần|tuan|week/.test(u)) d.setDate(d.getDate() - 7 * n);
    return formatDateTime(d);
  }

  // 5) Không nhận dạng được -> giữ nguyên.
  return text;
}

// Lấy thời điểm đăng bài, đã chuẩn hóa về "HH:mm dd/MM/yyyy". Thứ tự nguồn:
//  1) aria-labelledby cho ra NGÀY TUYỆT ĐỐI -> dùng ngay (nhanh, không hover).
//  2) Bài mới: hover ép tooltip lấy ngày tuyệt đối.
//  3) aria (tương đối "3 giờ") -> quy đổi theo lúc thu thập.
//  4) text hiển thị nếu hợp lệ (bài cũ không bị xáo trộn).
// Không lấy được chuỗi hợp lệ thì trả "" (tránh lưu chuỗi rác bị xáo trộn).
async function getPostedAtText(container, allowHover) {
  const el = findTimestampEl(container);
  if (!el) return "";

  const aria = resolveAriaTimestamp(el);
  // 1) aria đã là ngày tuyệt đối (có "Tháng") -> chuẩn nhất, khỏi hover.
  if (/\btháng\b/i.test(aria)) return normalizeTimestamp(aria);

  // 2) Bài mới -> hover ép tooltip ngày tuyệt đối.
  if (allowHover) {
    const tooltip = await readTooltipDate(el);
    if (tooltip) return normalizeTimestamp(tooltip);
  }

  // 3) aria tương đối ("3 giờ", "18:45"...) -> quy đổi.
  if (isValidTimestampText(aria)) return normalizeTimestamp(aria);

  // 4) text hiển thị (chỉ dùng khi hợp lệ, tránh chuỗi xáo trộn).
  const visible = (el.textContent || "").trim();
  if (isValidTimestampText(visible)) return normalizeTimestamp(visible);

  return "";
}

// Tìm link bài của container. Ưu tiên tuyệt đối link BÀI THẬT (posts/permalink/
// story_fbid...). Nếu không có, mới dùng link đính kèm (ảnh/video) và cố suy ra
// permalink bài; nếu vẫn không được thì giữ link đính kèm còn tham số.
function getPostUrl(container) {
  const hrefs = collectAnchorHrefs(container);

  for (const pattern of POST_PERMALINK_PRIMARY_PATTERNS) {
    const hit = hrefs.find((h) => h.includes(pattern));
    if (hit) return normalizePostUrl(hit);
  }

  for (const pattern of POST_ATTACHMENT_HREF_PATTERNS) {
    const hit = hrefs.find((h) => h.includes(pattern));
    if (hit) return canonicalPostUrlFromAttachment(hit) || normalizePostUrl(hit);
  }

  return "";
}

// Scans top-level Facebook posts currently visible in the viewport.
export async function collectVisiblePosts() {
  const posts = queryAllPosts();
  const results = [];

  for (const container of posts) {
    if (!isInViewport(container)) continue;

    // Bài mới (chưa có scaKey): mới cần expand "Xem thêm" và hover ép tooltip
    // ngày. Bài cũ sẽ bị seenKeys lọc ở content.js nên không tốn 2 thao tác này.
    const isNew = !container.dataset.scaKey;
    if (isNew) {
      await expandSeeMore(container);
    }

    const content = extractText(container);
    if (!content) continue;

    if (isNew) {
      container.dataset.scaKey = crypto.randomUUID();
    }

    results.push({
      dom_key: container.dataset.scaKey,
      ...getAuthorInfo(container),
      content,
      post_url: getPostUrl(container),
      posted_at_text: await getPostedAtText(container, isNew),
      source_url: window.location.href,
    });
  }

  return results;
}
