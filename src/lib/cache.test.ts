// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFreshCache, writeCache } from "./cache";

afterEach(() => {
	localStorage.clear();
	vi.useRealTimers();
});

describe("cache", () => {
	it("reads back a value written within its TTL", () => {
		writeCache("k", { hello: "world" });
		expect(readFreshCache<{ hello: string }>("k", 1000)).toEqual({
			hello: "world",
		});
	});

	it("returns null for a missing key", () => {
		expect(readFreshCache("absent", 1000)).toBeNull();
	});

	it("treats an entry older than the TTL as missing", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
		writeCache("stale", 42);
		vi.setSystemTime(new Date("2026-01-01T00:00:05Z"));
		expect(readFreshCache("stale", 1000)).toBeNull();
	});

	it("returns null for malformed JSON instead of throwing", () => {
		localStorage.setItem("broken", "{not json");
		expect(readFreshCache("broken", 1000)).toBeNull();
	});
});
