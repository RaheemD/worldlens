import { motion } from "framer-motion";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoiceInputButtonProps {
  isListening: boolean;
  isSupported: boolean;
  onStart: () => void;
  onStop: () => void;
  className?: string;
  size?: "sm" | "default" | "lg";
}

export function VoiceInputButton({
  isListening,
  isSupported,
  onStart,
  onStop,
  className,
  size = "default",
}: VoiceInputButtonProps) {
  if (!isSupported) {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled
        className={cn("text-muted-foreground", className)}
        title="Voice input not supported in this browser"
      >
        <MicOff className={size === "lg" ? "h-6 w-6" : "h-5 w-5"} />
      </Button>
    );
  }

  return (
    <motion.div
      animate={isListening ? { scale: [1, 1.1, 1] } : { scale: 1 }}
      transition={{ repeat: isListening ? Infinity : 0, duration: 1 }}
    >
      <Button
        variant={isListening ? "default" : "ghost"}
        size="icon"
        onClick={isListening ? onStop : onStart}
        className={cn(
          isListening 
            ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" 
            : "text-muted-foreground hover:text-foreground",
          className
        )}
        title={isListening ? "Stop recording" : "Start voice input"}
      >
        {isListening ? (
          <motion.div
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
          >
            <Mic className={size === "lg" ? "h-6 w-6" : "h-5 w-5"} />
          </motion.div>
        ) : (
          <Mic className={size === "lg" ? "h-6 w-6" : "h-5 w-5"} />
        )}
      </Button>
    </motion.div>
  );
}
