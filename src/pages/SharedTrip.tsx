import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Calendar, Camera, ChevronLeft, Share2, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AnimatedPage, fadeInUp, staggerContainer } from "@/components/AnimatedPage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface SharedTrip {
  id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  shareable_story: string | null;
  cover_image_url: string | null;
}

export default function SharedTrip() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<SharedTrip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSharedTrip() {
      if (!shareCode) {
        setError("Invalid share link");
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("trips")
          .select("id, name, destination, start_date, end_date, shareable_story, cover_image_url")
          .eq("share_code", shareCode)
          .eq("is_public", true)
          .single();

        if (fetchError || !data) {
          setError("Trip not found or no longer shared");
          return;
        }

        setTrip(data);
      } catch (err) {
        console.error("Error fetching shared trip:", err);
        setError("Failed to load trip");
      } finally {
        setIsLoading(false);
      }
    }

    fetchSharedTrip();
  }, [shareCode]);

  if (isLoading) {
    return (
      <AppLayout title="Shared Trip" hideNav>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (error || !trip) {
    return (
      <AppLayout title="Shared Trip" hideNav>
        <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
          <p className="text-muted-foreground">{error || "Trip not found"}</p>
          <Button onClick={() => navigate("/")} variant="outline">
            Go to Home
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={trip.name} hideNav>
      <AnimatedPage>
        <motion.div 
          className="pb-8"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {/* Header Image */}
          {trip.cover_image_url && (
            <motion.div 
              className="relative h-48 w-full overflow-hidden"
              variants={fadeInUp}
            >
              <img
                src={trip.cover_image_url}
                alt={trip.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
            </motion.div>
          )}

          {/* Back Button */}
          <motion.div 
            className="px-4 py-3"
            variants={fadeInUp}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="-ml-2"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Explore Wanderlens
            </Button>
          </motion.div>

          {/* Trip Info */}
          <motion.div 
            className="px-4 space-y-4"
            variants={fadeInUp}
          >
            <div>
              <h1 className="text-2xl font-bold">{trip.name}</h1>
              {trip.destination && (
                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                  <MapPin className="h-4 w-4" />
                  <span>{trip.destination}</span>
                </div>
              )}
              {trip.start_date && (
                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {format(new Date(trip.start_date), "MMM d, yyyy")}
                    {trip.end_date && ` - ${format(new Date(trip.end_date), "MMM d, yyyy")}`}
                  </span>
                </div>
              )}
            </div>

            {/* Story */}
            {trip.shareable_story && (
              <Card className="bg-card/50 border-border/50">
                <CardContent className="pt-4">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {trip.shareable_story}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* CTA */}
            <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
              <CardContent className="pt-4 text-center">
                <Camera className="h-8 w-8 text-primary mx-auto mb-2" />
                <h3 className="font-semibold">Create Your Own Travel Journal</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Scan, translate, and document your adventures with AI
                </p>
                <Button
                  onClick={() => navigate("/")}
                  className="mt-4"
                >
                  Get Started Free
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </AnimatedPage>
    </AppLayout>
  );
}
