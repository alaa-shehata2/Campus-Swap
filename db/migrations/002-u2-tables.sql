-- Migration 002 (U2): proposals, exchanges, participant thread, auto-pause holds.
-- Additive: safe on U1 databases. Extract of db/schema.sql (U2-TABLES section).
-- Apply: docker exec -i campuswap-mysql mysql -ucampuswap -pcampuswap campuswap < db/migrations/002-u2-tables.sql

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

CREATE TABLE IF NOT EXISTS holds (
  listing_id CHAR(36) PRIMARY KEY,
  exchange_id CHAR(36) NOT NULL,
  CONSTRAINT fk_holds_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  CONSTRAINT fk_holds_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id) ON DELETE CASCADE
);
