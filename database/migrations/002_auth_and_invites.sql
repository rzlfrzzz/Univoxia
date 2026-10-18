ALTER TABLE workspaces
    ADD COLUMN invite_code TEXT NOT NULL
        DEFAULT upper(encode(gen_random_bytes(8), 'hex'));

CREATE UNIQUE INDEX idx_workspaces_invite_code
    ON workspaces (invite_code);

CREATE UNIQUE INDEX idx_users_username_global
    ON users (lower(username));

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_sessions_expiry
    ON user_sessions (expires_at);

ALTER TABLE conversation_summaries
    ADD CONSTRAINT fk_summary_through_message
    FOREIGN KEY (through_message_id, workspace_id)
    REFERENCES messages(id, workspace_id) ON DELETE SET NULL (through_message_id);
