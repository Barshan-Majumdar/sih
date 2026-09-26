import { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-hairline/80 bg-surface-card shadow-card transition-all ${className}`}
      {...props}
    />
  );
}
