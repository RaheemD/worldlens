import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Receipt, Camera, Plus, TrendingUp, Loader2, LogIn, FileText, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { AnimatedPage, fadeInUp, staggerContainer } from "@/components/AnimatedPage";
import { Button } from "@/components/ui/button";
import { FeatureCard } from "@/components/ui/feature-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAIUsage } from "@/contexts/AIUsageContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useCurrency } from "@/hooks/useCurrency";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExpenseReportDialog } from "@/components/spending/ExpenseReportDialog";
import { CurrencyConverter } from "@/components/spending/CurrencyConverter";

interface SpendingRecordBase {
  id: string;
  amount: number;
  currency: string;
  category: string;
  merchant: string | null;
  location_name: string | null;
  date: string;
  notes: string | null;
  created_at: string;
  scan_entry_id?: string | null;
}

interface SpendingRecord extends SpendingRecordBase {
  trip_id: string | null;
  trip_name: string | null;
}

interface SpendingRecordRow extends SpendingRecordBase {
  scan_entries?: {
    trip_id: string | null;
    trips?: { name: string | null } | null;
  } | null;
}

interface Trip {
  id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
}

const categoryColors: Record<string, "success" | "info" | "primary" | "warning" | "default"> = {
  Food: "success",
  Transport: "info",
  Attraction: "primary",
  Shopping: "warning",
  Accommodation: "default",
  Other: "default",
};

const categories = ["Food", "Transport", "Shopping", "Attraction", "Accommodation", "Other"];

