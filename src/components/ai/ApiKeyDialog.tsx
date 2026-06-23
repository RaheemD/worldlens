import { useEffect, useState } from "react";
import { KeyRound, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  API_KEY_EVENT,
  fulfillApiKeyRequest,
  cancelApiKeyRequest,
  getOpenRouterKey,
} from "@/lib/openrouter";
import { toast } from "sonner";

/**
 * Global dialog that asks the user for their OpenRouter API key whenever an
 * AI feature needs one. It listens for the API_KEY_EVENT dispatched by
 * requestApiKey(). It can also be opened manually from Settings via the
 * "worldlens:request-api-key" event.
 */
export function ApiKeyDialog() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = () => {
      setValue(getOpenRouterKey());
      setOpen(true);
    };
    window.addEventListener(API_KEY_EVENT, handler as EventListener);
    return () => window.removeEventListener(API_KEY_EVENT, handler as EventListener);
  }, []);

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      toast.error("Please paste your OpenRouter API key");
      return;
    }
    setSaving(true);
    fulfillApiKeyRequest(trimmed);
    setSaving(false);
    setOpen(false);
    toast.success("API key saved on this device");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // Dialog dismissed without saving -> cancel any pending AI request.
      cancelApiKeyRequest();
    }
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Add your OpenRouter API key
          </DialogTitle>
          <DialogDescription>
            AI features (scan, translate, trip planning, safety) run with your own
            OpenRouter key. It is stored only in this browser and never uploaded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Input
            type="password"
            placeholder="sk-or-..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            className="h-12 bg-card border-border/50"
            autoFocus
          />

          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Get a free OpenRouter API key
            <ExternalLink className="h-3 w-3" />
          </a>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save & Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
