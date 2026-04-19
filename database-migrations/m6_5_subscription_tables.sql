-- M6.5 Subscription System Migration
-- Run this migration in Supabase SQL Editor
-- Tables: subscription_tiers, user_subscriptions, subscription_logs

-- 1. Create subscription_tiers table (reference table for tier definitions)
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL UNIQUE, -- 'free' or 'pro'
  display_name VARCHAR(100) NOT NULL, -- 'Free' or 'Professional'
  description TEXT,
  monthly_price NUMERIC(10, 2), -- NULL for free tier
  yearly_price NUMERIC(10, 2), -- NULL for free tier
  features JSONB DEFAULT '[]', -- Array of feature strings (for reference)
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

INSERT INTO subscription_tiers (name, display_name, description, monthly_price, yearly_price, features)
VALUES
  ('free', 'Free', 'Core trading logging and basic statistics', NULL, NULL, '[]'),
  ('pro', 'Professional', 'Advanced analytics, AI features, and strategy library', 9.99, 99.00, '[]')
ON CONFLICT (name) DO NOTHING;

-- 2. Create user_subscriptions table (user's current subscription status)
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES subscription_tiers(id),
  status VARCHAR(50) NOT NULL DEFAULT 'free', -- 'free', 'trialing', 'active', 'past_due', 'canceled'
  start_date TIMESTAMP NOT NULL DEFAULT now(),
  renewal_date TIMESTAMP, -- NULL if canceled or free tier
  trial_end_date TIMESTAMP, -- NULL if not trialing
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  discount_applied BOOLEAN DEFAULT false, -- Track if early adopter 50% discount applied
  discount_percentage NUMERIC(5, 2) DEFAULT 0, -- Discount % (e.g., 50 for 50% off)
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  CONSTRAINT unique_user_subscription UNIQUE(user_id)
);

CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_tier_id ON user_subscriptions(tier_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);

-- 3. Create subscription_logs table (audit trail of subscription changes)
CREATE TABLE IF NOT EXISTS subscription_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL, -- 'trial_started', 'upgraded_to_pro', 'downgraded_to_free', 'canceled', 'reactivated', 'payment_failed'
  details JSONB DEFAULT '{}', -- Store additional context (old tier, new tier, reason, etc)
  status_before VARCHAR(50),
  status_after VARCHAR(50),
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_subscription_logs_user_id ON subscription_logs(user_id);
CREATE INDEX idx_subscription_logs_action ON subscription_logs(action);
CREATE INDEX idx_subscription_logs_created_at ON subscription_logs(created_at);

-- 4. Create RLS Policies

-- user_subscriptions - Users can only view/edit their own subscription
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users cannot modify subscription"
  ON user_subscriptions FOR UPDATE
  USING (FALSE); -- Only backend (service role) can update subscriptions via webhook

CREATE POLICY "Users cannot delete subscription"
  ON user_subscriptions FOR DELETE
  USING (FALSE); -- Only backend can soft-delete via status change

-- subscription_logs - Users can only view their own logs
CREATE POLICY "Users can view own subscription logs"
  ON subscription_logs FOR SELECT
  USING (auth.uid() = user_id);

