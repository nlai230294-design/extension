import { prisma } from "../src/db/prisma.js";

await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
await prisma.$executeRawUnsafe("TRUNCATE TABLE post_analysis");
await prisma.$executeRawUnsafe("TRUNCATE TABLE user_scores");
await prisma.$executeRawUnsafe("TRUNCATE TABLE posts");
await prisma.$executeRawUnsafe("TRUNCATE TABLE analysis_cache");
await prisma.$executeRawUnsafe("TRUNCATE TABLE social_users");
await prisma.$executeRawUnsafe("TRUNCATE TABLE sessions");
await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");

console.log("All tables cleared.");
await prisma.$disconnect();
