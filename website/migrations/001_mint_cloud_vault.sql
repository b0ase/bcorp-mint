-- Mint Cloud Vault — Encrypted design storage
-- Run against Hetzner Supabase: ssh hetzner "docker exec supabase-db psql -U postgres -d postgres -c '...'"

CREATE TABLE IF NOT EXISTS mint_cloud_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES unified_users(id),
  encrypted_bundle JSONB NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  asset_type TEXT NOT NULL DEFAULT 'currency',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcv_user_id ON mint_cloud_vault(user_id);
CREATE INDEX IF NOT EXISTS idx_mcv_created_at ON mint_cloud_vault(created_at DESC);

ALTER TABLE mint_cloud_vault ENABLE ROW LEVEL SECURITY;

-- RLS: users can only access their own rows
CREATE POLICY mint_cloud_vault_user_access ON mint_cloud_vault
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
