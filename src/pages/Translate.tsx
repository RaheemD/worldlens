import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Volume2, Copy, Loader2, AlertCircle, Globe, Mic } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AnimatedPage, fadeInUp, staggerContainer } from "@/components/AnimatedPage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAIUsage } from "@/contexts/AIUsageContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import { languages, getLanguageFromCountry, getLanguageName } from "@/lib/languages";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";

const quickPhrases = [
  { en: "Where is the bathroom?", category: "Essential" },
  { en: "How much does this cost?", category: "Shopping" },
  { en: "I need help", category: "Emergency" },
  { en: "Can I have the menu?", category: "Restaurant" },
  { en: "I am allergic to...", category: "Food" },
  { en: "Please take me to this address", category: "Transport" },
];

export default function Translate() {
  const { canUseAI, remaining, incrementUsage, isAuthenticated } = useAIUsage();
  const { profile } = useProfile();
  const { countryCode } = useGeolocation();
  
  const [inputText, setInputText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [pronunciation, setPronunciation] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [targetLang, setTargetLang] = useState("ja");
  
  // Voice input
  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported: voiceSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition("en-US");

  // Update input text when voice transcription changes
  useEffect(() => {
    if (transcript || interimTranscript) {
      setInputText(transcript + interimTranscript);
    }
  }, [transcript, interimTranscript]);

  // Auto-translate when voice input stops and we have transcript
  useEffect(() => {
    if (!isListening && transcript && !interimTranscript) {
      handleTranslate(transcript);
      resetTranscript();
    }
  }, [isListening, transcript, interimTranscript]);

  // Set initial target language based on location or profile
  useEffect(() => {
    if (countryCode) {
      const localLang = getLanguageFromCountry(countryCode);
      // Don't translate to English if user is in an English-speaking country
      if (localLang !== "en") {
        setTargetLang(localLang);
      }
    } else if (profile?.preferred_language && profile.preferred_language !== "en") {
      setTargetLang(profile.preferred_language);
    }
  }, [countryCode, profile?.preferred_language]);

  const handleTranslate = async (text?: string) => {
    const textToTranslate = text || inputText;
    if (!textToTranslate.trim()) return;

    if (!canUseAI) {
      toast.error(
        isAuthenticated 
          ? "Daily AI limit reached. Try again tomorrow!" 
          : "Daily limit reached. Sign in for more AI calls!"
      );
      return;
    }

    const allowed = await incrementUsage();
    if (!allowed) {
      toast.error("AI usage limit reached for today");
      return;
    }

    setIsTranslating(true);
    setInputText(textToTranslate);
    setTranslatedText("");
    setPronunciation("");

    try {
      const { data, error } = await supabase.functions.invoke("translate", {
        body: { text: textToTranslate, targetLanguage: getLanguageName(targetLang) },
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
    } catch (err) {
      console.error("Translation error:", err);
      toast.error("Failed to translate");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSpeak = () => {
    if (!translatedText) return;
    const utterance = new SpeechSynthesisUtterance(translatedText);
    // Map language codes to speech synthesis language codes
    const langMap: Record<string, string> = {
      ja: "ja-JP", ko: "ko-KR", zh: "zh-CN", es: "es-ES", fr: "fr-FR",
      de: "de-DE", it: "it-IT", pt: "pt-PT", ru: "ru-RU", ar: "ar-SA",
      hi: "hi-IN", th: "th-TH", vi: "vi-VN",
    };
    utterance.lang = langMap[targetLang] || `${targetLang}-${targetLang.toUpperCase()}`;
    speechSynthesis.speak(utterance);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(translatedText);
    toast.success("Copied to clipboard");
  };

  return (
    <AppLayout title="Speak For Me">
      <AnimatedPage>
        <motion.div 
          className="px-4 py-4 space-y-6"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {/* Usage Warning */}
          {!canUseAI && (
            <motion.div 
              className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center gap-3"
              variants={fadeInUp}
            >
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">
                {isAuthenticated 
                  ? "You've used all 5 AI calls today. Try again tomorrow!" 
                  : "Daily limit reached. Sign in for 5 AI calls per day!"}
              </p>
            </motion.div>
          )}

          {/* Input Section */}
          <motion.div className="space-y-3" variants={fadeInUp}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">English</p>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <Select value={targetLang} onValueChange={setTargetLang}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.filter(l => l.code !== "en").map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name} ({lang.native})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="relative">
              <Textarea
                placeholder={isListening ? "Listening..." : "Type or speak what you want to say..."}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="min-h-28 bg-card border-border/50 resize-none text-lg pr-14"
              />
              <div className="absolute right-2 top-2">
                <VoiceInputButton
                  isListening={isListening}
                  isSupported={voiceSupported}
                  onStart={startListening}
                  onStop={stopListening}
                />
              </div>
              {isListening && (
                <motion.div
                  className="absolute bottom-2 left-3 right-14 flex items-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1 h-3 bg-primary rounded-full"
                        animate={{ scaleY: [1, 2, 1] }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.6,
                          delay: i * 0.2,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">Listening...</span>
                </motion.div>
              )}
            </div>
            <Button
              className="w-full h-12 bg-gradient-to-r from-primary to-accent text-primary-foreground"
              onClick={() => handleTranslate()}
              disabled={isTranslating || !inputText.trim() || !canUseAI}
            >
              {isTranslating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Translating...
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Translate ({remaining} left)
                </>
              )}
            </Button>
          </motion.div>

          {/* Translation Result */}
          {translatedText && (
            <motion.div 
              className="space-y-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-sm font-medium text-muted-foreground">{getLanguageName(targetLang)}</p>
              <div className="bg-card rounded-2xl border border-primary/30 p-6 space-y-2">
                <p className="text-2xl font-medium leading-relaxed">{translatedText}</p>
                {pronunciation && (
                  <p className="text-sm text-muted-foreground italic">{pronunciation}</p>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-12 border-border/50"
                  onClick={handleSpeak}
                >
                  <Volume2 className="h-4 w-4 mr-2" />
                  Speak
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-12 border-border/50"
                  onClick={handleCopy}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
            </motion.div>
          )}

          {/* Quick Phrases */}
          <motion.div className="space-y-3" variants={fadeInUp}>
            <h2 className="font-semibold text-lg">Quick Phrases</h2>
            <div className="grid grid-cols-1 gap-2">
              {quickPhrases.map((phrase, i) => (
                <motion.button
                  key={i}
                  className="flex items-center justify-between p-4 bg-card rounded-xl border border-border/50 hover:border-primary/30 transition-all text-left"
                  onClick={() => handleTranslate(phrase.en)}
                  disabled={!canUseAI}
                  whileHover={{ scale: canUseAI ? 1.01 : 1 }}
                  whileTap={{ scale: canUseAI ? 0.98 : 1 }}
                >
                  <span className="font-medium">{phrase.en}</span>
                  <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-full">
                    {phrase.category}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </AnimatedPage>
    </AppLayout>
  );
}
