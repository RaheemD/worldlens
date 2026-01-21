import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2, Map, Utensils, Luggage, Calendar, DollarSign, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAIUsage } from "@/contexts/AIUsageContext";
import { useAuth } from "@/contexts/AuthContext";

interface TravelPlan {
  overview: string;
  bestTimeToVisit?: string;
  itinerary?: Array<{
    day: number;
    title: string;
    morning: string;
    afternoon: string;
    evening: string;
    tips?: string[];
  }>;
  mustTry?: Array<{
    name: string;
    description: string;
  }>;
  packingTips?: string[];
  budgetEstimate?: {
    budget: string;
    midRange: string;
    luxury: string;
  };
}

interface Trip {
  id: string;
  name: string;
  destination: string | null;
}

interface TripPlannerProps {
  destination?: string;
  tripId?: string;
  existingTrips?: Trip[];
  onPlanGenerated?: (plan: TravelPlan) => void;
  onPlanSaved?: () => void;
}

const interestOptions = [
  "Culture & History",
  "Food & Dining",
  "Nature & Outdoors",
  "Nightlife",
  "Shopping",
  "Art & Museums",
  "Adventure",
  "Relaxation",
  "Photography",
  "Local Experience",
];

export function TripPlanner({ 
  destination: initialDestination, 
  tripId: initialTripId, 
  existingTrips = [],
  onPlanGenerated,
  onPlanSaved 
}: TripPlannerProps) {
  const { canUseAI, remaining, incrementUsage, isAuthenticated } = useAIUsage();
  const { user } = useAuth();
  const [destination, setDestination] = useState(initialDestination || "");
  const [duration, setDuration] = useState("3");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [plan, setPlan] = useState<TravelPlan | null>(null);
  const [selectedTripId, setSelectedTripId] = useState(initialTripId || "new");

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest].slice(0, 5) // Max 5 interests
    );
  };

  const generatePlan = async () => {
    if (!destination.trim()) {
      toast.error("Please enter a destination");
      return;
    }

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

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("plan-trip", {
        body: {
          destination,
          duration: parseInt(duration),
          interests: selectedInterests,
          tripId: selectedTripId !== "new" ? selectedTripId : undefined,
        },
      });

      if (error) throw error;

      setPlan(data.plan);
      setIsSaved(false);
      onPlanGenerated?.(data.plan);
      toast.success("Travel plan generated!");
    } catch (err) {
      console.error("Error generating plan:", err);
      toast.error("Failed to generate travel plan");
    } finally {
      setIsGenerating(false);
    }
  };

  const savePlanToTrip = async () => {
    if (!plan || !user) {
      toast.error("Please sign in to save your trip plan");
      return;
    }

    setIsSaving(true);
    try {
      if (selectedTripId === "new") {
        // Create a new trip with the plan
        const { error } = await supabase.from("trips").insert({
          user_id: user.id,
          name: `${destination} Trip`,
          destination,
          ai_overview: plan.overview,
          ai_best_time_to_visit: plan.bestTimeToVisit,
          ai_itinerary: plan.itinerary,
          ai_must_try: plan.mustTry,
          ai_packing_tips: plan.packingTips,
          ai_budget_estimate: plan.budgetEstimate,
        });

        if (error) throw error;
        toast.success("Trip created and plan saved!");
      } else {
        // Update existing trip with the plan
        const { error } = await supabase
          .from("trips")
          .update({
            destination: destination || undefined,
            ai_overview: plan.overview,
            ai_best_time_to_visit: plan.bestTimeToVisit,
            ai_itinerary: plan.itinerary,
            ai_must_try: plan.mustTry,
            ai_packing_tips: plan.packingTips,
            ai_budget_estimate: plan.budgetEstimate,
          })
          .eq("id", selectedTripId);

        if (error) throw error;
        toast.success("Plan saved to trip!");
      }

      setIsSaved(true);
      onPlanSaved?.();
    } catch (err) {
      console.error("Error saving plan:", err);
      toast.error("Failed to save plan");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Form */}
      {!plan && (
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="space-y-2">
            <Label htmlFor="destination">Where are you going?</Label>
            <Input
              id="destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g., Tokyo, Japan"
              className="bg-card"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">How many days?</Label>
            <Input
              id="duration"
              type="number"
              min="1"
              max="30"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="bg-card w-24"
            />
          </div>

          <div className="space-y-2">
            <Label>What interests you? (select up to 5)</Label>
            <div className="flex flex-wrap gap-2">
              {interestOptions.map((interest) => (
                <Badge
                  key={interest}
                  variant={selectedInterests.includes(interest) ? "default" : "outline"}
                  className="cursor-pointer transition-all"
                  onClick={() => toggleInterest(interest)}
                >
                  {interest}
                </Badge>
              ))}
            </div>
          </div>

          {/* Trip Selection (for authenticated users) */}
          {user && existingTrips.length > 0 && (
            <div className="space-y-2">
              <Label>Save to trip</Label>
              <Select value={selectedTripId} onValueChange={setSelectedTripId}>
                <SelectTrigger className="bg-card">
                  <SelectValue placeholder="Select a trip" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Create new trip</SelectItem>
                  {existingTrips.map((trip) => (
                    <SelectItem key={trip.id} value={trip.id}>
                      {trip.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={generatePlan}
            disabled={isGenerating || !destination.trim() || !canUseAI}
            className="w-full h-12 bg-gradient-to-r from-primary to-accent"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Plan...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate AI Travel Plan ({remaining} left)
              </>
            )}
          </Button>
        </motion.div>
      )}

      {/* Generated Plan */}
      {plan && (
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Overview */}
          <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="pt-4">
              <p className="text-sm leading-relaxed">{plan.overview}</p>
              {plan.bestTimeToVisit && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Best time: {plan.bestTimeToVisit}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs for different sections */}
          <Tabs defaultValue="itinerary">
            <TabsList className="w-full">
              <TabsTrigger value="itinerary" className="flex-1 text-xs">
                <Map className="h-3 w-3 mr-1" />
                Itinerary
              </TabsTrigger>
              <TabsTrigger value="food" className="flex-1 text-xs">
                <Utensils className="h-3 w-3 mr-1" />
                Must Try
              </TabsTrigger>
              <TabsTrigger value="packing" className="flex-1 text-xs">
                <Luggage className="h-3 w-3 mr-1" />
                Packing
              </TabsTrigger>
              <TabsTrigger value="budget" className="flex-1 text-xs">
                <DollarSign className="h-3 w-3 mr-1" />
                Budget
              </TabsTrigger>
            </TabsList>

            <TabsContent value="itinerary" className="space-y-3 mt-4">
              {plan.itinerary?.map((day) => (
                <Card key={day.day} className="bg-card/50">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs">
                        {day.day}
                      </span>
                      {day.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Morning:</span>
                      <p>{day.morning}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Afternoon:</span>
                      <p>{day.afternoon}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Evening:</span>
                      <p>{day.evening}</p>
                    </div>
                    {day.tips && day.tips.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <span className="text-muted-foreground text-xs">Tips:</span>
                        <ul className="list-disc list-inside text-xs mt-1">
                          {day.tips.map((tip, i) => (
                            <li key={i}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="food" className="space-y-2 mt-4">
              {plan.mustTry?.map((item, i) => (
                <Card key={i} className="bg-card/50">
                  <CardContent className="py-3 px-4">
                    <h4 className="font-medium text-sm">{item.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="packing" className="mt-4">
              <Card className="bg-card/50">
                <CardContent className="py-4 px-4">
                  <ul className="space-y-2">
                    {plan.packingTips?.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-primary">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="budget" className="mt-4">
              {plan.budgetEstimate && (
                <div className="grid gap-3">
                  <Card className="bg-card/50">
                    <CardContent className="py-3 px-4 flex justify-between items-center">
                      <span className="text-sm">💰 Budget</span>
                      <span className="font-medium text-sm">{plan.budgetEstimate.budget}</span>
                    </CardContent>
                  </Card>
                  <Card className="bg-card/50">
                    <CardContent className="py-3 px-4 flex justify-between items-center">
                      <span className="text-sm">💵 Mid-Range</span>
                      <span className="font-medium text-sm">{plan.budgetEstimate.midRange}</span>
                    </CardContent>
                  </Card>
                  <Card className="bg-card/50">
                    <CardContent className="py-3 px-4 flex justify-between items-center">
                      <span className="text-sm">💎 Luxury</span>
                      <span className="font-medium text-sm">{plan.budgetEstimate.luxury}</span>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Save and Generate New Plan Buttons */}
          <div className="flex gap-3">
            {user && (
              <Button
                onClick={savePlanToTrip}
                disabled={isSaving || isSaved}
                className="flex-1"
                variant={isSaved ? "outline" : "default"}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : isSaved ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isSaved ? "Saved to Journal" : "Save to Journal"}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setPlan(null);
                setIsSaved(false);
              }}
              className={user ? "" : "w-full"}
            >
              New Plan
            </Button>
          </div>

          {!user && (
            <p className="text-xs text-center text-muted-foreground">
              Sign in to save this plan to your travel journal
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}
