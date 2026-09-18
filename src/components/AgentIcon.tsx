import Image from "next/image";

type AgentIconProps = {
  size?: number;
  className?: string;
};

export function AgentIcon({ size = 16, className = "" }: AgentIconProps) {
  return (
    <Image
      src="/agent-icon.png"
      alt=""
      width={size}
      height={size}
      className={`shrink-0 object-contain ${className}`}
      aria-hidden
    />
  );
}
