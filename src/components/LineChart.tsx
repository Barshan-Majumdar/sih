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

  // De-duplicate y-tick values to avoid duplicate grid lines and non-unique React keys when computedMax is small (e.g. <= 4)
  const yTicks = Math.min(4, Math.max(1, computedMax));
  const yTickValues = Array.from(
    new Set(
      Array.from({ length: yTicks + 1 }, (_, i) => Math.round((computedMax / yTicks) * i))
    )
  );

  if (allValues.length === 0) {
    return <p className="text-sm text-muted text-center py-10">Not enough data yet.</p>;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img">
        {yTickValues.map((tick, idx) => (
          <g key={`ytick-${tick}-${idx}`}>
            <line
              x1={paddingLeft}
              x2={width - paddingRight}
              y1={yFor(tick)}
              y2={yFor(tick)}
              stroke="var(--color-hairline)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <text x={0} y={yFor(tick) + 4} fontSize={10} fill="currentColor" className="text-muted-soft font-mono">
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
              <polyline points={points.join(" ")} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              {s.values.map((v, i) =>
                v === null ? null : (
                  <circle
                    key={`${s.name}-point-${i}`}
                    cx={xFor(i)}
                    cy={yFor(v)}
                    r={3.5}
                    fill={s.color}
                    stroke="var(--color-canvas)"
                    strokeWidth={1.5}
                  />
                )
              )}
            </g>
          );
        })}

        {xLabels.map((label, i) => {
          if (xLabels.length > 8 && i % Math.ceil(xLabels.length / 8) !== 0 && i !== xLabels.length - 1) return null;
          return (
            <text
              key={`xlabel-${i}-${label}`}
              x={xFor(i)}
              y={height - 8}
              fontSize={10}
              textAnchor="middle"
              fill="currentColor"
              className="text-muted-soft font-mono"
            >
              {label}
            </text>
          );
        })}
      </svg>

      <div className="flex flex-wrap items-center gap-4 mt-3">
        {series.map((s) => (
          <div key={`series-legend-${s.name}`} className="flex items-center gap-1.5 rounded-pill border border-hairline/80 bg-surface-soft/60 px-2.5 py-1 text-xs font-medium text-muted">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </div>
        ))}
      </div>
    </div>
  );
}
