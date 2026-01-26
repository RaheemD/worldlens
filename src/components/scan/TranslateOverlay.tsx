import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Languages, 
  Volume2, 
  Copy, 
  Loader2,
  Globe,
  Check,
  WifiOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { languages, getLanguageName } from "@/lib/languages";
import { cacheTranslation, getCachedTranslation, isOnline } from "@/lib/offlineStorage";

interface TranslateOverlayProps {
  extractedText: string;
  isOpen: boolean;
  onClose: () => void;
}

export function TranslateOverlay({ extractedText, isOpen, onClose }: TranslateOverlayProps) {
  const [targetLang, setTargetLang] = useState("en");
  const [translatedText, setTranslatedText] = useState("");
  const [pronunciation, setPronunciation] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleTranslate = async () => {
    if (!extractedText.trim()) return;

    setIsTranslating(true);
    setTranslatedText("");
    setPronunciation("");
    setIsFromCache(false);

    try {
      // Check cache first
      const cached = await getCachedTranslation(extractedText, 'auto', targetLang);
      if (cached) {
        setTranslatedText(cached);
        setIsFromCache(true);
        setIsTranslating(false);
        return;
      }

      // If offline and no cache, show error
      if (!isOnline()) {
        toast.error("You're offline and this translation isn't cached");
        setIsTranslating(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("translate", {
        body: { text: extractedText, targetLanguage: getLanguageName(targetLang) },
      });

      if (error) {
        if (error.message?.includes("429")) {
          toast.error("Rate limit exceeded. Please try again later.");
        } else if (error.message?.includes("402")) {
          toast.error("AI usage limit reached.");
        } else {
          toast.error("Translation failed. Please try again.");
        }
        return;
      }

      setTranslatedText(data.translation);
      if (data.pronunciation) {
        setPronunciation(data.pronunciation);
      }

      // Cache the translation for offline use
      await cacheTranslation(extractedText, data.translation, 'auto', targetLang);
    } catch (err) {
      console.error("Translation error:", err);
      toast.error("Failed to translate");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSpeak = async () => {
    if (!translatedText) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Speech synthesis isn't supported in this browser");
      return;
    }

    const synth = window.speechSynthesis;
    const langMap: Record<string, string> = {
      ja: "ja-JP", ko: "ko-KR", zh: "zh-CN", es: "es-ES", fr: "fr-FR",
      de: "de-DE", it: "it-IT", pt: "pt-PT", ru: "ru-RU", ar: "ar-SA",
      hi: "hi-IN", th: "th-TH", vi: "vi-VN", en: "en-US",
    };
    const utterance = new SpeechSynthesisUtterance(translatedText);
    const lang = langMap[targetLang] || `${targetLang}-${targetLang.toUpperCase()}`;
    utterance.lang = lang;

    if (synth.getVoices().length === 0) {
      await new Promise<void>((resolve) => {
        const handleVoicesChanged = () => {
          synth.removeEventListener("voiceschanged", handleVoicesChanged);
          resolve();
        };
        synth.addEventListener("voiceschanged", handleVoicesChanged);
      });
    }

    const voices = synth.getVoices();
    const matchedVoice =
      voices.find((voice) => voice.lang === lang) ||
      voices.find((voice) => voice.lang.startsWith(targetLang)) ||
      voices.find((voice) => voice.lang.startsWith(lang.split("-")[0]));

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    synth.cancel();
    setTimeout(() => synth.speak(utterance), 0);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(translatedText);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/80 flex items-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full bg-card rounded-t-3xl p-6 space-y-4 max-h-[80vh] overflow-auto"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Languages className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-lg">Translate Text</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Original Text */}
            <div className="bg-muted rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Detected Text</p>
              <p className="text-sm leading-relaxed">{extractedText}</p>
            </div>

            {/* Language Selector & Translate Button */}
            <div className="flex gap-3">
              <div className="flex-1">
                <Select value={targetLang} onValueChange={setTargetLang}>
                  <SelectTrigger className="bg-background">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name} ({lang.native})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="bg-gradient-to-r from-primary to-accent text-primary-foreground"
                onClick={handleTranslate}
                disabled={isTranslating}
              >
                {isTranslating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : offline ? (
                  <>
                    <WifiOff className="h-4 w-4 mr-2" />
                    Translate (Cached)
                  </>
                ) : (
                  <>
                    <Languages className="h-4 w-4 mr-2" />
                    Translate
                  </>
                )}
              </Button>
            </div>

            {(offline || isFromCache) && (
              <p className="text-xs text-muted-foreground text-center">
                {offline ? (
                  <span className="flex items-center justify-center gap-1">
                    <WifiOff className="h-3 w-3" /> Offline - using cached translations
                  </span>
                ) : (
                  "Retrieved from cache"
                )}
              </p>
            )}

            {/* Translation Result */}
            {translatedText && (
              <motion.div
                className="space-y-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">{getLanguageName(targetLang)}</p>
                  <p className="text-lg font-medium leading-relaxed">{translatedText}</p>
                  {pronunciation && (
                    <p className="text-sm text-muted-foreground mt-2 italic">{pronunciation}</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleSpeak}
                  >
                    <Volume2 className="h-4 w-4 mr-2" />
                    Speak
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 mr-2 text-success" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                    Copy
                  </Button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
