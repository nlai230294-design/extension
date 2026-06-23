import "dotenv/config";

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  // 127.0.0.1 mặc định: chỉ Nginx (cùng máy) gọi được trực tiếp, không expose
  // Node ra internet - tránh bị truy cập vòng qua TLS termination của Nginx.
  host: process.env.HOST || "127.0.0.1",
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  aiProvider: process.env.AI_PROVIDER || "mock",
  aiApiKey: process.env.AI_API_KEY,
  aiModel: process.env.AI_MODEL,
  corsOrigin: (process.env.CORS_ORIGIN || "*")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
