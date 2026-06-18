-- CreateTable
CREATE TABLE `analysis_cache` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `content_hash` VARCHAR(128) NOT NULL,
    `toxicity_score` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `spam_score` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `manipulation_score` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `extremism_risk_score` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `sentiment_score` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `label` VARCHAR(100) NULL,
    `explanation` TEXT NULL,
    `model_name` VARCHAR(100) NULL,
    `hit_count` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `analysis_cache_content_hash_key`(`content_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
