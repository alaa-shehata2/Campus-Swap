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
