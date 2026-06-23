import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const actionButtonVariants = cva(
  "relative flex flex-col items-center justify-center gap-3 rounded-2xl font-semibold transition-all duration-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        scan: "bg-gradient-to-br from-primary to-accent text-primary-foreground glow-primary hover:shadow-[0_0_40px_-5px_hsl(175_80%_45%_/_0.5)]",
        location: "bg-gradient-to-br from-info to-blue-600 text-info-foreground hover:shadow-[0_0_40px_-5px_hsl(200_85%_55%_/_0.5)]",
        danger: "bg-gradient-to-br from-danger to-red-700 text-danger-foreground hover:shadow-[0_0_40px_-5px_hsl(0_75%_55%_/_0.5)]",
        warning: "bg-gradient-to-br from-warning to-orange-600 text-warning-foreground hover:shadow-[0_0_40px_-5px_hsl(38_95%_55%_/_0.5)]",
        glass: "glass border border-border/50 text-foreground hover:bg-card/80",
      },
      size: {
        default: "h-40 w-full p-6 text-lg",
        sm: "h-24 w-full p-4 text-base",
        lg: "h-48 w-full p-8 text-xl",
        icon: "h-14 w-14 p-3",
      },
    },
    defaultVariants: {
      variant: "scan",
      size: "default",
    },
  }
);

export interface ActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof actionButtonVariants> {
  icon?: React.ReactNode;
  subtitle?: string;
}

const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ className, variant, size, icon, subtitle, children, ...props }, ref) => {
    return (
      <button
        className={cn(actionButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {icon && <span className="text-4xl">{icon}</span>}
        <span className="text-center font-bold tracking-wide">{children}</span>
        {subtitle && (
          <span className="text-sm font-medium opacity-80">{subtitle}</span>
        )}
      </button>
    );
  }
);
ActionButton.displayName = "ActionButton";

export { ActionButton, actionButtonVariants };
