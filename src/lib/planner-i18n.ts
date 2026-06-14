import type { TariffRates } from "./calculator";
import { translate, withParams } from "./translate";

/**
 * Localization helpers for planner domain values (month names, plan labels,
 * import errors). Each reads the `translate` singleton at call time, so they
 * must be invoked during render to pick up the active language.
 */

export function monthLabel(month: string): string {
	const t = translate;
	const labels: Record<string, string> = {
		January: t.monthJanuary,
		February: t.monthFebruary,
		March: t.monthMarch,
		April: t.monthApril,
		May: t.monthMay,
		June: t.monthJune,
		July: t.monthJuly,
		August: t.monthAugust,
		September: t.monthSeptember,
		October: t.monthOctober,
		November: t.monthNovember,
		December: t.monthDecember,
	};
	return labels[month] ?? month;
}

/** Share of energy settled outside the exchange, as a whole percentage. */
export function energyExchangePct(tariffs: TariffRates): number {
	return Math.round((1 - tariffs.energyShare) * 100);
}

export function planDisplayName(name: string): string {
	const t = translate;
	switch (name) {
		case "Plan I":
			return t.planIName;
		case "Plan II":
			return t.planIIName;
		case "Plan III":
			return t.planIIIName;
		default:
			return name;
	}
}

export function planDisplaySubtitle(name: string, exchangePct: number): string {
	const t = translate;
	switch (name) {
		case "Plan I":
			return t.planISubtitle;
		case "Plan II":
			return t.planIISubtitle;
		default:
			return withParams(t.planIIISubtitle, { percent: exchangePct });
	}
}

export function localizeError(msg: string): string {
	const t = translate;
	switch (msg) {
		case "Unexpected CSV format — missing period, product code, or quantity column.":
			return t.errCsvFormat;
		case "No CSV file found inside the ZIP archive.":
			return t.errNoCsv;
		case "No usable rows parsed from CSV.":
			return t.errNoRows;
		default:
			return t.errImportFailed;
	}
}
