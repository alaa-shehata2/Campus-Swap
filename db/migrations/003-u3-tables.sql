-- Migration 003 (U3): blind reviews, reports/moderation, notification inbox.
-- Additive: safe on U2 databases. Extract of db/schema.sql (U3-TABLES section).
-- Apply: docker exec -i campuswap-mysql mysql -ucampuswap -pcampuswap campuswap < db/migrations/003-u3-tables.sql

CREATE TABLE IF NOT EXISTS reviews (
  id CHAR(36) PRIMARY KEY,
  exchange_id CHAR(36) NOT NULL,
  reviewer_id CHAR(36) NOT NULL,
  reviewee_id CHAR(36) NOT NULL,
  score TINYINT NOT NULL,
  text TEXT NULL,
  status ENUM('Hidden','Published','Voided') NOT NULL DEFAULT 'Hidden',
  submitted_at_ms BIGINT NOT NULL,
  edited_at_ms BIGINT NULL,
  published_at_ms BIGINT NULL,
  response_text TEXT NULL,
  response_at_ms BIGINT NULL,
  response_edited_at_ms BIGINT NULL,
  void_by CHAR(36) NULL,
  void_reason TEXT NULL,
  void_at_ms BIGINT NULL,
  CONSTRAINT fk_reviews_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_reviewee FOREIGN KEY (reviewee_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_review_per_exchange UNIQUE KEY (exchange_id, reviewer_id)
);
CREATE INDEX idx_reviews_reviewee ON reviews(reviewee_id, status);

CREATE TABLE IF NOT EXISTS reports (
  id CHAR(36) PRIMARY KEY,
  reporter_id CHAR(36) NOT NULL,
  target_type ENUM('listing','user') NOT NULL,
  target_id CHAR(36) NOT NULL,
  reason_code VARCHAR(32) NOT NULL,
  description TEXT NOT NULL,
  images JSON NOT NULL,
  status ENUM('Received','Under review','Resolved') NOT NULL DEFAULT 'Received',
  created_at_ms BIGINT NOT NULL,
  history JSON NOT NULL,
  escalated TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_reports_status ON reports(status);

CREATE TABLE IF NOT EXISTS sanctions (
  id CHAR(36) PRIMARY KEY,
  action VARCHAR(32) NOT NULL,
  target_type ENUM('listing','user') NOT NULL,
  target_id CHAR(36) NOT NULL,
  reason TEXT NOT NULL,
  actor CHAR(36) NOT NULL,
  at_ms BIGINT NOT NULL
);
CREATE INDEX idx_sanctions_target ON sanctions(target_type, target_id);

CREATE TABLE IF NOT EXISTS voids (
  id CHAR(36) PRIMARY KEY,
  review_id CHAR(36) NOT NULL,
  void_by CHAR(36) NOT NULL,
  reason TEXT NOT NULL,
  at_ms BIGINT NOT NULL,
  CONSTRAINT fk_voids_review FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS handovers (
  id CHAR(36) PRIMARY KEY,
  report_id CHAR(36) NOT NULL,
  handover_by CHAR(36) NOT NULL,
  at_ms BIGINT NOT NULL,
  evidence JSON NOT NULL,
  CONSTRAINT fk_handovers_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS open_cases (
  report_id CHAR(36) PRIMARY KEY,
  CONSTRAINT fk_open_cases_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  type VARCHAR(32) NOT NULL,
  ref VARCHAR(64) NOT NULL,
  created_at_ms BIGINT NOT NULL,
  read_at_ms BIGINT NULL,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at_ms);
