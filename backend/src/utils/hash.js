import { createHash } from "crypto";

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function userHash(profileUrl, displayName) {
  const identity = (profileUrl || displayName || "").trim().toLowerCase();
  return sha256(`facebook:${identity}`);
}

export function postHash(profileUrl, content) {
  const identity = (profileUrl || "").trim().toLowerCase();
  const normalizedContent = (content || "").trim();
  return sha256(`${identity}|${normalizedContent}`);
}

// Unlike commentHash, this ignores who posted the comment - used to cache AI
// analysis results so identical text reuses the same scores.
export function contentHash(content) {
  return sha256((content || "").trim());
}
