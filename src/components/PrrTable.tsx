export type PrrRow = { memberId: string; name: string; prr: number; total: number; completed: number };

export function PrrTable({ prrByMember }: { prrByMember: PrrRow[] }) {
  if (prrByMember.length === 0) {
    return (
      <p className="text-sm text-muted text-center py-10">
        No commitments yet — PRR appears once trades commit to tasks on the Weekly Plan.
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-hairline-soft text-left">
          <th className="app-table-heading py-2">Member</th>
          <th className="app-table-heading py-2 text-right">Commitments</th>
          <th className="app-table-heading py-2 text-right">PRR</th>
        </tr>
      </thead>
      <tbody>
        {prrByMember.map((row) => (
          <tr key={row.memberId} className="app-table-row border-b border-hairline-soft last:border-b-0">
            <td className="py-2">{row.name}</td>
            <td className="py-2 text-right text-muted">
              {row.completed}/{row.total}
            </td>
            <td className="py-2 text-right">
              <span className={row.prr >= 80 ? "text-success" : row.prr >= 50 ? "text-ink" : "text-error"}>
                {row.prr}%
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
