-- Add columns to trips table for storing AI-generated travel plans
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS ai_itinerary jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_must_try jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_packing_tips text[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_budget_estimate jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_overview text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_best_time_to_visit text DEFAULT NULL;