-- Add notification preferences column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"push": true, "email": false, "safety_alerts": true}'::jsonb;