import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`h-9 w-full rounded-lg border border-hairline bg-canvas px-3.5 text-xs text-ink shadow-[0_1px_2px_rgba(15,23,42,0.02)] transition-all placeholder:text-muted-soft hover:border-muted-soft/80 focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/15 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
