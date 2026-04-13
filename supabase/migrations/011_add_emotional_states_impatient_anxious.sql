-- Add new emotional_state enum values for trade journaling
-- Run this in Supabase SQL editor or via migration tooling

alter type emotional_state add value if not exists 'impatient';
alter type emotional_state add value if not exists 'anxious';
