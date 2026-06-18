-- Drop comment_analysis first (FK dependency on comments)
DROP TABLE IF EXISTS `comment_analysis`;

-- Drop comments
DROP TABLE IF EXISTS `comments`;

-- Create posts table
CREATE TABLE `posts` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `session_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `post_hash` VARCHAR(128) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `post_url` LONGTEXT NULL,
    `source_url` LONGTEXT NULL,
    `collected_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE INDEX `posts_post_hash_key`(`post_hash`),
    INDEX `posts_session_id_idx`(`session_id`),
    INDEX `posts_user_id_idx`(`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create post_analysis table
CREATE TABLE `post_analysis` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `post_id` BIGINT NOT NULL,
    `toxicity_score` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `spam_score` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `manipulation_score` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `extremism_risk_score` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `sentiment_score` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `label` VARCHAR(100) NULL,
    `explanation` LONGTEXT NULL,
    `model_name` VARCHAR(100) NULL,
    `raw_response` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE INDEX `post_analysis_post_id_key`(`post_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys for posts
ALTER TABLE `posts` ADD CONSTRAINT `posts_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `posts` ADD CONSTRAINT `posts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `social_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign key for post_analysis
ALTER TABLE `post_analysis` ADD CONSTRAINT `post_analysis_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rename comment_count to post_count in user_scores
ALTER TABLE `user_scores` CHANGE `comment_count` `post_count` INT NOT NULL DEFAULT 0;
