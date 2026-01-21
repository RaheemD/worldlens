import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { 
  Book, 
  Plus, 
  ChevronRight, 
  MapPin, 
  Calendar, 
  Camera, 
  Sparkles,
  Share2,
  Loader2,
  Star,
  Trash2,
  FileText,
  Image,
  WifiOff
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { FeatureCard } from "@/components/ui/feature-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ShareDialog } from "@/components/share/ShareDialog";
import { TripExportDialog } from "@/components/export/TripExportDialog";
import { ScanGallery } from "@/components/journal/ScanGallery";
import { useOfflineSync } from "@/hooks/useOfflineSync";

interface Trip {
  id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  ai_summary: string | null;
  shareable_story: string | null;
  share_code: string | null;
  is_public: boolean;
  created_at: string;
  scan_count?: number;
}

interface ScanEntry {
  id: string;
  category: string;
  name: string | null;
  description: string | null;
  location_name: string | null;
  image_url: string | null;
  is_favorite: boolean;
  created_at: string;
  trip_id: string | null;
}

export default function Journal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [recentScans, setRecentScans] = useState<ScanEntry[]>([]);
  const [allScans, setAllScans] = useState<ScanEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);
  const [newTripName, setNewTripName] = useState("");
  const [newTripDestination, setNewTripDestination] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const { isOffline, cacheScansForOffline, getOfflineScans } = useOfflineSync();

  useEffect(() => {
    if (user) {
      fetchJournalData();
    }
  }, [user]);

  const fetchJournalData = async () => {
    setIsLoading(true);
    try {
      // If offline, try to load from cache
      if (isOffline) {
        const cachedScans = await getOfflineScans();
        if (cachedScans.length > 0) {
          setAllScans(cachedScans.map(s => ({
            id: s.id,
            category: s.category,
            name: s.name,
            description: s.description,
            location_name: s.location_name,
            image_url: s.image_data || s.image_url,
            is_favorite: s.is_favorite,
            created_at: s.created_at,
            trip_id: null,
          })));
          setRecentScans(cachedScans.slice(0, 10).map(s => ({
            id: s.id,
            category: s.category,
            name: s.name,
            description: s.description,
            location_name: s.location_name,
            image_url: s.image_data || s.image_url,
            is_favorite: s.is_favorite,
            created_at: s.created_at,
            trip_id: null,
          })));
          toast.info("Showing cached data (offline mode)");
        }
        setIsLoading(false);
        return;
      }

      // Fetch trips
      const { data: tripsData, error: tripsError } = await supabase
        .from("trips")
        .select("*")
        .order("created_at", { ascending: false });

      if (tripsError) throw tripsError;

      // Fetch recent scans (limited)
      const { data: scansData, error: scansError } = await supabase
        .from("scan_entries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (scansError) throw scansError;

      // Fetch all scans for gallery
      const { data: allScansData, error: allScansError } = await supabase
        .from("scan_entries")
        .select("*")
        .order("created_at", { ascending: false });

      if (allScansError) throw allScansError;

      // Get scan counts for each trip
      const tripsWithCounts = await Promise.all(
        (tripsData || []).map(async (trip) => {
          const { count } = await supabase
            .from("scan_entries")
            .select("*", { count: "exact", head: true })
            .eq("trip_id", trip.id);
          return { ...trip, scan_count: count || 0 };
        })
      );

      setTrips(tripsWithCounts);
      setRecentScans(scansData || []);
      setAllScans(allScansData || []);

      // Cache scans for offline use
      if (allScansData && allScansData.length > 0) {
        cacheScansForOffline(allScansData.map(s => ({
          id: s.id,
          category: s.category,
          name: s.name,
          description: s.description,
          location_name: s.location_name,
          image_url: s.image_url,
          extracted_text: s.extracted_text,
          ai_analysis: s.ai_analysis as Record<string, unknown> | null,
          is_favorite: s.is_favorite || false,
          created_at: s.created_at,
        })));
      }
    } catch (error) {
      console.error("Error fetching journal data:", error);
      
      // Try to load from cache on error
      const cachedScans = await getOfflineScans();
      if (cachedScans.length > 0) {
        setAllScans(cachedScans.map(s => ({
          id: s.id,
          category: s.category,
          name: s.name,
          description: s.description,
          location_name: s.location_name,
          image_url: s.image_data || s.image_url,
          is_favorite: s.is_favorite,
          created_at: s.created_at,
          trip_id: null,
        })));
        toast.info("Showing cached data");
      } else {
        toast.error("Failed to load journal");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const createTrip = async () => {
    if (!newTripName.trim()) {
      toast.error("Please enter a trip name");
      return;
    }

    setIsCreatingTrip(true);
    try {
      const { error } = await supabase.from("trips").insert({
        user_id: user!.id,
        name: newTripName,
        destination: newTripDestination || null,
        start_date: new Date().toISOString().split("T")[0],
      });

      if (error) throw error;

      toast.success("Trip created!");
      setNewTripName("");
      setNewTripDestination("");
      setDialogOpen(false);
      fetchJournalData();
    } catch (error) {
      console.error("Error creating trip:", error);
      toast.error("Failed to create trip");
    } finally {
      setIsCreatingTrip(false);
    }
  };

  const generateContent = async (tripId: string, type: "summary" | "story") => {
    setGeneratingFor(tripId);
    try {
      const { data: session } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("generate-summary", {
        body: { tripId, type },
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`,
        },
      });

      if (error) throw error;

      if (type === "summary") {
        toast.success("Summary generated!");
      } else {
        toast.success("Story created!");
      }

      fetchJournalData();
    } catch (error) {
      console.error("Error generating content:", error);
      toast.error("Failed to generate content");
    } finally {
      setGeneratingFor(null);
    }
  };

  const shareTrip = async (trip: Trip) => {
    // Generate share code if needed
    let shareCode = trip.share_code;
    if (!shareCode) {
      shareCode = Math.random().toString(36).substring(2, 10);
      await supabase
        .from("trips")
        .update({ share_code: shareCode, is_public: true })
        .eq("id", trip.id);
      fetchJournalData();
    }

    return shareCode;
  };

  const getShareUrl = (shareCode: string) => {
    // Use production URL when available, otherwise use current origin
    const baseUrl = window.location.origin;
    return `${baseUrl}/trip/${shareCode}`;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "monument":
        return "🏛️";
      case "restaurant":
        return "🍽️";
      case "menu":
        return "📋";
      case "ticket":
        return "🎫";
      case "sign":
        return "🪧";
      default:
        return "📸";
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Travel Journal">
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Travel Journal">
      {/* Photo Gallery */}
      <AnimatePresence>
        {showGallery && (
          <ScanGallery 
            scans={allScans} 
            onClose={() => setShowGallery(false)}
            onUpdate={fetchJournalData}
          />
        )}
      </AnimatePresence>

      <div className="px-4 py-4 space-y-6">
        {/* Action Buttons */}
        <div className="flex gap-3">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 h-14 bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold rounded-xl">
                <Plus className="h-5 w-5 mr-2" />
                New Trip
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Create New Trip</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Trip name (e.g., Tokyo Adventure)"
                  value={newTripName}
                  onChange={(e) => setNewTripName(e.target.value)}
                  className="bg-background"
                />
                <Input
                  placeholder="Destination (optional)"
                  value={newTripDestination}
                  onChange={(e) => setNewTripDestination(e.target.value)}
                  className="bg-background"
                />
                <Button
                  onClick={createTrip}
                  disabled={isCreatingTrip}
                  className="w-full bg-primary text-primary-foreground"
                >
                  {isCreatingTrip ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Create Trip"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Photo Gallery Button */}
          <Button
            variant="outline"
            className="h-14 px-4 border-border/50"
            onClick={() => setShowGallery(true)}
            disabled={allScans.filter(s => s.image_url).length === 0}
          >
            <Image className="h-5 w-5" />
          </Button>
        </div>

        {/* Active Trips */}
        <div className="space-y-3">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Book className="h-5 w-5 text-primary" />
            My Trips
          </h2>
          
          {trips.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Book className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No trips yet. Start one to organize your scans!</p>
            </div>
          ) : (
            trips.map((trip) => (
              <div
                key={trip.id}
                className="bg-card rounded-xl border border-border/50 p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{trip.name}</h3>
                    {trip.destination && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {trip.destination}
                      </p>
                    )}
                  </div>
                  <StatusBadge variant="primary">
                    {trip.scan_count} scans
                  </StatusBadge>
                </div>

                {trip.start_date && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Started {format(new Date(trip.start_date), "MMM d, yyyy")}
                  </p>
                )}

                {trip.ai_summary && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {trip.ai_summary}
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => generateContent(trip.id, "summary")}
                    disabled={generatingFor === trip.id}
                  >
                    {generatingFor === trip.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-1" />
                        AI Summary
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => generateContent(trip.id, "story")}
                    disabled={generatingFor === trip.id}
                  >
                    {generatingFor === trip.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Share2 className="h-4 w-4 mr-1" />
                        Create Story
                      </>
                    )}
                  </Button>
                </div>

                {/* Export as Blog/Social */}
                <TripExportDialog
                  trip={trip}
                  trigger={
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full text-muted-foreground hover:text-primary"
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Export as Blog/Social
                    </Button>
                  }
                />

                {(trip.shareable_story || trip.share_code) && (
                  <ShareDialog
                    shareUrl={getShareUrl(trip.share_code || "")}
                    title={trip.name}
                    description={trip.shareable_story || `Check out my trip to ${trip.destination || "this amazing place"}!`}
                    trigger={
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full text-primary"
                        onClick={async () => {
                          if (!trip.share_code) {
                            await shareTrip(trip);
                          }
                        }}
                      >
                        <Share2 className="h-4 w-4 mr-1" />
                        Share Trip
                      </Button>
                    }
                  />
                )}

                {!trip.shareable_story && !trip.share_code && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={async () => {
                      const code = await shareTrip(trip);
                      if (code) {
                        toast.success("Share link ready!");
                      }
                    }}
                  >
                    <Share2 className="h-4 w-4 mr-1" />
                    Enable Sharing
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Recent Scans */}
        <div className="space-y-3">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Recent Scans
          </h2>

          {recentScans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Camera className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No scans yet. Start scanning to build your journal!</p>
              <Button
                variant="ghost"
                className="mt-2 text-primary"
                onClick={() => navigate("/scan")}
              >
                Go to Scan
              </Button>
            </div>
          ) : (
            recentScans.map((scan) => (
              <FeatureCard
                key={scan.id}
                icon={<span className="text-lg">{getCategoryIcon(scan.category)}</span>}
                title={scan.name || "Unknown"}
                subtitle={scan.location_name || format(new Date(scan.created_at), "MMM d, h:mm a")}
                action={
                  <div className="flex items-center gap-2">
                    {scan.is_favorite && <Star className="h-4 w-4 text-warning fill-warning" />}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                }
              />
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
