-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can manage all usage" ON public.ai_usage;

-- The ai_usage table will be managed exclusively via service_role in edge functions
-- Regular users can only SELECT their own records (policy already exists)
-- No additional policies needed as service_role bypasses RLS