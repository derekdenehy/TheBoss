-- Add conversations table (run in Supabase SQL Editor if you get "table 'conversations' not found")
-- Requires: users table already exists

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New conversation',
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    current_latex TEXT DEFAULT '',
    conversation_mode TEXT DEFAULT 'initial',
    plan_steps JSONB,
    current_step_index INTEGER DEFAULT -1,
    outline_state JSONB,
    outline_approved BOOLEAN DEFAULT false,
    uploaded_file_ids JSONB DEFAULT '[]'::jsonb,
    selected_template TEXT DEFAULT 'auto',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- RLS: users see only their own conversations
DROP POLICY IF EXISTS "users can view own conversations" ON conversations;
CREATE POLICY "users can view own conversations"
    ON conversations FOR SELECT
    USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "users can insert own conversations" ON conversations;
CREATE POLICY "users can insert own conversations"
    ON conversations FOR INSERT
    WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "users can update own conversations" ON conversations;
CREATE POLICY "users can update own conversations"
    ON conversations FOR UPDATE
    USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "users can delete own conversations" ON conversations;
CREATE POLICY "users can delete own conversations"
    ON conversations FOR DELETE
    USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "service role has full access to conversations" ON conversations;
CREATE POLICY "service role has full access to conversations"
    ON conversations FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE conversations IS 'user chat conversations with auto-save';
