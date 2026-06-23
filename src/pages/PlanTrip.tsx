import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AnimatedPage, fadeInUp, staggerContainer } from "@/components/AnimatedPage";
import { TripPlanner } from "@/components/trip/TripPlanner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Trip {
  id: string;
  name: string;
  destination: string | null;
}

export default function PlanTrip() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchTrips() {
      if (!user) return;
      
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("trips")
          .select("id, name, destination")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setTrips(data || []);
      } catch (err) {
        console.error("Error fetching trips:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTrips();
  }, [user]);

  const handlePlanSaved = async () => {
    // Refresh trips list after saving
    if (!user) return;
    
    const { data } = await supabase
      .from("trips")
      .select("id, name, destination")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) setTrips(data);
  };

  return (
    <AppLayout title="Plan Your Trip">
      <AnimatedPage>
        <motion.div 
          className="px-4 py-6 space-y-6 pb-24"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <motion.div variants={fadeInUp} className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-primary-foreground" />
            </div>
            <h2 className="text-xl font-bold">AI Trip Planner</h2>
            <p className="text-sm text-muted-foreground">
              Get personalized travel recommendations and itineraries
            </p>
          </motion.div>

          <motion.div variants={fadeInUp}>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <TripPlanner 
                existingTrips={trips}
                onPlanSaved={handlePlanSaved}
              />
            )}
          </motion.div>
        </motion.div>
      </AnimatedPage>
    </AppLayout>
  );
}
