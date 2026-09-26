export function ErrorText({ children, className = "" }: { children?: string | null; className?: string }) {
  if (!children) return null;
  return <p className={`text-sm text-error mt-2 ${className}`.trim()}>{children}</p>;
}
