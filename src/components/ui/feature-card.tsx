import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const featureCardVariants = cva(
  "relative flex items-center gap-3 sm:gap-4 rounded-xl p-3 sm:p-4 transition-all duration-200 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-card border border-border/50 hover:border-primary/30",
        warning: "bg-warning/10 border border-warning/30 hover:border-warning/50",
        danger: "bg-danger/10 border border-danger/30 hover:border-danger/50",
        success: "bg-success/10 border border-success/30 hover:border-success/50",
        info: "bg-info/10 border border-info/30 hover:border-info/50",
        glass: "glass border border-border/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface FeatureCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof featureCardVariants> {
  icon?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

const FeatureCard = React.forwardRef<HTMLDivElement, FeatureCardProps>(
  ({ className, variant, icon, title, subtitle, action, ...props }, ref) => {
    return (
      <div
        className={cn(featureCardVariants({ variant, className }))}
        ref={ref}
        {...props}
      >
        {icon && (
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground break-words text-sm sm:text-base">
            {title}
          </h3>
          {subtitle && (
            <div className="text-sm text-muted-foreground truncate">{subtitle}</div>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    );
  }
);
FeatureCard.displayName = "FeatureCard";

export { FeatureCard, featureCardVariants };
