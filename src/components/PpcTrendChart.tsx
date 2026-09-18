import { LineChart } from "@/components/LineChart";
import { formatDate } from "@/lib/utils";

export type PpcTrendPoint = { weekStart: Date; ppc: number; total: number; completed: number };

export function PpcTrendChart({ ppcTrend }: { ppcTrend: PpcTrendPoint[] }) {
  if (ppcTrend.length === 0) {
    return <p className="text-sm text-muted text-center py-10">No weekly commitments yet — PPC appears once tasks are committed on the Weekly Plan.</p>;
  }

  return (
    <LineChart
      xLabels={ppcTrend.map((p) => formatDate(p.weekStart))}
      series={[{ name: "PPC", color: "var(--color-brand-accent, #3b82f6)", values: ppcTrend.map((p) => p.ppc) }]}
      yMax={100}
      yFormat={(v) => `${v}%`}
    />
  );
}
