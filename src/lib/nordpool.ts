import { fetchNordPoolPrices } from "./api";

/** NordPool base prices are stable per settlement year — cache them for a week. */
export const NORDPOOL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Fetches NordPool prices for a settlement year and averages them per month,
 * returning the raw base rate in €/kWh keyed by English month name.
 */
export async function loadNordPoolBase(
	year: string,
): Promise<Record<string, number>> {
	const json = await fetchNordPoolPrices({ data: { year } });
	const base: Record<string, number> = {};
	if (!json.success || !json.data.lt) return base;

	const totals: Record<string, { sum: number; count: number }> = {};
	for (const entry of json.data.lt) {
		const month = new Date(entry.timestamp * 1000).toLocaleString("en-US", {
			month: "long",
		});
		if (!totals[month]) totals[month] = { sum: 0, count: 0 };
		totals[month].sum += entry.price;
		totals[month].count += 1;
	}
	for (const month of Object.keys(totals)) {
		// Elering reports €/MWh; divide by 1000 for €/kWh.
		base[month] = totals[month].sum / totals[month].count / 1000;
	}
	return base;
}
