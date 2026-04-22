-- M7 C2/C3: Admin Users Table & Auth Helper
-- Run this in Supabase SQL Editor BEFORE deploying backend changes.
--
-- After running, insert your admin user:
--   Find your user ID in Supabase Dashboard → Authentication → Users
--   INSERT INTO admin_users (user_id, role) VALUES ('<YOUR_USER_ID>', 'admin');

-- ─── 1. admin_users table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_users (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       VARCHAR(50) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Only admins can see who else is an admin
CREATE POLICY "Admins can view admin list"
  ON admin_users FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ─── 2. is_user_admin() helper ───────────────────────────────────────────────
-- SECURITY DEFINER so it can bypass RLS on admin_users.
-- Defaults to checking the caller (auth.uid()) when no argument is supplied.

CREATE OR REPLACE FUNCTION is_user_admin(check_user_id UUID DEFAULT NULL)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = COALESCE(check_user_id, auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_user_admin TO authenticated;