export default function Spending() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canUseAI, incrementUsage, isAuthenticated } = useAIUsage();
  const { activeCurrency, localCurrency, homeCurrency, getSymbol, format: formatAmount, isUsingLocationCurrency } = useCurrency();
  const { locationName } = useGeolocation();
  const { convert, isLoading: ratesLoading } = useExchangeRates();
  
  // Check if we need to show currency conversion (when local differs from home)
  const showConversion = localCurrency !== homeCurrency && !isUsingLocationCurrency;
  
  const [spending, setSpending] = useState<SpendingRecord[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState("Food");
  const [newMerchant, setNewMerchant] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchSpending();
      fetchTrips();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchSpending = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("spending_records")
        .select("*, scan_entries(trip_id, trips(name))")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      const mapped = (data as SpendingRecordRow[] | null)?.map((record) => ({
        ...record,
        trip_id: record.scan_entries?.trip_id ?? null,
        trip_name: record.scan_entries?.trips?.name ?? null,
      })) || [];
      setSpending(mapped);
    } catch (error) {
      console.error("Error fetching spending:", error);
      toast.error("Failed to load spending data");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTrips = async () => {
    try {
      const { data, error } = await supabase
        .from("trips")
        .select("id, name, destination, start_date, end_date")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTrips(data || []);
    } catch (error) {
      console.error("Error fetching trips:", error);
    }
  };

  const filteredSpending = selectedTrip === "all"
    ? spending
    : selectedTrip === "unassigned"
      ? spending.filter((s) => !s.trip_id)
      : spending.filter((s) => s.trip_id === selectedTrip);

  const today = new Date().toISOString().split("T")[0];
  const totalToday = filteredSpending
    .filter((s) => s.date === today)
    .reduce((sum, s) => sum + Number(s.amount), 0);

  const totalTrip = filteredSpending.reduce((sum, s) => sum + Number(s.amount), 0);

  const categoryTotals = filteredSpending.reduce((acc, s) => {
    acc[s.category] = (acc[s.category] || 0) + Number(s.amount);
    return acc;
  }, {} as Record<string, number>);

  // Get the primary currency from spending records or user preference
  const primaryCurrency = filteredSpending[0]?.currency || activeCurrency;
  const symbol = getSymbol(primaryCurrency);

  const handleScanReceipt = async () => {
    if (!user) {
      toast.error("Please sign in to scan receipts");
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
    
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const allowed = await incrementUsage();
    if (!allowed) {
      toast.error("AI usage limit reached for today");
      return;
    }

    setIsScanning(true);
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      
      try {
        const { data, error } = await supabase.functions.invoke("scan-receipt", {
          body: { image: base64, currency: activeCurrency },
        });

        if (error) throw error;

        // Save extracted items to database
        if (data.items && data.items.length > 0) {
          const records = data.items.map((item: { name: string; price: number; category: string }) => ({
            user_id: user.id,
            amount: item.price,
            currency: data.currency || activeCurrency,
            category: item.category || "Other",
            merchant: data.merchant,
            location_name: locationName || data.location,
            date: data.date || today,
            notes: item.name,
          }));

          const { error: insertError } = await supabase
            .from("spending_records")
            .insert(records);

          if (insertError) throw insertError;

          toast.success(`Added ${data.items.length} items totaling ${getSymbol(data.currency || activeCurrency)}${data.total || 0}`);
          fetchSpending();
        } else {
          toast.info("No items found on receipt");
        }
      } catch (err) {
        console.error("Receipt scan error:", err);
        toast.error("Failed to scan receipt");
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const addManualEntry = async () => {
    if (!user || !newAmount) {
      toast.error("Please enter an amount");
      return;
    }

    setIsAdding(true);
    try {
      const { error } = await supabase.from("spending_records").insert({
        user_id: user.id,
        amount: parseFloat(newAmount),
        currency: activeCurrency,
        category: newCategory,
        merchant: newMerchant || null,
        location_name: locationName,
        date: today,
      });

      if (error) throw error;

      toast.success("Entry added!");
      setNewAmount("");
      setNewMerchant("");
      setDialogOpen(false);
      fetchSpending();
    } catch (err) {
      console.error("Add entry error:", err);
      toast.error("Failed to add entry");
    } finally {
      setIsAdding(false);
    }
  };

  const deleteEntry = async (id: string) => {
    const previous = spending;
    setSpending((prev) => prev.filter((item) => item.id !== id));
    try {
      const { error } = await supabase.from("spending_records").delete().eq("id", id);
      if (error) throw error;
      toast.success("Entry deleted");
    } catch (err) {
      setSpending(previous);
      console.error("Delete entry error:", err);
      toast.error("Failed to delete entry");
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (dateStr === today) return "Today";
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === yesterday.toISOString().split("T")[0]) return "Yesterday";
    return format(date, "MMM d");
  };

  // Not logged in state
  if (!user) {
    return (
      <AppLayout title="Spending">
        <AnimatedPage>
          <motion.div 
            className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <motion.div variants={fadeInUp}>
              <Receipt className="h-16 w-16 text-primary/30 mb-4" />
            </motion.div>
            <motion.h2 className="text-xl font-semibold mb-2" variants={fadeInUp}>
              Track Your Spending
            </motion.h2>
            <motion.p className="text-muted-foreground mb-6 max-w-sm" variants={fadeInUp}>
              Sign in to scan receipts, track expenses, and get AI-powered spending insights
            </motion.p>
            <motion.div variants={fadeInUp}>
              <Button onClick={() => navigate("/?auth=1")} className="gap-2">
                <LogIn className="h-4 w-4" />
                Sign In to Continue
              </Button>
            </motion.div>
          </motion.div>
        </AnimatedPage>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout title="Spending">
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Spending">
      <AnimatedPage>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        <motion.div 
          className="px-4 py-4 space-y-6"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {/* Summary Cards */}
          <motion.div className="grid grid-cols-2 gap-4" variants={fadeInUp}>
            <motion.div 
              className="bg-gradient-to-br from-primary/20 to-accent/10 rounded-2xl p-4 border border-primary/20"
              whileHover={{ scale: 1.02 }}
            >
              <p className="text-xs text-muted-foreground">Today</p>
              <p className="text-2xl font-bold">{symbol}{totalToday.toLocaleString()}</p>
              {showConversion && !ratesLoading && (
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  ≈ {getSymbol(localCurrency)}
                  {(convert(totalToday, homeCurrency, localCurrency) || totalToday).toLocaleString(undefined, { maximumFractionDigits: 0 })} local
                </p>
              )}
              <div className="flex items-center gap-1 mt-1 text-xs text-success">
                <TrendingUp className="h-3 w-3" />
                <span>On budget</span>
              </div>
            </motion.div>
            <motion.div 
              className="bg-card rounded-2xl p-4 border border-border/50"
              whileHover={{ scale: 1.02 }}
            >
              <p className="text-xs text-muted-foreground">
                {selectedTrip === "all" ? "All Trips" : selectedTrip === "unassigned" ? "Unassigned" : "Selected Trip"}
              </p>
              <p className="text-2xl font-bold">{symbol}{totalTrip.toLocaleString()}</p>
              {showConversion && !ratesLoading && (
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  ≈ {getSymbol(localCurrency)}
                  {(convert(totalTrip, homeCurrency, localCurrency) || totalTrip).toLocaleString(undefined, { maximumFractionDigits: 0 })} local
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {spending.length} transactions
              </p>
            </motion.div>
          </motion.div>

          {/* Currency Info Banner */}
          {showConversion && (
            <motion.div 
              className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg text-xs text-muted-foreground"
              variants={fadeInUp}
            >
              <span>📍 Local: {localCurrency}</span>
              <span>•</span>
              <span>🏠 Home: {homeCurrency}</span>
            </motion.div>
          )}

          {/* Currency Converter */}
          <motion.div variants={fadeInUp}>
            <CurrencyConverter />
          </motion.div>

          {/* Scan Receipt Button */}
          <motion.div variants={fadeInUp}>
            <Button
              className="w-full h-14 bg-card border border-dashed border-border/50 hover:border-primary/50 text-foreground"
              variant="ghost"
              onClick={handleScanReceipt}
              disabled={isScanning || !canUseAI}
            >
              {isScanning ? (
                <span className="animate-pulse">Scanning...</span>
              ) : (
                <>
                  <Camera className="h-5 w-5 mr-2 text-primary" />
                  Scan Receipt {!canUseAI && "(limit reached)"}
                </>
              )}
            </Button>
          </motion.div>

          {/* Category Breakdown */}
          {Object.keys(categoryTotals).length > 0 && (
            <motion.div className="space-y-3" variants={fadeInUp}>
              <h2 className="font-semibold text-lg">By Category</h2>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(categoryTotals).map(([category, total]) => (
                  <motion.div key={category} whileHover={{ scale: 1.05 }}>
                    <StatusBadge variant={categoryColors[category] || "default"}>
                      {category} {symbol}{total.toLocaleString()}
                    </StatusBadge>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Spending List */}
          {/* Export Report Button */}
          {spending.length > 0 && (
            <motion.div variants={fadeInUp}>
              <ExpenseReportDialog
                spending={spending}
                trips={trips}
                getSymbol={getSymbol}
                trigger={
                  <Button variant="outline" className="w-full gap-2">
                    <FileText className="h-4 w-4" />
                    Generate Expense Report (PDF)
                  </Button>
                }
              />
            </motion.div>
          )}

          <motion.div className="space-y-3" variants={fadeInUp}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Recent</h2>
              <div className="flex items-center gap-2">
                {(trips.length > 0 || spending.some((item) => !item.trip_id)) && (
                  <Select value={selectedTrip} onValueChange={setSelectedTrip}>
                    <SelectTrigger className="h-8 w-[160px]">
                      <SelectValue placeholder="All Trips" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Trips</SelectItem>
                      {spending.some((item) => !item.trip_id) && (
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                      )}
                      {trips.map((trip) => (
                        <SelectItem key={trip.id} value={trip.id}>
                          {trip.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-primary">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Manual
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border">
                    <DialogHeader>
                      <DialogTitle>Add Expense</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <Input
                        type="number"
                        placeholder={`Amount (${symbol})`}
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                        className="bg-background"
                      />
                      <Select value={newCategory} onValueChange={setNewCategory}>
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Merchant (optional)"
                        value={newMerchant}
                        onChange={(e) => setNewMerchant(e.target.value)}
                        className="bg-background"
                      />
                      <Button
                        onClick={addManualEntry}
                        disabled={isAdding}
                        className="w-full bg-primary text-primary-foreground"
                      >
                        {isAdding ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Add Expense"
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {filteredSpending.length === 0 ? (
              <motion.div 
                className="text-center py-8 text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No spending recorded yet</p>
              </motion.div>
            ) : (
              filteredSpending.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <FeatureCard
                    icon={<Receipt className="h-5 w-5" />}
                    title={item.notes || item.merchant || item.category}
                    subtitle={formatDate(item.date)}
                    action={
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{getSymbol(item.currency)}{Number(item.amount).toLocaleString()}</span>
                        <StatusBadge variant={categoryColors[item.category] || "default"}>
                          {item.category}
                        </StatusBadge>
                        <StatusBadge variant={item.trip_id ? "info" : "default"}>
                          {item.trip_name || "No Trip"}
                        </StatusBadge>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => deleteEntry(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    }
                  />
                </motion.div>
              ))
            )}
          </motion.div>
        </motion.div>
      </AnimatedPage>
    </AppLayout>
  );
}
