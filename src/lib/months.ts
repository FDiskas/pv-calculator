import type { MonthlyInput } from "./calculator";

/** Settlement year runs April → March, matching ESO billing periods. */
export const MONTHS = [
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
	"January",
	"February",
	"March",
] as const;

export const DEFAULT_MONTHLY_INPUTS: MonthlyInput[] = MONTHS.map((month) => ({
	month,
	sentToGrid: 0,
	takenFromGrid: 0,
	electricityPrice: 0.25,
}));
