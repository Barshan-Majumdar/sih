import { LineChart } from "@/components/LineChart";
import { formatDate } from "@/lib/utils";
import type { SCurvePoint } from "@/lib/analytics";

export function SCurveChart({ sCurve }: { sCurve: { planned: SCurvePoint[]; actual: SCurvePoint[] } }) {
  const { planned, actual } = sCurve;
  if (planned.length === 0) {
    return <p className="text-sm text-muted text-center py-10">Not enough data yet.</p>;
  }

  const xLabels = planned.map((p) => formatDate(p.date));
  const actualValues: (number | null)[] = planned.map((p, i) => actual[i]?.cumulative ?? null);
  const yMax = Math.max(1, ...planned.map((p) => p.cumulative), ...actual.map((p) => p.cumulative));

  return (
    <LineChart
      xLabels={xLabels}
      series={[
        { name: "Planned", color: "var(--color-muted-soft, #9ca3af)", values: planned.map((p) => p.cumulative) },
        { name: "Actual", color: "var(--color-success, #10b981)", values: actualValues },
      ]}
      yMax={yMax}
    />
  );
}
