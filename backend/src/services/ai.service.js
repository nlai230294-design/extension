import { createHash } from "crypto";

import axios from "axios";

import { env } from "../config/env.js";
import { RISK_THRESHOLDS } from "../utils/constants.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("ai.service");

/* ============================================================================
 * MOCK PROVIDER (AI_PROVIDER=mock)
 *
 * Không gọi AI thật. Sinh điểm số "giả lập" bằng cách hash nội dung bài đăng
 * (cùng nội dung -> cùng điểm số mỗi lần, để kết quả ổn định khi test/dev mà
 * không cần API key và không tốn chi phí gọi model thật).
 * Chỉ dùng cho môi trường development/test — KHÔNG phản ánh rủi ro thật của
 * nội dung.
 * ========================================================================= */

const MOCK_MODEL_NAME = "mock-classifier-v1";

function pseudoScore(content, salt) {
  const digest = createHash("sha256").update(`${salt}:${content}`).digest("hex");
  const intVal = parseInt(digest.slice(0, 8), 16);
  return Number((intVal / 0xffffffff).toFixed(4));
}

function deriveLabel({ toxicity_score, spam_score, manipulation_score, extremism_risk_score }) {
  const signals = [
    ["toxic", toxicity_score],
    ["spam", spam_score],
    ["manipulative", manipulation_score],
    ["extremism_risk", extremism_risk_score],
  ];
  const active = signals.filter(([, score]) => score >= RISK_THRESHOLDS.highMin);
  if (active.length === 0) return "safe";
  if (active.length > 1) return "mixed";
  return active[0][0];
}

function mockAnalyzeOne(item) {
  const toxicity_score = pseudoScore(item.content, "toxicity");
  const spam_score = pseudoScore(item.content, "spam");
  const manipulation_score = pseudoScore(item.content, "manipulation");
  const extremism_risk_score = pseudoScore(item.content, "extremism");
  const sentiment_score = pseudoScore(item.content, "sentiment");

  const label = deriveLabel({
    toxicity_score,
    spam_score,
    manipulation_score,
    extremism_risk_score,
  });

  return {
    id: item.id,
    toxicity_score,
    spam_score,
    manipulation_score,
    extremism_risk_score,
    sentiment_score,
    label,
    explanation: `Phân tích mô phỏng (mock) dựa trên nội dung bài đăng. Nhãn được gán: ${label}.`,
    model_name: MOCK_MODEL_NAME,
  };
}

/* ============================================================================
 * OPENAI PROVIDER (AI_PROVIDER=openai)
 *
 * Gọi OpenAI Chat Completions API với Structured Outputs (response_format:
 * json_schema) để đảm bảo model luôn trả về đúng cấu trúc JSON mong muốn,
 * tránh phải parse text tự do.
 * ========================================================================= */

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_TIMEOUT_MS = 60_000;
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `Bạn là hệ thống kiểm duyệt nội dung mạng xã hội. Với mỗi bài đăng được cung cấp,
hãy đánh giá và trả về điểm số dạng số thực trong khoảng [0, 1] cho từng tiêu chí:
- toxicity_score: mức độ độc hại/xúc phạm/thù ghét.
- spam_score: mức độ là nội dung rác/quảng cáo/lừa đảo.
- manipulation_score: mức độ thao túng/lừa dối/gây hiểu lầm.
- extremism_risk_score: nguy cơ kích động cực đoan/bạo lực.
- sentiment_score: cảm xúc tổng thể (0 = rất tiêu cực, 0.5 = trung lập, 1 = rất tích cực).
Ngoài ra gán "label" là một trong: "safe", "toxic", "spam", "manipulative", "extremism_risk", "mixed".
Và "explanation" là giải thích ngắn gọn (1-2 câu, tiếng Việt) cho nhãn đã gán.
Trả lời cho TẤT CẢ bài đăng được cung cấp, giữ đúng "id" tương ứng.`;

// OpenAI Structured Outputs schema — ép model trả đúng hình dạng dữ liệu,
// tránh lỗi parse JSON tự do hoặc thiếu trường.
const ANALYSIS_RESPONSE_SCHEMA = {
  name: "post_analysis_batch",
  strict: true,
  schema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            toxicity_score: { type: "number" },
            spam_score: { type: "number" },
            manipulation_score: { type: "number" },
            extremism_risk_score: { type: "number" },
            sentiment_score: { type: "number" },
            label: {
              type: "string",
              enum: ["safe", "toxic", "spam", "manipulative", "extremism_risk", "mixed"],
            },
            explanation: { type: "string" },
          },
          required: [
            "id",
            "toxicity_score",
            "spam_score",
            "manipulation_score",
            "extremism_risk_score",
            "sentiment_score",
            "label",
            "explanation",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["results"],
    additionalProperties: false,
  },
};

// Decimal(5,4) trong DB chỉ chứa 0-1 cho các điểm số này — chặn lại để một
// phản hồi bất thường từ model không làm vỡ ràng buộc cột khi insert.
function clampScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Number(Math.min(1, Math.max(0, num)).toFixed(4));
}

