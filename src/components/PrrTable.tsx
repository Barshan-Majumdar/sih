export type PrrRow = { memberId: string; name: string; prr: number; total: number; completed: number };

export function PrrTable({ prrByMember }: { prrByMember: PrrRow[] }) {
  if (prrByMember.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-hairline bg-surface-soft/40 py-10 text-center">
        <p className="text-xs text-muted">
          No commitments yet — PRR appears once trades commit to tasks on the Weekly Plan.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-hairline text-[11px] font-bold uppercase tracking-wider text-muted">
            <th className="pb-2.5">Member / Trade</th>
            <th className="pb-2.5 text-right">Commitments</th>
            <th className="pb-2.5 text-right">PRR</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {prrByMember.map((row) => {
            const badgeClass =
              row.prr >= 80
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                : row.prr >= 50
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20";

            return (
              <tr key={row.memberId} className="hover:bg-surface-soft/40 transition-colors">
                <td className="py-2.5 font-medium text-ink">{row.name}</td>
                <td className="py-2.5 text-right font-mono text-xs text-muted">
                  {row.completed} / {row.total}
                </td>
                <td className="py-2.5 text-right">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold font-mono border ${badgeClass}`}>
                    {row.prr}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
