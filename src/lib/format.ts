/** Formats a number as whole euros, e.g. `1234` → `"1,234€"`. */
export const euro = (value: number): string =>
	`${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}€`;
