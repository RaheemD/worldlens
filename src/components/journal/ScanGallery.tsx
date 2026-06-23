import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  MapPin, 
  Calendar, 
  Star, 
  Filter,
  Grid3X3,
  List,
  Heart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

interface ScanGalleryProps {
  scans: ScanEntry[];
  onClose: () => void;
  onUpdate?: () => void;
}

const categories = [
  { value: "all", label: "All", icon: "📷" },
  { value: "monument", label: "Monuments", icon: "🏛️" },
  { value: "menu", label: "Menus", icon: "📋" },
  { value: "sign", label: "Signs", icon: "🪧" },
  { value: "ticket", label: "Tickets", icon: "🎫" },
  { value: "nature", label: "Nature", icon: "🌿" },
  { value: "art", label: "Art", icon: "🎨" },
  { value: "product", label: "Products", icon: "🛍️" },
  { value: "document", label: "Documents", icon: "📄" },
  { value: "other", label: "Other", icon: "📸" },
];

const getCategoryIcon = (category: string) => {
  const cat = categories.find(c => c.value === category);
  return cat?.icon || "📸";
};

export function ScanGallery({ scans, onClose, onUpdate }: ScanGalleryProps) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedScan, setSelectedScan] = useState<ScanEntry | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [localScans, setLocalScans] = useState<ScanEntry[]>(scans);

  const toggleFavorite = async (e: React.MouseEvent, scan: ScanEntry) => {
    e.stopPropagation();
    const newFavoriteStatus = !scan.is_favorite;
    
    // Optimistic update
    setLocalScans(prev => prev.map(s => 
      s.id === scan.id ? { ...s, is_favorite: newFavoriteStatus } : s
    ));
    if (selectedScan?.id === scan.id) {
      setSelectedScan({ ...selectedScan, is_favorite: newFavoriteStatus });
    }

    const { error } = await supabase
      .from("scan_entries")
      .update({ is_favorite: newFavoriteStatus })
      .eq("id", scan.id);

    if (error) {
      // Revert on error
      setLocalScans(prev => prev.map(s => 
        s.id === scan.id ? { ...s, is_favorite: !newFavoriteStatus } : s
      ));
      toast.error("Failed to update favorite");
    } else {
      toast.success(newFavoriteStatus ? "Added to favorites" : "Removed from favorites");
      onUpdate?.();
    }
  };

  const filteredScans = localScans.filter(scan => {
    const categoryMatch = selectedCategory === "all" || scan.category === selectedCategory;
    const favoriteMatch = !showFavoritesOnly || scan.is_favorite;
    return categoryMatch && favoriteMatch;
  });

  const scansWithImages = filteredScans.filter(scan => scan.image_url);
  const favoriteCount = localScans.filter(s => s.is_favorite && s.image_url).length;

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold">Photo Gallery</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
            >
              {viewMode === "grid" ? (
                <List className="h-5 w-5" />
              ) : (
                <Grid3X3 className="h-5 w-5" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Favorites Toggle & Category Filter */}
        <div className="px-4 pb-3 overflow-x-auto">
          <div className="flex gap-2">
            {/* Favorites Toggle */}
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${
                showFavoritesOnly
                  ? "bg-warning text-warning-foreground"
                  : "bg-card border border-border/50 hover:border-warning/30"
              }`}
            >
              <Heart className={`h-4 w-4 ${showFavoritesOnly ? "fill-current" : ""}`} />
              <span>Favorites</span>
              <span className="text-xs opacity-70">({favoriteCount})</span>
            </button>
            
            {categories.map((cat) => {
              const count = cat.value === "all" 
                ? localScans.filter(s => s.image_url).length 
                : localScans.filter(s => s.category === cat.value && s.image_url).length;
              
              if (count === 0 && cat.value !== "all") return null;
              
              return (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${
                    selectedCategory === cat.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border/50 hover:border-primary/30"
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span className="text-xs opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Gallery Content */}
      <div className="p-4 pb-20 overflow-auto h-[calc(100vh-120px)]">
        {scansWithImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Filter className="h-12 w-12 mb-3 opacity-30" />
            <p>No photos in this category</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {scansWithImages.map((scan) => (
              <motion.div
                key={scan.id}
                className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedScan(scan)}
              >
                <img
                  src={scan.image_url!}
                  alt={scan.name || "Scan"}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-sm font-medium truncate">
                    {scan.name || "Unknown"}
                  </p>
                </div>
                <button
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
                  onClick={(e) => toggleFavorite(e, scan)}
                >
                  <Star className={`h-4 w-4 ${scan.is_favorite ? "text-warning fill-warning" : "text-white"}`} />
                </button>
                <div className="absolute top-2 left-2">
                  <span className="text-lg">{getCategoryIcon(scan.category)}</span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {scansWithImages.map((scan) => (
              <motion.div
                key={scan.id}
                className="flex gap-4 p-3 bg-card rounded-xl border border-border/50 cursor-pointer"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setSelectedScan(scan)}
              >
                <img
                  src={scan.image_url!}
                  alt={scan.name || "Scan"}
                  className="w-20 h-20 object-cover rounded-lg shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{getCategoryIcon(scan.category)}</span>
                    <h3 className="font-semibold truncate flex-1">{scan.name || "Unknown"}</h3>
                    <button
                      className="p-1 hover:bg-muted rounded-full transition-colors"
                      onClick={(e) => toggleFavorite(e, scan)}
                    >
                      <Star className={`h-4 w-4 shrink-0 ${scan.is_favorite ? "text-warning fill-warning" : "text-muted-foreground"}`} />
                    </button>
                  </div>
                  {scan.location_name && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {scan.location_name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(scan.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Full Image Modal */}
      <AnimatePresence>
        {selectedScan && (
          <motion.div
            className="fixed inset-0 z-60 bg-black/90 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedScan(null)}
          >
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getCategoryIcon(selectedScan.category)}</span>
                <div>
                  <h2 className="text-white font-semibold">{selectedScan.name || "Unknown"}</h2>
                  {selectedScan.location_name && (
                    <p className="text-white/70 text-sm flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {selectedScan.location_name}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(e, selectedScan);
                  }}
                >
                  <Star className={`h-6 w-6 ${selectedScan.is_favorite ? "text-warning fill-warning" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                  onClick={() => setSelectedScan(null)}
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              <motion.img
                src={selectedScan.image_url!}
                alt={selectedScan.name || "Scan"}
                className="max-w-full max-h-full object-contain rounded-lg"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            {selectedScan.description && (
              <div className="p-4 text-center">
                <p className="text-white/80 text-sm">{selectedScan.description}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}