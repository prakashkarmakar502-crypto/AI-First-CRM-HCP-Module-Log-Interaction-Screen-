-- HCP Module schema (MySQL 8+)

CREATE TABLE hcps (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  specialty     VARCHAR(255),
  institution   VARCHAR(255),
  npi_number    VARCHAR(32),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_hcp_name (name)
) ENGINE=InnoDB;

CREATE TABLE materials (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  type          ENUM('brochure','pdf','reprint','leave_behind','other') DEFAULT 'other',
  active        BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE samples (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  lot_number    VARCHAR(64),
  active        BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE interactions (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  hcp_id              BIGINT NOT NULL,
  rep_user_id         BIGINT NOT NULL,
  interaction_type    ENUM('Meeting','Call','Email','Conference') NOT NULL DEFAULT 'Meeting',
  occurred_on         DATE NOT NULL,
  occurred_at         TIME NOT NULL,
  topics_discussed    TEXT,
  sentiment           ENUM('Positive','Neutral','Negative') DEFAULT 'Neutral',
  outcomes            TEXT,
  follow_up_actions   TEXT,
  source              ENUM('form','chat','voice') NOT NULL DEFAULT 'form',
  raw_chat_transcript  JSON,               -- full agent conversation, for audit
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hcp_id) REFERENCES hcps(id),
  INDEX idx_interaction_hcp (hcp_id),
  INDEX idx_interaction_date (occurred_on)
) ENGINE=InnoDB;

CREATE TABLE interaction_attendees (
  interaction_id  BIGINT NOT NULL,
  attendee_name   VARCHAR(255) NOT NULL,
  PRIMARY KEY (interaction_id, attendee_name),
  FOREIGN KEY (interaction_id) REFERENCES interactions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE interaction_materials (
  interaction_id  BIGINT NOT NULL,
  material_id     BIGINT NOT NULL,
  PRIMARY KEY (interaction_id, material_id),
  FOREIGN KEY (interaction_id) REFERENCES interactions(id) ON DELETE CASCADE,
  FOREIGN KEY (material_id) REFERENCES materials(id)
) ENGINE=InnoDB;

CREATE TABLE interaction_samples (
  interaction_id  BIGINT NOT NULL,
  sample_id       BIGINT NOT NULL,
  quantity        INT DEFAULT 1,
  PRIMARY KEY (interaction_id, sample_id),
  FOREIGN KEY (interaction_id) REFERENCES interactions(id) ON DELETE CASCADE,
  FOREIGN KEY (sample_id) REFERENCES samples(id)
) ENGINE=InnoDB;

CREATE TABLE interaction_followups (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  interaction_id  BIGINT NOT NULL,
  description     VARCHAR(500) NOT NULL,
  suggested_by_ai BOOLEAN DEFAULT FALSE,
  accepted        BOOLEAN DEFAULT FALSE,
  due_date        DATE,
  FOREIGN KEY (interaction_id) REFERENCES interactions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Audit trail for the edit_interaction tool: every change to a saved
-- interaction is recorded here rather than silently overwritten, since
-- compliance needs to answer "why did this sentiment field change".
CREATE TABLE interaction_edit_log (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  interaction_id  BIGINT NOT NULL,
  field           VARCHAR(64) NOT NULL,
  operation       ENUM('replace','append','remove') NOT NULL,
  old_value       TEXT,
  new_value       TEXT,
  edited_by       ENUM('rep','ai_agent') NOT NULL DEFAULT 'ai_agent',
  edited_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (interaction_id) REFERENCES interactions(id) ON DELETE CASCADE,
  INDEX idx_edit_log_interaction (interaction_id)
) ENGINE=InnoDB;
