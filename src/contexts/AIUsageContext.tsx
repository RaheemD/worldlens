import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";

const ANONYMOUS_LIMIT = 3;
const AUTHENTICATED_LIMIT = 5;
const SESSION_KEY = "worldlens_session_id";
const LOCAL_USAGE_KEY = "worldlens_ai_usage_anonymous";

interface UsageData {
  date: string;
  count: number;
}

interface AIUsageContextType {
  usageCount: number;
  limit: number;
  remaining: number;
  canUseAI: boolean;
  isLoading: boolean;
  incrementUsage: () => Promise<boolean>;
  checkUsage: () => { allowed: boolean; remaining: number };
  sessionId: string;
  isAuthenticated: boolean;
}

const AIUsageContext = createContext<AIUsageContextType | undefined>(undefined);

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

// Local storage only for anonymous users
function getLocalUsage(): UsageData {
  if (typeof window === "undefined") return { date: "", count: 0 };
  const today = new Date().toISOString().split("T")[0];
  const stored = localStorage.getItem(LOCAL_USAGE_KEY);
  
  if (stored) {
    try {
      const data = JSON.parse(stored) as UsageData;
      if (data.date === today) {
        return data;
      }
    } catch {
      // Invalid data, reset
    }
  }
  
  return { date: today, count: 0 };
}

function setLocalUsage(count: number): void {
  if (typeof window === "undefined") return;
  const today = new Date().toISOString().split("T")[0];
  localStorage.setItem(LOCAL_USAGE_KEY, JSON.stringify({ date: today, count }));
}

export function AIUsageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [usageCount, setUsageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionId] = useState(getSessionId);

  const limit = user ? AUTHENTICATED_LIMIT : ANONYMOUS_LIMIT;
  const remaining = Math.max(0, limit - usageCount);
  const canUseAI = remaining > 0;

  // Clean up old localStorage key on mount
  useEffect(() => {
    // Remove old localStorage key that might have stale data
    localStorage.removeItem("worldlens_ai_usage");
  }, []);

  // Fetch usage from database for authenticated users, localStorage for anonymous
  useEffect(() => {
    const fetchUsage = async () => {
      setIsLoading(true);
      
      if (user) {
        // Authenticated user - fetch from database
        const today = new Date().toISOString().split("T")[0];
        
        try {
          const { data, error } = await supabase
            .from("ai_usage")
            .select("call_count")
            .eq("user_id", user.id)
            .eq("date", today)
            .maybeSingle();
          
          if (error) {
            console.error("Error fetching AI usage:", error);
            // Default to 0 on error so user can still use AI
            setUsageCount(0);
          } else {
            console.log("AI usage fetched:", data);
            setUsageCount(data?.call_count || 0);
          }
        } catch (err) {
          console.error("Exception fetching AI usage:", err);
          setUsageCount(0);
        }
      } else {
        // Anonymous user - use localStorage
        const usage = getLocalUsage();
        setUsageCount(usage.count);
      }
      
      setIsLoading(false);
    };

    fetchUsage();
  }, [user]);

  const incrementUsage = useCallback(async (): Promise<boolean> => {
    if (user) {
      // Authenticated user - update database
      const today = new Date().toISOString().split("T")[0];
      
      try {
        // First check current usage
        const { data: existingData, error: fetchError } = await supabase
          .from("ai_usage")
          .select("id, call_count")
          .eq("user_id", user.id)
          .eq("date", today)
          .maybeSingle();
        
        if (fetchError) {
          console.error("Error checking AI usage:", fetchError);
        }
        
        const currentCount = existingData?.call_count || 0;
        console.log("Current AI usage count:", currentCount, "Limit:", AUTHENTICATED_LIMIT);
        
        if (currentCount >= AUTHENTICATED_LIMIT) {
          console.log("AI usage limit reached");
          return false;
        }
        
        const newCount = currentCount + 1;
        
        if (existingData) {
          // Update existing record
          const { error } = await supabase
            .from("ai_usage")
            .update({ call_count: newCount, updated_at: new Date().toISOString() })
            .eq("id", existingData.id);
          
          if (error) {
            console.error("Error updating AI usage:", error);
            // Allow usage on error to not block the user
            setUsageCount(newCount);
            return true;
          }
        } else {
          // Insert new record
          console.log("Inserting new AI usage record for user:", user.id);
          const { error } = await supabase
            .from("ai_usage")
            .insert({
              user_id: user.id,
              session_id: sessionId,
              date: today,
              call_count: 1
            });
          
          if (error) {
            console.error("Error inserting AI usage:", error);
            // Allow usage on error to not block the user
            setUsageCount(1);
            return true;
          }
        }
        
        setUsageCount(newCount);
        return true;
      } catch (err) {
        console.error("Exception in incrementUsage:", err);
        // Allow usage on exception to not block the user
        return true;
      }
    } else {
      // Anonymous user - use localStorage
      const currentUsage = getLocalUsage();
      
      if (currentUsage.count >= ANONYMOUS_LIMIT) {
        return false;
      }

      const newCount = currentUsage.count + 1;
      setLocalUsage(newCount);
      setUsageCount(newCount);
      
      return true;
    }
  }, [user, sessionId]);

  const checkUsage = useCallback((): { allowed: boolean; remaining: number } => {
    const currentRemaining = Math.max(0, limit - usageCount);
    return { 
      allowed: usageCount < limit, 
      remaining: currentRemaining 
    };
  }, [limit, usageCount]);

  return (
    <AIUsageContext.Provider 
      value={{ 
        usageCount, 
        limit, 
        remaining, 
        canUseAI, 
        isLoading, 
        incrementUsage, 
        checkUsage,
        sessionId,
        isAuthenticated: !!user 
      }}
    >
      {children}
    </AIUsageContext.Provider>
  );
}

export function useAIUsage() {
  const context = useContext(AIUsageContext);
  if (context === undefined) {
    throw new Error("useAIUsage must be used within an AIUsageProvider");
  }
  return context;
}
