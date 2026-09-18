-- CampusSwap pilot schema (MySQL 8 / MariaDB 10.6+ compatible).
-- Application-generated UUIDs (CHAR(36)) match the domain seams.
-- Timestamps: BIGINT millis for machine times, VARCHAR ISO-8601 for display dates.

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash CHAR(128) NOT NULL,
  password_salt CHAR(64) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  campus VARCHAR(120) NOT NULL DEFAULT 'KFS University',
  campus_verified TINYINT(1) NOT NULL DEFAULT 0,
  join_date VARCHAR(32) NOT NULL,
  completed_exchange_count INT NOT NULL DEFAULT 0,
  bio VARCHAR(500) NULL,
  skill_tags JSON NULL,
  availability_notes TEXT NULL,
  role ENUM('member','moderator') NOT NULL DEFAULT 'member',
  restriction ENUM('none','suspended','banned') NOT NULL DEFAULT 'none',
  deactivated TINYINT(1) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  created_at_ms BIGINT NOT NULL,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS blocks (
  owner_id CHAR(36) NOT NULL,
  other_id CHAR(36) NOT NULL,
  kind ENUM('block','mute') NOT NULL,
  PRIMARY KEY (owner_id, other_id, kind),
  CONSTRAINT fk_blocks_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_blocks_other FOREIGN KEY (other_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS listings (
  id CHAR(36) PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  side ENUM('offer','request') NOT NULL,
  kind ENUM('skill','item') NOT NULL,
  title VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(40) NOT NULL,
  zone VARCHAR(120) NOT NULL,
  availability TEXT NULL,
  images JSON NOT NULL,
  status ENUM('Draft','Active','Paused','Archived','Hidden') NOT NULL DEFAULT 'Active',
  modality ENUM('lend','give','swap') NULL,
  return_term TEXT NULL,
  counterpart_description TEXT NULL,
  created_at_ms BIGINT NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  CONSTRAINT fk_listings_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_listings_status_cat ON listings(status, category);
CREATE INDEX idx_listings_owner ON listings(owner_id);

-- U2-TABLES-BEGIN (additive): proposals, exchanges, participant thread, auto-pause holds.
-- Existing U1 databases apply db/migrations/002-u2-tables.sql instead.
-- Application-generated UUIDs (CHAR(36)) match the domain seams.

CREATE TABLE IF NOT EXISTS proposals (
  id CHAR(36) PRIMARY KEY,
  proposer_id CHAR(36) NOT NULL,
  counterparty_id CHAR(36) NOT NULL,
  side_a JSON NOT NULL,
  side_b JSON NOT NULL,
  terms TEXT NOT NULL,
  status ENUM('Proposed','Accepted','Declined','Expired','Withdrawn') NOT NULL DEFAULT 'Proposed',
  created_at_ms BIGINT NOT NULL,
  decided_at_ms BIGINT NULL,
  exchange_id CHAR(36) NULL,
  CONSTRAINT fk_proposals_proposer FOREIGN KEY (proposer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_proposals_counterparty FOREIGN KEY (counterparty_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_proposals_status ON proposals(status);

CREATE TABLE IF NOT EXISTS exchanges (
  id CHAR(36) PRIMARY KEY,
  proposal_id CHAR(36) NOT NULL,
  participant_a CHAR(36) NOT NULL,
  participant_b CHAR(36) NOT NULL,
  listing_ids JSON NOT NULL,
  terms TEXT NOT NULL,
  status ENUM('Scheduled','Completed','Cancelled','Disputed') NOT NULL DEFAULT 'Scheduled',
  schedule_at VARCHAR(32) NULL,
  schedule_place TEXT NULL,
  done_marked_by CHAR(36) NULL,
  done_marked_at_ms BIGINT NULL,
  cancel_reason VARCHAR(32) NULL,
  cancel_detail TEXT NULL,
  log JSON NOT NULL,
  created_at_ms BIGINT NOT NULL,
  CONSTRAINT fk_exchanges_proposal FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE,
  CONSTRAINT fk_exchanges_a FOREIGN KEY (participant_a) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_exchanges_b FOREIGN KEY (participant_b) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_exchanges_status ON exchanges(status);

CREATE TABLE IF NOT EXISTS messages (
  id CHAR(36) PRIMARY KEY,
  exchange_id CHAR(36) NOT NULL,
  sender_id CHAR(36) NOT NULL,
  text TEXT NOT NULL,
  created_at_ms BIGINT NOT NULL,
  CONSTRAINT fk_messages_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_messages_exchange ON messages(exchange_id, created_at_ms);

-- listingId → exchangeId holding it via accept auto-pause (lazy release).
CREATE TABLE IF NOT EXISTS holds (
  listing_id CHAR(36) PRIMARY KEY,
  exchange_id CHAR(36) NOT NULL,
  CONSTRAINT fk_holds_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  CONSTRAINT fk_holds_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id) ON DELETE CASCADE
);
-- U2-TABLES-END

-- U3-TABLES-BEGIN (additive): blind reviews, reports/moderation, notification inbox.
-- Existing databases apply db/migrations/003-u3-tables.sql instead.
-- Application-generated UUIDs (CHAR(36)) match the domain seams.

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

-- Report ids with an open case (purpose-bound reads, P-4).
CREATE TABLE IF NOT EXISTS open_cases (
  report_id CHAR(36) PRIMARY KEY,
  CONSTRAINT fk_open_cases_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

-- In-app inbox (FR-N-1). Best-effort sink: core flows never depend on it.
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
-- U3-TABLES-END
