-- Migration 002: add latex_history column to conversations table
-- Run this in the Supabase SQL editor for existing deployments.
-- New deployments can use schema.sql directly (already includes this column).

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS latex_history JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN conversations.latex_history IS 'Stack of previous LaTeX versions for undo/redo (list of {latex, timestamp, label})';
