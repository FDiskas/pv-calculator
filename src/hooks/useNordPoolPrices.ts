import { useEffect, useState } from "react";
import { readFreshCache, writeCache } from "../lib/cache";
import { loadNordPoolBase, NORDPOOL_TTL_MS } from "../lib/nordpool";

/**
 * Owns the selected settlement year and the NordPool base prices fetched for
 * it. Prices are cached client-side per year and reloaded when the year changes.
 */
export function useNordPoolPrices(initialYear = "2025"): {
	nordPoolYear: string;
	setNordPoolYear: (year: string) => void;
	nordPoolBase: Record<string, number>;
	isLoadingPrices: boolean;
} {
	const [nordPoolYear, setNordPoolYear] = useState<string>(initialYear);
	const [nordPoolBase, setNordPoolBase] = useState<Record<string, number>>({});
	const [isLoadingPrices, setIsLoadingPrices] = useState(false);

	useEffect(() => {
		const cacheKey = `nordpool_base_${nordPoolYear}`;
		const cached = readFreshCache<Record<string, number>>(
			cacheKey,
			NORDPOOL_TTL_MS,
		);
		if (cached) {
			setNordPoolBase(cached);
			return;
		}
		let cancelled = false;
		setIsLoadingPrices(true);
		loadNordPoolBase(nordPoolYear)
			.then((base) => {
				if (cancelled) return;
				setNordPoolBase(base);
				writeCache(cacheKey, base);
			})
			.catch((e) => console.error("NordPool fetch failed", e))
			.finally(() => {
				if (!cancelled) setIsLoadingPrices(false);
			});
		return () => {
			cancelled = true;
		};
	}, [nordPoolYear]);

	return { nordPoolYear, setNordPoolYear, nordPoolBase, isLoadingPrices };
}
