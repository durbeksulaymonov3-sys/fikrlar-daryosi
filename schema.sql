-- Fikrlar Daryosi uchun jadvallar. MySQL 5.7+ / 8.x

CREATE TABLE IF NOT EXISTS comments (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  visitor_id VARCHAR(40)  NOT NULL,
  name       VARCHAR(24)  NOT NULL,
  text       VARCHAR(280) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created (created_at),
  INDEX idx_visitor (visitor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS likes (
  comment_id INT UNSIGNED NOT NULL,
  visitor_id VARCHAR(40)  NOT NULL,
  PRIMARY KEY (comment_id, visitor_id),
  CONSTRAINT fk_likes_comment FOREIGN KEY (comment_id)
    REFERENCES comments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
