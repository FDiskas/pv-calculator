/**
 * Small localStorage cache with a time-to-live. Values are stored alongside a
 * write timestamp and treated as missing once they age past `ttl`.
 */

interface CacheEntry<T> {
	ts: number;
	value: T;
}

/** Returns the cached value for `key`, or `null` when missing, stale, or unreadable. */
export function readFreshCache<T>(key: string, ttl: number): T | null {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as CacheEntry<T>;
		if (typeof parsed.ts !== "number" || Date.now() - parsed.ts > ttl) {
			return null;
		}
		return parsed.value;
	} catch {
		return null;
	}
}

/** Stores `value` under `key` stamped with the current time. */
export function writeCache<T>(key: string, value: T): void {
	try {
		const entry: CacheEntry<T> = { ts: Date.now(), value };
		localStorage.setItem(key, JSON.stringify(entry));
	} catch {
		/* ignore quota / serialization errors */
	}
}
