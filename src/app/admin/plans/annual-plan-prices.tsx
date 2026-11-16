/** @jsxRuntime automatic */
/** @jsxImportSource react */
export function AnnualPlanPrices({
  plans,
}: {
  plans: { code: string; name: string; annualBase: string; annualTax: string; annualTotal: string }[];
}) {
  return (
    <>
      <h2 className="mt-8 font-display text-lg font-bold text-indigo">Annual pricing · USD</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-[#E4EBFF] bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="bg-[#F3EEFF] text-xs font-semibold text-indigo">
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Annual price</th>
              <th className="px-4 py-3">Estimated tax</th>
              <th className="px-4 py-3">Annual total</th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-muted">
                  No plans for this audience.
                </td>
              </tr>
            ) : (
              plans.map((plan) => (
                <tr key={plan.code} className="border-t border-[#F0F3FA]">
                  <td className="px-4 py-3 font-semibold text-indigo">{plan.name}</td>
                  <td className="px-4 py-3 tabular-nums text-indigo">{plan.annualBase}</td>
                  <td className="px-4 py-3 tabular-nums text-indigo">{plan.annualTax}</td>
                  <td className="px-4 py-3 tabular-nums text-indigo">{plan.annualTotal}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
