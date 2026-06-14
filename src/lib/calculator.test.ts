import { describe, expect, it } from "vitest";
import { pickRecommendedSize, type SizeRecommendation } from "./calculator";

const rec = (
	size: number,
	annualSaving: number,
	yearsToRecup: number,
): SizeRecommendation => ({
	size,
	annualSaving,
	batteryCost: size * 400,
	yearsToRecup,
});

describe("pickRecommendedSize", () => {
	it("recommends the largest battery that still pays back within the target", () => {
		const recs = [
			rec(5, 200, 10),
			rec(10, 350, 11),
			rec(15, 420, 14),
			rec(20, 430, 19), // saves most, still under a 20-year target
			rec(25, 435, 23), // beyond target — rejected
		];

		expect(pickRecommendedSize(recs, 20)?.size).toBe(20);
	});

	it("returns null when no size pays back within the target", () => {
		const recs = [rec(5, 50, 40), rec(10, 80, 50)];
		expect(pickRecommendedSize(recs, 20)).toBeNull();
	});

	it("ignores sizes that never recoup", () => {
		const recs = [rec(5, 0, Infinity), rec(10, 300, 13)];
		expect(pickRecommendedSize(recs, 20)?.size).toBe(10);
	});

	it("prefers the smaller size when savings tie", () => {
		const recs = [rec(10, 300, 13), rec(15, 300, 20)];
		expect(pickRecommendedSize(recs, 20)?.size).toBe(10);
	});
});
