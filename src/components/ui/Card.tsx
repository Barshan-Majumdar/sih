import { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-hairline bg-canvas shadow-[0_1px_2px_rgba(17,17,17,0.04)] ${className}`}
      {...props}
    />
  );
}
