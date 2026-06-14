import { useEffect, useState } from "react";
import { readFreshCache, writeCache } from "../lib/cache";
import { DEFAULT_TARIFFS, type TariffRates } from "../lib/calculator";
import {
	type EsoTariffResult,
	fetchEsoTariffs,
	TARIFFS_TTL_MS,
} from "../lib/eso-tariffs";

const TARIFFS_CACHE_KEY = "eso_tariffs_cache_v1";

/**
 * Loads the live ESO tariffs once on mount, served from a client-side cache
 * that lasts roughly half a year, falling back to the bundled defaults.
 */
export function useEsoTariffs(): {
	tariffs: TariffRates;
	tariffSource: EsoTariffResult["source"];
} {
	const [tariffs, setTariffs] = useState<TariffRates>(DEFAULT_TARIFFS);
	const [tariffSource, setTariffSource] =
		useState<EsoTariffResult["source"]>("fallback");

	useEffect(() => {
		const cached = readFreshCache<EsoTariffResult>(
			TARIFFS_CACHE_KEY,
			TARIFFS_TTL_MS,
		);
		if (cached) {
			setTariffs(cached.tariffs);
			setTariffSource(cached.source);
			return;
		}
		let cancelled = false;
		fetchEsoTariffs()
			.then((res) => {
				if (cancelled) return;
				setTariffs(res.tariffs);
				setTariffSource(res.source);
				writeCache(TARIFFS_CACHE_KEY, res);
			})
			.catch((e) => console.error("ESO tariff fetch failed", e));
		return () => {
			cancelled = true;
		};
	}, []);

	return { tariffs, tariffSource };
}
