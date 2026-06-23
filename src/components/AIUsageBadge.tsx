import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useAIUsage } from "@/contexts/AIUsageContext";
import { cn } from "@/lib/utils";

interface AIUsageBadgeProps {
  className?: string;
  showLabel?: boolean;
}

export function AIUsageBadge({ className, showLabel = true }: AIUsageBadgeProps) {
  const { remaining, limit, usageCount, isAuthenticated, isLoading } = useAIUsage();

  if (isLoading) return null;

  const percentage = (remaining / limit) * 100;
  const isLow = remaining <= 1;
  const isEmpty = remaining === 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
        isEmpty 
          ? "bg-destructive/20 text-destructive" 
          : isLow 
            ? "bg-warning/20 text-warning" 
            : "bg-primary/20 text-primary",
        className
      )}
    >
      <Sparkles className="h-4 w-4" />
      
      {/* Visual Progress Bar */}
      <div className="flex items-center gap-1.5">
        <div className="flex gap-0.5">
          {Array.from({ length: limit }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "w-2 h-3 rounded-sm transition-colors",
                i < usageCount
                  ? "bg-muted-foreground/30" // Used
                  : isEmpty
                    ? "bg-destructive"
                    : isLow
                      ? "bg-warning"
                      : "bg-primary" // Remaining
              )}
            />
          ))}
        </div>
        
        {showLabel && (
          <span className="ml-1">
            {remaining}/{limit}
            {!isAuthenticated && remaining < limit && (
              <span className="text-xs opacity-70 ml-1">(sign in for more)</span>
            )}
          </span>
        )}
        {!showLabel && <span className="ml-1">{remaining}/{limit}</span>}
      </div>
    </motion.div>
  );
}
