import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Camera, X, Zap, Loader2, Save, Star, AlertCircle, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AnimatedPage, fadeInUp, staggerContainer } from "@/components/AnimatedPage";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScanResult } from "@/components/scan/ScanResult";
import { TranslateOverlay } from "@/components/scan/TranslateOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useAIUsage } from "@/contexts/AIUsageContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AnalysisResult {
  category: string;
  name: string;
  description: string;
  detected_location?: string | null;
  details?: Record<string, unknown>;
  extracted_text?: string;
  prices?: Array<{ item: string; price: number; currency: string }>;
  warnings?: string[];
  tips?: string[];
}

interface Trip {
  id: string;
  name: string;
}

export default function Scan() {
  const { user } = useAuth();
  const { latitude, longitude, locationName } = useGeolocation();
  const { canUseAI, remaining, incrementUsage, isAuthenticated } = useAIUsage();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [translateText, setTranslateText] = useState<string>("");
  const [showTranslate, setShowTranslate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchTrips();
    }
  }, [user]);

  const fetchTrips = async () => {
    const { data } = await supabase
      .from("trips")
      .select("id, name")
      .order("created_at", { ascending: false });
    setTrips(data || []);
  };

  const handleCapture = () => {
    if (!canUseAI) {
      toast.error(
        isAuthenticated 
          ? "Daily AI limit reached. Try again tomorrow!" 
          : "Daily limit reached. Sign in for more AI calls!"
      );
      return;
    }
    fileInputRef.current?.click();
  };

  const handleUpload = () => {
    if (!canUseAI) {
      toast.error(
        isAuthenticated 
          ? "Daily AI limit reached. Try again tomorrow!" 
          : "Daily limit reached. Sign in for more AI calls!"
      );
      return;
    }
    galleryInputRef.current?.click();
  };

  const compressImage = (file: File, maxWidth = 1024, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // Scale down if larger than maxWidth
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG for better compression
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Compress the image before sending to reduce payload size
      const compressedBase64 = await compressImage(file, 1024, 0.8);
      setCapturedImage(compressedBase64);
      await analyzeImage(compressedBase64);
    } catch (err) {
      console.error("Image processing error:", err);
      toast.error("Failed to process image. Please try again.");
    }
  };

  const analyzeImage = async (imageBase64: string) => {
    // Check usage before making the call
    const allowed = await incrementUsage();
    if (!allowed) {
      toast.error("AI usage limit reached for today");
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-image", {
        body: { image: imageBase64 },
      });

      if (error) {
        if (error.message?.includes("429")) {
          toast.error("Rate limit exceeded. Please try again later.");
        } else if (error.message?.includes("402")) {
          toast.error("AI usage limit reached. Please add credits.");
        } else {
          toast.error("Analysis failed. Please try again.");
        }
        return;
      }

      setResult(data);
    } catch (err) {
      console.error("Analysis error:", err);
      toast.error("Failed to analyze image");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveToJournal = async () => {
    if (!user || !result) {
      toast.error("Please sign in to save scans");
      return;
    }

    setIsSaving(true);
    try {
      // Use AI-detected location if available, otherwise fall back to GPS location
      const finalLocationName = result.detected_location || locationName;
      
      const { error } = await supabase.from("scan_entries").insert([{
        user_id: user.id,
        category: result.category,
        name: result.name,
        description: result.description,
        image_url: capturedImage,
        latitude: result.detected_location ? null : latitude, // Don't save GPS coords if AI detected location
        longitude: result.detected_location ? null : longitude,
        location_name: finalLocationName,
        ai_analysis: result.details ? JSON.parse(JSON.stringify(result.details)) : null,
        extracted_text: result.extracted_text || null,
        prices: result.prices ? JSON.parse(JSON.stringify(result.prices)) : null,
        warnings: result.warnings || [],
        tips: result.tips || [],
        trip_id: selectedTripId === "none" ? null : selectedTripId,
      }]);

      if (error) throw error;

      setSaveSuccess(true);
      window.setTimeout(() => setSaveSuccess(false), 1400);
      toast.success("Saved to journal!");
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save scan");
    } finally {
      setIsSaving(false);
    }
  };

  const resetScan = () => {
    setCapturedImage(null);
    setResult(null);
    setSaveSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <AppLayout title="Scan World" hideNav={!!capturedImage}>
      <AnimatedPage>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {!capturedImage ? (
          <motion.div 
            className="relative min-h-[calc(100vh-140px)] flex flex-col"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {/* Camera Preview Placeholder */}
            <motion.div 
              className="flex-1 relative bg-card/50 mx-4 mt-4 rounded-2xl border border-border/50 overflow-hidden"
              variants={fadeInUp}
            >
              {/* Scan overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-64 h-64">
                  {/* Corner brackets */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-lg" />
                  
                  {/* Scan line animation */}
                  <div className="absolute inset-4 overflow-hidden">
                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-line" />
                  </div>
                </div>
              </div>

              {/* Location indicator */}
              {locationName && (
                <div className="absolute top-4 left-4 right-4">
                  <div className="bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-muted-foreground text-center">
                    📍 {locationName}
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="absolute inset-x-0 bottom-0 p-6 text-center">
                <p className="text-muted-foreground text-sm">
                  Point at monuments, menus, signs, or tickets
                </p>
              </div>
            </motion.div>

            {/* Usage Warning */}
            {!canUseAI && (
              <motion.div 
                className="mx-4 mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center gap-3"
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

            {/* Capture Controls */}
            <motion.div className="p-6 flex items-center justify-center gap-8" variants={fadeInUp}>
              {/* Upload Button */}
              <motion.button
                onClick={handleUpload}
                className={`h-14 w-14 rounded-full flex items-center justify-center border border-border/50 active:scale-95 transition-transform ${
                  canUseAI
                    ? "bg-card/80 backdrop-blur-sm hover:bg-card"
                    : "bg-muted cursor-not-allowed"
                }`}
                whileHover={{ scale: canUseAI ? 1.05 : 1 }}
                whileTap={{ scale: canUseAI ? 0.95 : 1 }}
                disabled={!canUseAI}
                title="Upload from Gallery"
              >
                <ImageIcon className={`h-6 w-6 ${canUseAI ? "text-foreground" : "text-muted-foreground"}`} />
              </motion.button>

              {/* Camera Button */}
              <motion.button
                onClick={handleCapture}
                className={`relative h-20 w-20 rounded-full flex items-center justify-center active:scale-95 transition-transform ${
                  canUseAI 
                    ? "bg-gradient-to-br from-primary to-accent glow-primary" 
                    : "bg-muted cursor-not-allowed"
                }`}
                whileHover={{ scale: canUseAI ? 1.05 : 1 }}
                whileTap={{ scale: canUseAI ? 0.95 : 1 }}
                disabled={!canUseAI}
              >
                <div className="absolute inset-1 rounded-full border-4 border-primary-foreground/30" />
                <Camera className={`h-8 w-8 ${canUseAI ? "text-primary-foreground" : "text-muted-foreground"}`} />
                
                {/* Pulse ring */}
                {canUseAI && (
                  <div className="absolute inset-0 rounded-full border-2 border-primary animate-pulse-ring" />
                )}
              </motion.button>

              {/* Placeholder to balance layout (invisible) */}
              <div className="w-14" />
            </motion.div>

            {/* Quick Tips */}
            <motion.div className="px-4 pb-4" variants={fadeInUp}>
              <div className="flex items-center gap-2 justify-center text-muted-foreground text-xs">
                <Zap className="h-3 w-3 text-primary" />
                <span>AI-powered instant recognition • {remaining} calls remaining today</span>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div 
            className="relative min-h-[calc(100vh-60px)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Captured Image */}
            <div className="relative">
              <img
                src={capturedImage}
                alt="Captured"
                className="w-full h-64 object-cover"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 h-10 w-10 rounded-full glass"
                onClick={resetScan}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Analysis Result - Add bottom padding for fixed button */}
            <div className="p-4 pb-24">
              {isAnalyzing ? (
                <motion.div 
                  className="flex flex-col items-center justify-center py-12 gap-4"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <div className="relative">
                    <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-pulse-ring" />
                  </div>
                  <p className="text-muted-foreground">Analyzing image...</p>
                </motion.div>
              ) : result ? (
                <motion.div 
                  className="space-y-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <ScanResult 
                    result={result} 
                    onTranslate={(text) => {
                      setTranslateText(text);
                      setShowTranslate(true);
                    }}
                  />
                  
                  {/* Save to Journal Section */}
                  {user ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      {trips.length > 0 && (
                        <div className="mb-3">
                          <Select value={selectedTripId} onValueChange={setSelectedTripId}>
                            <SelectTrigger className="bg-card border-border/50">
                              <SelectValue placeholder="Add to trip (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No trip</SelectItem>
                              {trips.map((trip) => (
                                <SelectItem key={trip.id} value={trip.id}>
                                  {trip.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      
                      <Button
                        className="w-full h-14 bg-card border border-border/50 hover:bg-card/80 text-foreground"
                        variant="ghost"
                        onClick={saveToJournal}
                         disabled={isSaving || saveSuccess}
                      >
                        {isSaving ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                         ) : saveSuccess ? (
                           <motion.span
                             className="inline-flex items-center"
                             initial={{ opacity: 0, scale: 0.9 }}
                             animate={{ opacity: 1, scale: 1 }}
                             transition={{ type: "spring", stiffness: 500, damping: 30 }}
                           >
                             <CheckCircle2 className="h-5 w-5 mr-2 text-primary" />
                             Saved
                           </motion.span>
                        ) : (
                          <>
                            <Save className="h-5 w-5 mr-2 text-primary" />
                            Save to Journal
                          </>
                        )}
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <Button
                        className="w-full h-14 bg-card border border-border/50 hover:bg-card/80 text-foreground"
                        variant="ghost"
                        onClick={() => toast.error("Please sign in to save scans")}
                      >
                        <Save className="h-5 w-5 mr-2 text-primary" />
                        Save to Journal
                      </Button>
                    </motion.div>
                  )}
                </motion.div>
              ) : null}
            </div>

            {/* Scan Again Button */}
            {!isAnalyzing && (
              <motion.div 
                className="fixed bottom-0 inset-x-0 p-4 glass border-t border-border/50"
                initial={{ y: 100 }}
                animate={{ y: 0 }}
              >
                <Button
                  className="w-full h-14 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold"
                  onClick={resetScan}
                >
                  <Camera className="h-5 w-5 mr-2" />
                  Scan Again
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatedPage>

      {/* Translation Overlay */}
      <TranslateOverlay
        extractedText={translateText}
        isOpen={showTranslate}
        onClose={() => setShowTranslate(false)}
      />
    </AppLayout>
  );
}
