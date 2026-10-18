CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
    display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
    username TEXT NOT NULL CHECK (length(trim(username)) > 0),
    password_hash TEXT NOT NULL,
    preferred_language TEXT NOT NULL DEFAULT 'id'
        CHECK (preferred_language IN ('id', 'zh-CN', 'en')),
    role TEXT NOT NULL DEFAULT 'member'
        CHECK (role IN ('admin', 'member')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, username),
    UNIQUE (id, workspace_id)
);

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
    type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
    title TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (created_by, workspace_id)
        REFERENCES users(id, workspace_id) ON DELETE RESTRICT,
    UNIQUE (id, workspace_id)
);

CREATE TABLE conversation_members (
    conversation_id UUID NOT NULL,
    user_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    member_role TEXT NOT NULL DEFAULT 'member'
        CHECK (member_role IN ('owner', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_read_at TIMESTAMPTZ,
    PRIMARY KEY (conversation_id, user_id),
    FOREIGN KEY (conversation_id, workspace_id)
        REFERENCES conversations(id, workspace_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, workspace_id)
        REFERENCES users(id, workspace_id) ON DELETE CASCADE
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    conversation_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    source_language TEXT NOT NULL
        CHECK (source_language IN ('id', 'zh-CN', 'en')),
    original_text TEXT NOT NULL CHECK (length(original_text) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    FOREIGN KEY (conversation_id, workspace_id)
        REFERENCES conversations(id, workspace_id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id, workspace_id)
        REFERENCES users(id, workspace_id) ON DELETE RESTRICT,
    UNIQUE (id, workspace_id)
);

CREATE TABLE message_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    message_id UUID NOT NULL,
    target_language TEXT NOT NULL
        CHECK (target_language IN ('id', 'zh-CN', 'en')),
    translated_text TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT,
    context_version INTEGER NOT NULL DEFAULT 1 CHECK (context_version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (message_id, workspace_id)
        REFERENCES messages(id, workspace_id) ON DELETE CASCADE,
    UNIQUE (message_id, target_language, context_version)
);

CREATE TABLE context_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    source_term TEXT NOT NULL CHECK (length(trim(source_term)) > 0),
    source_language TEXT NOT NULL
        CHECK (source_language IN ('id', 'zh-CN', 'en')),
    target_term TEXT NOT NULL CHECK (length(trim(target_term)) > 0),
    target_language TEXT NOT NULL
        CHECK (target_language IN ('id', 'zh-CN', 'en')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, source_term, source_language, target_language)
);

CREATE TABLE conversation_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    conversation_id UUID NOT NULL,
    summary_language TEXT NOT NULL
        CHECK (summary_language IN ('id', 'zh-CN', 'en')),
    summary_text TEXT NOT NULL,
    through_message_id UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (conversation_id, workspace_id)
        REFERENCES conversations(id, workspace_id) ON DELETE CASCADE,
    UNIQUE (conversation_id, summary_language)
);

CREATE TABLE translation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    message_id UUID NOT NULL,
    target_language TEXT NOT NULL
        CHECK (target_language IN ('id', 'zh-CN', 'en')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_at TIMESTAMPTZ,
    error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (message_id, workspace_id)
        REFERENCES messages(id, workspace_id) ON DELETE CASCADE,
    UNIQUE (message_id, target_language)
);

CREATE INDEX idx_users_workspace_active
    ON users (workspace_id, is_active);

CREATE INDEX idx_conversations_workspace_created
    ON conversations (workspace_id, created_at DESC);

CREATE INDEX idx_conversation_members_user
    ON conversation_members (user_id, conversation_id);

CREATE INDEX idx_messages_conversation_time
    ON messages (conversation_id, created_at DESC);

CREATE INDEX idx_translations_message_target
    ON message_translations (message_id, target_language);

CREATE INDEX idx_context_terms_lookup
    ON context_terms (workspace_id, source_language, target_language);

CREATE INDEX idx_translation_jobs_pending
    ON translation_jobs (available_at, created_at)
    WHERE status IN ('pending', 'failed');
