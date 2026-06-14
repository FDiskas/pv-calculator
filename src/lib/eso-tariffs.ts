import { createServerFn } from "@tanstack/react-start";
import { DEFAULT_TARIFFS, type TariffRates } from "./calculator";

export const ESO_TARIFFS_URL =
	"https://www.eso.lt/namams/elektra/tarifu-planai-kainos-atsiskaitymas/gaminanciu-vartotoju-atsiskaitymo-budai-2026-metais/4829";

// Cache the live tariffs for roughly half a year — VERT sets them annually,
// so re-parsing more often is wasteful.
export const TARIFFS_TTL_MS = 182 * 24 * 60 * 60 * 1000;

export interface EsoTariffResult {
	tariffs: TariffRates;
	source: "live" | "fallback";
	fetchedAt: number;
}

const toNumber = (raw: string) => parseFloat(raw.replace(",", "."));

/**
 * Finds the first number matching `pattern` that appears after `label` in the
 * plain text. The ESO table lists the low-voltage (residential) value first,
 * so the first match after each label is the one we want.
 */
function matchAfterLabel(
	text: string,
	label: RegExp,
	pattern: RegExp,
): string | null {
	const labelMatch = label.exec(text);
	if (!labelMatch) {
		return null;
	}
	const window = text.slice(
		labelMatch.index + labelMatch[0].length,
		labelMatch.index + labelMatch[0].length + 240,
	);
	const valueMatch = pattern.exec(window);
	return valueMatch ? valueMatch[1] : null;
}

/**
 * Parses the three prosumer settlement tariffs out of the ESO page HTML.
 * Returns null if any value is missing or out of a sane range, so callers can
 * fall back to the verified defaults rather than trust a malformed parse.
 */
export function parseEsoTariffs(html: string): TariffRates | null {
	const text = html
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/&[a-z]+;/gi, " ")
		.replace(/\s+/g, " ");

	// Lithuanian words carry diacritics (ą, ė, …) that \w does not match, so the
	// word continuations use \S* (any non-space run) instead.
	const reclaimRaw = matchAfterLabel(
		text,
		/atgaut\S*\s+energij/i,
		/(\d+[.,]\d+)/,
	);
	const capacityRaw = matchAfterLabel(
		text,
		/leistin\S*\s+generuoti/i,
		/(\d+[.,]\d+)/,
	);
	// The page states the user's retained share directly, e.g.
	// "gaminančiam vartotojui lieka 63%". The first (low-voltage) match wins.
	const userShareRaw = matchAfterLabel(
		text,
		/vartotojui\s+lieka/i,
		/(\d+)\s*%/,
	);

	if (reclaimRaw === null || capacityRaw === null || userShareRaw === null) {
		return null;
	}

	const reclaimFeePerKWh = toNumber(reclaimRaw);
	const capacityFeePerKW = toNumber(capacityRaw);
	const userSharePct = toNumber(userShareRaw);
	const energyShare = userSharePct / 100;

	const sane =
		reclaimFeePerKWh > 0.001 &&
		reclaimFeePerKWh < 1 &&
		capacityFeePerKW > 0.1 &&
		capacityFeePerKW < 50 &&
		userSharePct > 0 &&
		userSharePct < 100;

	if (!sane) {
		return null;
	}

	return { reclaimFeePerKWh, capacityFeePerKW, energyShare };
}

let cache: EsoTariffResult | null = null;

/**
 * Server function that returns the current ESO tariffs, parsed live from the
 * ESO page and cached in memory for ~half a year. Any failure (network, parse,
 * non-OK response) degrades gracefully to the verified 2026 defaults.
 */
export const fetchEsoTariffs = createServerFn({ method: "GET" }).handler(
	async (): Promise<EsoTariffResult> => {
		if (cache && Date.now() - cache.fetchedAt < TARIFFS_TTL_MS) {
			return cache;
		}

		try {
			const res = await fetch(ESO_TARIFFS_URL, {
				headers: { "User-Agent": "Mozilla/5.0 (compatible; VoltInvest/1.0)" },
			});
			if (res.ok) {
				const parsed = parseEsoTariffs(await res.text());
				if (parsed) {
					cache = { tariffs: parsed, source: "live", fetchedAt: Date.now() };
					return cache;
				}
			}
		} catch (error) {
			console.error("Failed to fetch ESO tariffs", error);
		}

		cache = {
			tariffs: DEFAULT_TARIFFS,
			source: "fallback",
			fetchedAt: Date.now(),
		};
		return cache;
	},
);
