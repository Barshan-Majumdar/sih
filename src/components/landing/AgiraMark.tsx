type AgiraMarkProps = {
  size?: number;
};

const BARS = [
  { left: 0.22, top: 0.26, width: 0.4 },
  { left: 0.34, top: 0.46, width: 0.5 },
  { left: 0.22, top: 0.66, width: 0.32 },
];

export function AgiraMark({ size = 32 }: AgiraMarkProps) {
  const barHeight = Math.max(2, Math.round(size * 0.09));

  return (
    <span
      className="relative inline-flex shrink-0 rounded-md bg-primary"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {BARS.map((bar) => (
        <span
          key={bar.top}
          className="absolute rounded-full bg-on-primary"
          style={{
            left: size * bar.left,
            top: size * bar.top,
            width: size * bar.width,
            height: barHeight,
          }}
        />
      ))}
    </span>
  );
}
