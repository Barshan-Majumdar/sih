export type ChartSeries = {
  name: string;
  color: string;
  values: (number | null)[];
};

/**
 * Minimal dependency-free SVG line chart. Renders one or more series against
 * shared x-axis labels; each series may have a shorter `values` array than
 * `xLabels` (e.g. an "actual" line that stops at today) — missing trailing
 * points are simply not drawn.
 */
export function LineChart({
  xLabels,
  series,
  yMax,
  yFormat = (v) => String(v),
  height = 220,
}: {
  xLabels: string[];
  series: ChartSeries[];
  yMax?: number;
  yFormat?: (v: number) => string;
  height?: number;
}) {
  const width = 640;
  const paddingLeft = 40;
  const paddingRight = 12;
  const paddingTop = 12;
  const paddingBottom = 28;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const allValues = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const computedMax = yMax ?? Math.max(1, ...allValues);

  function xFor(index: number) {
    if (xLabels.length <= 1) return paddingLeft;
    return paddingLeft + (index / (xLabels.length - 1)) * plotWidth;
  }
  function yFor(value: number) {
    return paddingTop + plotHeight - (value / computedMax) * plotHeight;
  }

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((computedMax / yTicks) * i));

  if (allValues.length === 0) {
    return <p className="text-sm text-muted text-center py-10">Not enough data yet.</p>;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img">
        {yTickValues.map((tick) => (
          <g key={tick}>
            <line
              x1={paddingLeft}
              x2={width - paddingRight}
              y1={yFor(tick)}
              y2={yFor(tick)}
              stroke="var(--color-hairline-soft, #eee)"
              strokeWidth={1}
            />
            <text x={0} y={yFor(tick) + 4} fontSize={10} fill="currentColor" className="text-muted-soft">
              {yFormat(tick)}
            </text>
          </g>
        ))}

        {series.map((s) => {
          const points = s.values
            .map((v, i) => (v === null ? null : `${xFor(i)},${yFor(v)}`))
            .filter((p): p is string => p !== null);
          return (
            <g key={s.name}>
              <polyline points={points.join(" ")} fill="none" stroke={s.color} strokeWidth={2} />
              {s.values.map((v, i) =>
                v === null ? null : <circle key={i} cx={xFor(i)} cy={yFor(v)} r={2.5} fill={s.color} />
              )}
            </g>
          );
        })}

        {xLabels.map((label, i) => {
          if (xLabels.length > 8 && i % Math.ceil(xLabels.length / 8) !== 0 && i !== xLabels.length - 1) return null;
          return (
            <text
              key={i}
              x={xFor(i)}
              y={height - 8}
              fontSize={10}
              textAnchor="middle"
              fill="currentColor"
              className="text-muted-soft"
            >
              {label}
            </text>
          );
        })}
      </svg>

      <div className="flex flex-wrap items-center gap-4 mt-2">
        {series.map((s) => (
          <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </div>
        ))}
      </div>
    </div>
  );
}
