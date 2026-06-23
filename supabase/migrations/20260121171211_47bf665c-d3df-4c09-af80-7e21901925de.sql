-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Users can insert their own usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Users can update their own usage" ON public.ai_usage;

-- Create permissive policies (default PERMISSIVE behavior)
CREATE POLICY "Users can view their own ai usage"
ON public.ai_usage
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ai usage"
ON public.ai_usage
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ai usage"
ON public.ai_usage
FOR UPDATE
USING (auth.uid() = user_id);