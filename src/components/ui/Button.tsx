import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "text";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-active disabled:bg-primary-disabled disabled:text-muted",
  secondary:
    "bg-canvas text-ink border border-hairline shadow-sm hover:border-muted-soft hover:bg-surface-soft disabled:opacity-50",
  ghost: "bg-transparent text-body hover:bg-surface-soft hover:text-ink disabled:opacity-50",
  danger: "bg-error text-white hover:bg-red-600 disabled:opacity-50",
  text: "bg-transparent text-ink hover:bg-surface-soft disabled:opacity-50 h-auto px-2",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 text-sm font-semibold transition-all duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:active:translate-y-0 ${variantClasses[variant]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