-- 5. Create function to log subscription changes
CREATE OR REPLACE FUNCTION log_subscription_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscription_logs (
    user_id,
    action,
    status_before,
    status_after,
    details
  ) VALUES (
    NEW.user_id,
    'subscription_updated',
    OLD.status,
    NEW.status,
    jsonb_build_object(
      'old_tier', (SELECT name FROM subscription_tiers WHERE id = OLD.tier_id),
      'new_tier', (SELECT name FROM subscription_tiers WHERE id = NEW.tier_id),
      'old_renewal', OLD.renewal_date,
      'new_renewal', NEW.renewal_date
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscription_change_trigger
AFTER UPDATE ON user_subscriptions
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.tier_id IS DISTINCT FROM NEW.tier_id)
EXECUTE FUNCTION log_subscription_change();

-- 6. Create auto-provisioning function for new users (default to free tier)
CREATE OR REPLACE FUNCTION provision_user_subscription()
RETURNS TRIGGER AS $$
DECLARE
  free_tier_id UUID;
BEGIN
  -- Get free tier ID
  SELECT id INTO free_tier_id FROM subscription_tiers WHERE name = 'free';

  -- Create free subscription for new user
  INSERT INTO user_subscriptions (
    user_id,
    tier_id,
    status
  ) VALUES (
    NEW.id,
    free_tier_id,
    'free'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger requires profiles table to exist
-- If you have profiles table, uncomment this:
-- CREATE TRIGGER provision_subscription_on_new_user
-- AFTER INSERT ON profiles
-- FOR EACH ROW
-- EXECUTE FUNCTION provision_user_subscription();

-- 7. View for user subscription details (with tier info)
CREATE OR REPLACE VIEW user_subscription_details AS
SELECT
  us.id,
  us.user_id,
  st.name as tier_name,
  st.display_name as tier_display_name,
  us.status,
  us.start_date,
  us.renewal_date,
  us.trial_end_date,
  st.monthly_price,
  st.yearly_price,
  us.discount_applied,
  us.discount_percentage,
  us.stripe_customer_id,
  us.created_at,
  us.updated_at,
  CASE
    WHEN us.status = 'trialing' THEN (us.trial_end_date - NOW())
    ELSE NULL
  END as time_remaining_in_trial
FROM user_subscriptions us
LEFT JOIN subscription_tiers st ON us.tier_id = st.id;

-- 8. Grants (for service role webhook handler)
-- Note: These are often handled automatically by Supabase, but included for completeness
GRANT SELECT ON subscription_tiers TO authenticated;
GRANT SELECT ON user_subscriptions TO authenticated;
GRANT SELECT ON subscription_logs TO authenticated;
GRANT SELECT ON user_subscription_details TO authenticated;

-- Service role (for webhook) - allow inserts/updates
-- GRANT INSERT, UPDATE ON user_subscriptions TO service_role;
-- GRANT INSERT ON subscription_logs TO service_role;

-- 9. Create helper function to get user tier
CREATE OR REPLACE FUNCTION get_user_tier(user_uuid UUID)
RETURNS VARCHAR AS $$
DECLARE
  tier_name VARCHAR;
BEGIN
  SELECT st.name INTO tier_name
  FROM user_subscriptions us
  LEFT JOIN subscription_tiers st ON us.tier_id = st.id
  WHERE us.user_id = user_uuid;

  RETURN COALESCE(tier_name, 'free');
END;
$$ LANGUAGE plpgsql STABLE;

-- 10. Create function to initiate trial for existing users
CREATE OR REPLACE FUNCTION start_pro_trial(user_uuid UUID, trial_days INT DEFAULT 7)
RETURNS BOOLEAN AS $$
DECLARE
  pro_tier_id UUID;
  current_tier VARCHAR;
BEGIN
  -- Get pro tier ID
  SELECT id INTO pro_tier_id FROM subscription_tiers WHERE name = 'pro';

  -- Get current tier
  SELECT st.name INTO current_tier
  FROM user_subscriptions us
  LEFT JOIN subscription_tiers st ON us.tier_id = st.id
  WHERE us.user_id = user_uuid;

  -- Only allow trial if already in free tier
  IF current_tier != 'free' THEN
    RETURN false;
  END IF;

  -- Update subscription to trialing
  UPDATE user_subscriptions
  SET
    tier_id = pro_tier_id,
    status = 'trialing',
    trial_end_date = NOW() + (trial_days || ' days')::INTERVAL,
    updated_at = NOW()
  WHERE user_id = user_uuid;

  -- Log the action
  INSERT INTO subscription_logs (user_id, action, status_before, status_after, details)
  VALUES (user_uuid, 'trial_started', 'free', 'trialing', jsonb_build_object('trial_days', trial_days));

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 11. Create function to upgrade to paid pro
CREATE OR REPLACE FUNCTION upgrade_to_pro(
  user_uuid UUID,
  stripe_customer_id_param VARCHAR,
  stripe_subscription_id_param VARCHAR,
  apply_discount BOOLEAN DEFAULT false,
  discount_pct NUMERIC DEFAULT 50
)
RETURNS BOOLEAN AS $$
DECLARE
  pro_tier_id UUID;
BEGIN
  -- Get pro tier ID
  SELECT id INTO pro_tier_id FROM subscription_tiers WHERE name = 'pro';

  -- Update subscription
  UPDATE user_subscriptions
  SET
    tier_id = pro_tier_id,
    status = 'active',
    trial_end_date = NULL,
    stripe_customer_id = stripe_customer_id_param,
    stripe_subscription_id = stripe_subscription_id_param,
    discount_applied = apply_discount,
    discount_percentage = CASE WHEN apply_discount THEN discount_pct ELSE 0 END,
    renewal_date = NOW() + '1 month'::INTERVAL,
    updated_at = NOW()
  WHERE user_id = user_uuid;

  -- Log the action
  INSERT INTO subscription_logs (user_id, action, status_before, status_after, details)
  VALUES (user_uuid, 'upgraded_to_pro', 'free', 'active', jsonb_build_object('discount_applied', apply_discount));

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 12. Create function to downgrade to free
CREATE OR REPLACE FUNCTION downgrade_to_free(user_uuid UUID, reason VARCHAR DEFAULT '')
RETURNS BOOLEAN AS $$
DECLARE
  free_tier_id UUID;
BEGIN
  -- Get free tier ID
  SELECT id INTO free_tier_id FROM subscription_tiers WHERE name = 'free';

  -- Update subscription
  UPDATE user_subscriptions
  SET
    tier_id = free_tier_id,
    status = 'free',
    trial_end_date = NULL,
    renewal_date = NULL,
    stripe_customer_id = NULL,
    stripe_subscription_id = NULL,
    discount_applied = false,
    discount_percentage = 0,
    updated_at = NOW()
  WHERE user_id = user_uuid;

  -- Log the action
  INSERT INTO subscription_logs (user_id, action, status_before, status_after, details)
  VALUES (user_uuid, 'downgraded_to_free', 'active', 'free', jsonb_build_object('reason', reason));

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- End of M6.5 Migration
