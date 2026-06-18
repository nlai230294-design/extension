-- CreateTable
CREATE TABLE `sessions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `session_uuid` VARCHAR(64) NOT NULL,
    `source_url` TEXT NULL,
    `status` ENUM('running', 'completed', 'failed') NOT NULL DEFAULT 'running',
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ended_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sessions_session_uuid_key`(`session_uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_users` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(50) NOT NULL DEFAULT 'facebook',
    `external_user_id` VARCHAR(255) NULL,
    `display_name` VARCHAR(255) NULL,
    `profile_url` TEXT NULL,
    `user_hash` VARCHAR(128) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `social_users_user_hash_key`(`user_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comments` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `session_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `comment_hash` VARCHAR(128) NOT NULL,
    `content` TEXT NOT NULL,
    `post_context` TEXT NULL,
    `source_url` TEXT NULL,
    `collected_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `comments_comment_hash_key`(`comment_hash`),
    INDEX `comments_session_id_idx`(`session_id`),
    INDEX `comments_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comment_analysis` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `comment_id` BIGINT NOT NULL,
    `toxicity_score` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `spam_score` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `manipulation_score` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `extremism_risk_score` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `sentiment_score` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `label` VARCHAR(100) NULL,
    `explanation` TEXT NULL,
    `model_name` VARCHAR(100) NULL,
    `raw_response` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `comment_analysis_comment_id_key`(`comment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_scores` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `session_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `avg_toxicity` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `max_toxicity` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `avg_spam` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `avg_manipulation` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `avg_extremism_risk` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `overall_risk_score` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `comment_count` INTEGER NOT NULL DEFAULT 0,
    `risk_level` ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'low',
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `unique_session_user`(`session_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `social_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comment_analysis` ADD CONSTRAINT `comment_analysis_comment_id_fkey` FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_scores` ADD CONSTRAINT `user_scores_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_scores` ADD CONSTRAINT `user_scores_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `social_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
