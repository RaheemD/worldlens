-- Add INSERT policy for ai_usage table
CREATE POLICY "Users can insert their own usage"
ON public.ai_usage
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add UPDATE policy for ai_usage table
CREATE POLICY "Users can update their own usage"
ON public.ai_usage
FOR UPDATE
USING (auth.uid() = user_id);