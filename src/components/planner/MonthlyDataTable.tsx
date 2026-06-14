import { monthLabel } from "../../lib/planner-i18n";
import { translate } from "../../lib/translate";
import { usePlanner } from "./PlannerProvider";

/** Editable per-month grid of energy taken/sent plus the derived price. */
export function MonthlyDataTable() {
	const t = translate;
	const { monthlyInputs, updateMonthlyInput, priceByMonth } = usePlanner();

	return (
		<div className="overflow-x-auto">
			<table className="w-full min-w-115 text-sm">
				<thead>
					<tr className="text-left text-xs uppercase tracking-wider text-(--ink-faint)">
						<th className="px-3 pb-3 font-medium">{t.dataMonth}</th>
						<th className="px-3 pb-3 font-medium">{t.dataTaken}</th>
						<th className="px-3 pb-3 font-medium">{t.dataSent}</th>
						<th className="px-3 pb-3 font-medium">{t.dataPrice}</th>
					</tr>
				</thead>
				<tbody>
					{monthlyInputs.map((input, idx) => (
						<tr
							key={input.month}
							className="border-t border-(--line) transition hover:bg-[rgba(42,212,255,0.04)]"
						>
							<td className="px-3 py-2.5 font-medium text-(--ink-soft)">
								{monthLabel(input.month)}
							</td>
							<td className="px-3 py-2.5">
								<input
									type="number"
									value={input.takenFromGrid}
									onChange={(e) =>
										updateMonthlyInput(idx, "takenFromGrid", e.target.value)
									}
									className="field w-24 px-2.5 py-1.5 tabular-nums"
								/>
							</td>
							<td className="px-3 py-2.5">
								<input
									type="number"
									value={input.sentToGrid}
									onChange={(e) =>
										updateMonthlyInput(idx, "sentToGrid", e.target.value)
									}
									className="field w-24 px-2.5 py-1.5 tabular-nums"
								/>
							</td>
							<td className="px-3 py-2.5 tabular-nums text-(--elec-amber)">
								{priceByMonth[input.month] != null
									? priceByMonth[input.month].toFixed(3)
									: "—"}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
