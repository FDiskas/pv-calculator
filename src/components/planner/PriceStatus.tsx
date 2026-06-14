import { Euro, Percent, TrendingUp } from "lucide-react";
import { translate } from "../../lib/translate";
import { usePlanner } from "./PlannerProvider";

/** NordPool price status line with the year picker, VAT, and operator inputs. */
export function PriceStatus() {
	const t = translate;
	const {
		isLoadingPrices,
		nordPoolYear,
		setNordPoolYear,
		vat,
		setVat,
		operatorCost,
		setOperatorCost,
	} = usePlanner();

	return (
		<div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-(--line) pt-4 text-xs text-(--ink-soft)">
			<span className="flex items-center gap-1.5">
				{isLoadingPrices ? (
					<span className="h-3 w-3 animate-spin rounded-full border-2 border-(--ink-faint) border-t-(--elec-amber)" />
				) : (
					<TrendingUp className="h-3.5 w-3.5 text-(--elec-amber)" />
				)}
				{t.priceAutoLoaded}
			</span>
			<select
				value={nordPoolYear}
				onChange={(e) => setNordPoolYear(e.target.value)}
				className="field field-amber px-2.5 py-1"
				aria-label={t.priceYearAria}
			>
				<option value="2024">2024–2025</option>
				<option value="2025">2025–2026</option>
			</select>
			<span className="flex items-center gap-1.5">
				<Percent className="h-3 w-3" />
				{t.priceVat}
				<input
					type="number"
					value={vat}
					onChange={(e) => setVat(parseInt(e.target.value, 10) || 0)}
					className="field field-amber w-14 px-2 py-1 tabular-nums"
				/>
			</span>
			<span className="flex items-center gap-1.5">
				<Euro className="h-3 w-3" />
				{t.priceOperator}
				<input
					type="number"
					step="0.001"
					value={operatorCost}
					onChange={(e) => setOperatorCost(parseFloat(e.target.value) || 0)}
					className="field field-amber w-20 px-2 py-1 tabular-nums"
				/>
			</span>
		</div>
	);
}
