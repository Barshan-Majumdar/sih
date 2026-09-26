import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "text";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary shadow-[0_1px_3px_rgba(15,23,42,0.12),0_1px_2px_rgba(15,23,42,0.08)] hover:bg-primary-active active:scale-[0.98] disabled:bg-primary-disabled disabled:text-muted disabled:shadow-none",
  secondary:
    "bg-canvas text-ink border border-hairline shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-muted-soft/60 hover:bg-surface-soft active:scale-[0.98] disabled:opacity-50",
  ghost: "bg-transparent text-body hover:bg-surface-soft hover:text-ink active:scale-[0.98] disabled:opacity-50",
  danger: "bg-error text-white shadow-[0_1px_3px_rgba(239,68,68,0.2)] hover:bg-error/90 active:scale-[0.98] disabled:opacity-50",
  text: "bg-transparent text-ink hover:bg-surface-soft active:scale-[0.98] disabled:opacity-50 h-auto px-2",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-xs font-semibold tracking-tight transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:active:scale-100 ${variantClasses[variant]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
