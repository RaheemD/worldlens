-- Create table to track AI usage per user and anonymous sessions
CREATE TABLE public.ai_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  call_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_date UNIQUE (user_id, date),
  CONSTRAINT unique_session_date UNIQUE (session_id, date),
  CONSTRAINT either_user_or_session CHECK (
    (user_id IS NOT NULL AND session_id IS NULL) OR 
    (user_id IS NULL AND session_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view their own usage"
ON public.ai_usage
FOR SELECT
USING (auth.uid() = user_id);

-- Allow inserts/updates via edge functions (service role)
CREATE POLICY "Service role can manage all usage"
ON public.ai_usage
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_ai_usage_user_date ON public.ai_usage(user_id, date);
CREATE INDEX idx_ai_usage_session_date ON public.ai_usage(session_id, date);

-- Add trigger for updated_at
CREATE TRIGGER update_ai_usage_updated_at
BEFORE UPDATE ON public.ai_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();