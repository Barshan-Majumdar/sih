import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`h-10 w-full rounded-md border border-hairline bg-canvas px-3.5 text-sm text-ink shadow-[0_1px_1px_rgba(17,17,17,0.02)] transition-all placeholder:text-muted-soft hover:border-muted-soft focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/5 ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