// Gói lỗi axios/OpenAI thành thông tin có thể đọc được trong log: mã lỗi HTTP,
// "code"/"type" mà OpenAI trả về (ví dụ invalid_api_key, insufficient_quota,
// rate_limit_exceeded), và header Retry-After nếu bị rate-limit — đây là những
// thông tin axios không in ra khi chỉ log error.message mặc định.
function logOpenAIError(error, postIds, elapsedMs) {
  const idsLabel = `post(s) [${postIds.join(", ")}] sau ${elapsedMs}ms`;

  if (error.response) {
    const { status, headers, data } = error.response;
    const apiError = data?.error ?? {};
    const retryAfter = headers?.["retry-after"];

    logger.error(
      `OpenAI API lỗi khi phân tích ${idsLabel}: status=${status} code=${apiError.code ?? "?"} ` +
        `type=${apiError.type ?? "?"}${retryAfter ? ` retry-after=${retryAfter}s` : ""} ` +
        `message="${apiError.message ?? JSON.stringify(data)}"`
    );
    return new Error(
      `OpenAI API trả lỗi ${status} (${apiError.code ?? apiError.type ?? "unknown"}): ${apiError.message ?? "không có chi tiết"}`
    );
  }

  if (error.code === "ECONNABORTED" || /timeout/i.test(error.message)) {
    logger.error(`OpenAI request timeout khi phân tích ${idsLabel} (giới hạn ${OPENAI_TIMEOUT_MS}ms)`);
    return new Error(`OpenAI request timeout sau ${OPENAI_TIMEOUT_MS}ms`);
  }

  if (error instanceof SyntaxError) {
    logger.error(
      `Không parse được JSON phản hồi từ OpenAI khi phân tích ${idsLabel}: ${error.message}`
    );
    return new Error(`OpenAI trả về nội dung không phải JSON hợp lệ: ${error.message}`);
  }

  // Không có response (DNS, connection refused, lỗi mạng khác trước khi tới được OpenAI).
  logger.error(`Không gọi được OpenAI API khi phân tích ${idsLabel}: ${error.message}`);
  return error;
}

async function callOpenAI(items) {
  const userContent = JSON.stringify(items.map(({ id, content }) => ({ id, content })));
  const model = env.aiModel || DEFAULT_OPENAI_MODEL;
  const postIds = items.map((item) => item.id);
  const startedAt = Date.now();

  logger.info(`Gọi OpenAI model=${model} cho ${items.length} post(s) [${postIds.join(", ")}]`);

  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_schema", json_schema: ANALYSIS_RESPONSE_SCHEMA },
      },
      {
        headers: {
          Authorization: `Bearer ${env.aiApiKey}`,
          "Content-Type": "application/json",
        },
        timeout: OPENAI_TIMEOUT_MS,
      }
    );

    const elapsedMs = Date.now() - startedAt;
    const usage = response.data.usage;
    logger.info(
      `OpenAI phản hồi sau ${elapsedMs}ms` +
        (usage ? ` (prompt_tokens=${usage.prompt_tokens}, completion_tokens=${usage.completion_tokens})` : "")
    );

    const content = response.data.choices[0].message.content;
    return JSON.parse(content).results;
  } catch (error) {
    throw logOpenAIError(error, postIds, Date.now() - startedAt);
  }
}

function toOpenAiResult(raw, modelName) {
  return {
    id: String(raw.id),
    toxicity_score: clampScore(raw.toxicity_score),
    spam_score: clampScore(raw.spam_score),
    manipulation_score: clampScore(raw.manipulation_score),
    extremism_risk_score: clampScore(raw.extremism_risk_score),
    sentiment_score: clampScore(raw.sentiment_score),
    label: raw.label || "safe",
    explanation: raw.explanation || "",
    model_name: modelName,
  };
}

async function openaiAnalyzeBatch(items) {
  if (!env.aiApiKey) {
    throw new Error("AI_API_KEY chưa được cấu hình cho AI_PROVIDER=openai");
  }

  const modelName = env.aiModel || DEFAULT_OPENAI_MODEL;
  const rawResults = await callOpenAI(items);
  const byId = new Map(rawResults.map((r) => [String(r.id), r]));

  // Map theo đúng thứ tự items đầu vào — nếu model bỏ sót id nào thì coi như
  // "safe" thay vì làm rớt cả batch, vì lỗi mạng/parse đã throw ở callOpenAI rồi.
  return items.map((item) => {
    const raw = byId.get(String(item.id));
    if (!raw) {
      logger.warn(`OpenAI thiếu kết quả cho post #${item.id}, gán tạm "safe"`);
      return toOpenAiResult(
        { id: item.id, sentiment_score: 0.5, label: "safe", explanation: "Không nhận được kết quả từ AI." },
        modelName
      );
    }
    return toOpenAiResult(raw, modelName);
  });
}

/* ============================================================================
 * ENTRYPOINT — chọn provider theo AI_PROVIDER trong .env
 * ========================================================================= */

// Returns one result per input item, shaped like the AI prompt contract in the project
// spec (section 9.2): { id, *_score, label, explanation }.
export async function analyzeBatch(items) {
  logger.info(`AI_PROVIDER=${env.aiProvider}: analyzing ${items.length} post(s)`);

  if (env.aiProvider === "mock") {
    const results = items.map(mockAnalyzeOne);
    logger.info(`Done: ${results.map((r) => `#${r.id}=${r.label}`).join(", ")}`);
    return results;
  }

  if (env.aiProvider === "openai") {
    const results = await openaiAnalyzeBatch(items);
    logger.info(`Done: ${results.map((r) => `#${r.id}=${r.label}`).join(", ")}`);
    return results;
  }

  throw new Error(`AI_PROVIDER "${env.aiProvider}" is not implemented yet`);
}
