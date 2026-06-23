import { 
  Landmark, 
  Utensils, 
  Receipt, 
  MapPin, 
  Clock, 
  Camera as CameraIcon, 
  Shirt, 
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Languages
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { FeatureCard } from "@/components/ui/feature-card";
import { Button } from "@/components/ui/button";

interface ScanResultProps {
  result: {
    category: string;
    name: string;
    description: string;
    details?: Record<string, unknown>;
    extracted_text?: string;
    prices?: Array<{ item: string; price: number; currency: string }>;
    warnings?: string[];
    tips?: string[];
  };
  onTranslate?: (text: string) => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  monument: <Landmark className="h-6 w-6" />,
  menu: <Utensils className="h-6 w-6" />,
  restaurant: <Utensils className="h-6 w-6" />,
  ticket: <Receipt className="h-6 w-6" />,
  price_board: <Receipt className="h-6 w-6" />,
  sign: <MapPin className="h-6 w-6" />,
  nature: <Sparkles className="h-6 w-6" />,
  art: <Sparkles className="h-6 w-6" />,
  product: <Receipt className="h-6 w-6" />,
  document: <Receipt className="h-6 w-6" />,
  default: <Sparkles className="h-6 w-6" />,
};

export function ScanResult({ result, onTranslate }: ScanResultProps) {
  const icon = categoryIcons[result.category] || categoryIcons.default;
  const details = (result.details || {}) as Record<string, string | number | boolean>;
  const warnings = result.warnings || [];
  const tips = result.tips || [];
  const prices = result.prices || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <StatusBadge variant="primary" className="mb-1">
            {result.category.replace("_", " ").toUpperCase()}
          </StatusBadge>
          <h2 className="text-xl font-bold text-foreground">{result.name}</h2>
          <p className="text-muted-foreground text-sm mt-1">{result.description}</p>
        </div>
      </div>

      {/* Details Grid */}
      {Object.keys(details).length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {details.entry_price !== undefined && (
            <div className="bg-card rounded-xl p-3 border border-border/50">
              <p className="text-xs text-muted-foreground">Entry Price</p>
              <p className="font-semibold text-lg">{String(details.entry_price)}</p>
            </div>
          )}
          {details.opening_hours && (
            <div className="bg-card rounded-xl p-3 border border-border/50">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Hours
              </p>
              <p className="font-semibold">{String(details.opening_hours)}</p>
            </div>
          )}
          {details.photography !== undefined && (
            <div className="bg-card rounded-xl p-3 border border-border/50">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CameraIcon className="h-3 w-3" /> Photos
              </p>
              <p className="font-semibold">{details.photography ? "Allowed" : "Not Allowed"}</p>
            </div>
          )}
          {details.dress_code && (
            <div className="bg-card rounded-xl p-3 border border-border/50">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Shirt className="h-3 w-3" /> Dress Code
              </p>
              <p className="font-semibold">{String(details.dress_code)}</p>
            </div>
          )}
          {details.avg_price && (
            <div className="bg-card rounded-xl p-3 border border-border/50">
              <p className="text-xs text-muted-foreground">Avg. Price</p>
              <p className="font-semibold">{String(details.avg_price)}</p>
            </div>
          )}
          {details.cuisine && (
            <div className="bg-card rounded-xl p-3 border border-border/50">
              <p className="text-xs text-muted-foreground">Cuisine</p>
              <p className="font-semibold">{String(details.cuisine)}</p>
            </div>
          )}
        </div>
      )}

      {/* Prices */}
      {prices.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground">Prices</h3>
          <div className="grid grid-cols-1 gap-2">
            {prices.map((price, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-card rounded-xl p-3 border border-border/50"
              >
                <span className="text-sm">{price.item}</span>
                <span className="font-semibold">{price.currency} {price.price}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extracted Text */}
      {result.extracted_text && (
        <div className="bg-card rounded-xl p-3 border border-border/50 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Extracted Text</p>
            {onTranslate && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-primary"
                onClick={() => onTranslate(result.extracted_text!)}
              >
                <Languages className="h-3 w-3 mr-1" />
                Translate
              </Button>
            )}
          </div>
          <p className="text-sm">{result.extracted_text}</p>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((warning, i) => (
            <FeatureCard
              key={i}
              variant="warning"
              icon={<AlertTriangle className="h-4 w-4 text-warning" />}
              title={warning}
            />
          ))}
        </div>
      )}

      {/* Tips */}
      {tips.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground">Tips</h3>
          {tips.map((tip, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm text-foreground"
            >
              <ChevronRight className="h-4 w-4 text-primary shrink-0" />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
