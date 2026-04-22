-- Admin Functions for User Subscription Management
-- Run this in Supabase SQL Editor with Service Role key
-- These functions are designed to be called server-side only

-- 1. Function to grant PRO access to a user (admin-only)
CREATE OR REPLACE FUNCTION grant_pro_access(
  target_user_id UUID,
  notes TEXT DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  pro_tier_id UUID;
  free_tier_id UUID;
  current_tier VARCHAR;
BEGIN
  -- Admin guard (C3): reject non-admin callers at the database level
  IF NOT is_user_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Get tier IDs
  SELECT id INTO pro_tier_id FROM subscription_tiers WHERE name = 'pro' LIMIT 1;
  SELECT id INTO free_tier_id FROM subscription_tiers WHERE name = 'free' LIMIT 1;

  IF pro_tier_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Pro tier not found');
  END IF;

  -- Get current tier
  SELECT (SELECT name FROM subscription_tiers WHERE id = tier_id)
  INTO current_tier
  FROM user_subscriptions
  WHERE user_id = target_user_id;

  -- Default to free if no record exists
  IF current_tier IS NULL THEN
    current_tier := 'free';
  END IF;

  -- UPSERT: Insert if doesn't exist, update if exists
  INSERT INTO user_subscriptions (user_id, tier_id, status, start_date, renewal_date, created_at)
  VALUES (target_user_id, pro_tier_id, 'active', NOW(), NOW() + INTERVAL '1 year', NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    tier_id = EXCLUDED.tier_id,
    status = 'active',
    renewal_date = NOW() + INTERVAL '1 year',
    updated_at = NOW();

  -- Log the action
  INSERT INTO subscription_logs (
    user_id,
    action,
    status_before,
    status_after,
    details
  ) VALUES (
    target_user_id,
    'admin_granted_pro',
    current_tier,
    'active',
    jsonb_build_object(
      'reason', notes,
      'granted_at', NOW()::TEXT
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Pro access granted',
    'user_id', target_user_id,
    'new_tier', 'pro',
    'previous_tier', current_tier
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function to revoke PRO access (downgrade to FREE)
CREATE OR REPLACE FUNCTION revoke_pro_access(
  target_user_id UUID,
  notes TEXT DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  free_tier_id UUID;
  current_tier VARCHAR;
BEGIN
  -- Admin guard (C3): reject non-admin callers at the database level
  IF NOT is_user_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Get Free tier ID
  SELECT id INTO free_tier_id FROM subscription_tiers WHERE name = 'free' LIMIT 1;

  IF free_tier_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Free tier not found');
  END IF;

  -- Get current tier
  SELECT (SELECT name FROM subscription_tiers WHERE id = tier_id)
  INTO current_tier
  FROM user_subscriptions
  WHERE user_id = target_user_id;

  -- Default to pro if no record exists (so we can log it was revoked)
  IF current_tier IS NULL THEN
    current_tier := 'pro';
  END IF;

  -- UPSERT: Insert if doesn't exist, update if exists
  INSERT INTO user_subscriptions (user_id, tier_id, status, start_date, created_at)
  VALUES (target_user_id, free_tier_id, 'active', NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    tier_id = EXCLUDED.tier_id,
    status = 'active',
    renewal_date = NULL,
    stripe_subscription_id = NULL,
    updated_at = NOW();

  -- Log the action
  INSERT INTO subscription_logs (
    user_id,
    action,
    status_before,
    status_after,
    details
  ) VALUES (
    target_user_id,
    'admin_revoked_pro',
    current_tier,
    'active',
    jsonb_build_object(
      'reason', notes,
      'revoked_at', NOW()::TEXT
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Pro access revoked',
    'user_id', target_user_id,
    'new_tier', 'free',
    'previous_tier', current_tier
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function to get user subscription details (for admin search)
CREATE OR REPLACE FUNCTION get_user_subscription_info(
  search_email TEXT DEFAULT NULL,
  search_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  email VARCHAR,
  tier VARCHAR,
  status VARCHAR,
  start_date TIMESTAMP,
  renewal_date TIMESTAMP,
  trial_end_date TIMESTAMP,
  created_at TIMESTAMP,
  has_stripe_sub BOOLEAN
) AS $$
BEGIN
  -- Admin guard (C3): reject non-admin callers at the database level
  IF NOT is_user_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email,
    COALESCE(st.name, 'free'::VARCHAR),
    COALESCE(us.status, 'active'::VARCHAR),
    us.start_date,
    us.renewal_date,
    us.trial_end_date,
    us.created_at,
    us.stripe_subscription_id IS NOT NULL
  FROM auth.users u
  LEFT JOIN user_subscriptions us ON u.id = us.user_id
  LEFT JOIN subscription_tiers st ON us.tier_id = st.id
  WHERE
    (search_email IS NULL OR u.email ILIKE '%' || search_email || '%')
    OR (search_user_id IS NOT NULL AND u.id = search_user_id)
  ORDER BY u.created_at DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users.
-- The functions themselves enforce admin-only access via is_user_admin().
GRANT EXECUTE ON FUNCTION grant_pro_access TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_pro_access TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_subscription_info TO authenticated;
