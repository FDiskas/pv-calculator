/** Brand accent colors shared by the small presentational components. */
export const ACCENTS = {
	cyan: "var(--elec-cyan)",
	amber: "var(--elec-amber)",
	green: "var(--elec-green)",
} as const;

export type Accent = keyof typeof ACCENTS;
