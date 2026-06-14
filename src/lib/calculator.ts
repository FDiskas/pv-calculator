export interface MonthlyInput {
	month: string;
	sentToGrid: number; // Surplus electricity sent to grid from PV
	takenFromGrid: number; // Taken from grid
	electricityPrice: number; // Price for this month
}

export interface CalculationResult {
	month: string;
	takenFromGrid: number;
	coveredByBattery: number;
	sentToGridWithBattery: number;
	takenFromGridWithBattery: number;
	storedInGrid: number;
	deficit: number;
	reclaimedFromStorage: number;
	reclaimTotal: number;
	purchaseTotal: number;
	grandTotal: number;
}

export interface PlanComparison {
	planName: string;
	planSubtitle: string;
	reclaimCost: number;
	purchaseCost: number;
	capacityCost: number;
	grandTotal: number;
	totalReclaimed: number;
	totalDeficit: number;
	totalStored: number;
	reclaimPricePerKWh: number;
}

/**
 * The three ESO settlement tariffs for prosumers. These are injected into the
 * calculator so they can be sourced live from ESO (see lib/eso-tariffs.ts)
 * while still falling back to the verified 2026 defaults below.
 */
export interface TariffRates {
	reclaimFeePerKWh: number; // Plan I — paid per kWh reclaimed from storage
	capacityFeePerKW: number; // Plan II — per allowed kW per month
	energyShare: number; // Plan III — fraction of energy that remains for the user
}

export const DEFAULT_TARIFFS: TariffRates = {
	reclaimFeePerKWh: 0.0726,
	capacityFeePerKW: 5.0336,
	energyShare: 0.63,
};

export const ESO_PRICES = {
	BATTERY_COST_PER_KWH: 400,
	BATTERY_RECUP_YEARS: 25,
};

/** Battery sizes (kWh) offered in the comparison matrix. */
export const SCAN_SIZES = [5, 10, 15, 20, 25] as const;

export interface SizeRecommendation {
	size: number;
	annualSaving: number;
	batteryCost: number;
	yearsToRecup: number;
}

export function evaluatePlans(
	inputs: MonthlyInput[],
	batterySize: number,
	capacityKW: number,
	tariffs: TariffRates = DEFAULT_TARIFFS,
) {
	// We evaluate each plan both WITH and WITHOUT battery
	const resultsNoBattery = calculateResults(inputs, 0, tariffs);
	const resultsWithBattery = calculateResults(inputs, batterySize, tariffs);

	const totalTakenFromGrid = resultsWithBattery.reduce(
		(acc, r) => acc + r.takenFromGridWithBattery,
		0,
	);
	const totalSentToGrid = resultsWithBattery.reduce(
		(acc, r) => acc + r.sentToGridWithBattery,
		0,
	);
	const totalCoveredByBattery = resultsWithBattery.reduce(
		(acc, r) => acc + r.coveredByBattery,
		0,
	);

	return {
		noBattery: [
			calculatePlanTotals(
				calculatePlanResults(inputs, 0, 1, tariffs),
				1,
				capacityKW,
				tariffs,
			),
			calculatePlanTotals(
				calculatePlanResults(inputs, 0, 1, tariffs),
				2,
				capacityKW,
				tariffs,
			),
			calculatePlanTotals(
				calculatePlanResults(inputs, 0, tariffs.energyShare, tariffs),
				3,
				capacityKW,
				tariffs,
			),
		],
		withBattery: [
			calculatePlanTotals(
				calculatePlanResults(inputs, batterySize, 1, tariffs),
				1,
				capacityKW,
				tariffs,
			),
			calculatePlanTotals(
				calculatePlanResults(inputs, batterySize, 1, tariffs),
				2,
				capacityKW,
				tariffs,
			),
			calculatePlanTotals(
				calculatePlanResults(inputs, batterySize, tariffs.energyShare, tariffs),
				3,
				capacityKW,
				tariffs,
			),
		],
		resultsWithBattery,
		resultsNoBattery,
		totalTakenFromGrid,
		totalSentToGrid,
		totalCoveredByBattery,
	};
}

/**
 * Evaluates a fixed range of battery sizes so the user can compare which size
 * pays back fastest. Each entry carries its annual saving versus no battery,
 * upfront cost, and the resulting payback period in years.
 */
export function getBatteryRecommendation(
	inputs: MonthlyInput[],
	capacityKW: number,
	batteryCostPerKWh: number,
	tariffs: TariffRates = DEFAULT_TARIFFS,
	sizes: readonly number[] = SCAN_SIZES,
): SizeRecommendation[] {
	return sizes.map((size) => {
		const evalResult = evaluatePlans(inputs, size, capacityKW, tariffs);
		const bestPlanWithBattery = Math.min(
			...evalResult.withBattery.map((p) => p.grandTotal),
		);
		const bestPlanNoBattery = Math.min(
			...evalResult.noBattery.map((p) => p.grandTotal),
		);
		const annualSaving = bestPlanNoBattery - bestPlanWithBattery;
		const batteryCost = size * batteryCostPerKWh;
		const yearsToRecup =
			annualSaving > 0 ? batteryCost / annualSaving : Infinity;

		return { size, annualSaving, batteryCost, yearsToRecup };
	});
}

/**
 * Picks the size the user should actually buy: the largest battery that still
 * pays back within the target window. Larger batteries save more in absolute
 * terms (until coverage saturates), so the biggest one inside the target is the
 * most worthwhile purchase. Returns null when no size pays back in time.
 */
export function pickRecommendedSize(
	recommendations: SizeRecommendation[],
	targetYears: number,
): SizeRecommendation | null {
	const affordable = recommendations.filter(
		(rec) =>
			rec.size > 0 &&
			rec.annualSaving > 0 &&
			Number.isFinite(rec.yearsToRecup) &&
			rec.yearsToRecup <= targetYears,
	);
	if (affordable.length === 0) {
		return null;
	}

	return affordable.reduce((best, rec) => {
		if (rec.annualSaving > best.annualSaving + 1e-9) {
			return rec;
		}
		const sameSaving = Math.abs(rec.annualSaving - best.annualSaving) < 1e-9;
		return sameSaving && rec.size < best.size ? rec : best;
	});
}

export function calculateResults(
	inputs: MonthlyInput[],
	batterySize: number,
	tariffs: TariffRates = DEFAULT_TARIFFS,
): CalculationResult[] {
	let accumulatedStorage = 0;

	return inputs.map((input) => {
		const coveredByBattery = calculateBatteryCoverage(
			batterySize,
			input.takenFromGrid,
			input.sentToGrid,
		);

		const sentToGridWithBattery = Math.max(
			0,
			input.sentToGrid - coveredByBattery,
		);
		const takenFromGridWithBattery = Math.max(
			0,
			input.takenFromGrid - coveredByBattery,
		);

		accumulatedStorage += sentToGridWithBattery;

		const reclaimedFromStorage = Math.min(
			accumulatedStorage,
			takenFromGridWithBattery,
		);
		accumulatedStorage -= reclaimedFromStorage;

		const deficit = takenFromGridWithBattery - reclaimedFromStorage;

		return {
			month: input.month,
			takenFromGrid: input.takenFromGrid,
			coveredByBattery,
			sentToGridWithBattery,
			takenFromGridWithBattery,
			storedInGrid: accumulatedStorage,
			deficit,
			reclaimedFromStorage: reclaimedFromStorage,
			reclaimTotal: reclaimedFromStorage * tariffs.reclaimFeePerKWh,
			purchaseTotal: deficit * input.electricityPrice,
			grandTotal:
				reclaimedFromStorage * tariffs.reclaimFeePerKWh +
				deficit * input.electricityPrice,
		};
	});
}

export function calculatePlanResults(
	inputs: MonthlyInput[],
	batterySize: number,
	energyShare: number,
	tariffs: TariffRates = DEFAULT_TARIFFS,
): CalculationResult[] {
	let accumulatedStorage = 0;

	return inputs.map((input) => {
		const coveredByBattery = calculateBatteryCoverage(
			batterySize,
			input.takenFromGrid,
			input.sentToGrid,
		);

		const sentToGridWithBattery = Math.max(
			0,
			input.sentToGrid - coveredByBattery,
		);
		const takenFromGridWithBattery = Math.max(
			0,
			input.takenFromGrid - coveredByBattery,
		);

		accumulatedStorage += sentToGridWithBattery * energyShare;

		const reclaimedFromStorage = Math.min(
			accumulatedStorage,
			takenFromGridWithBattery,
		);
		accumulatedStorage -= reclaimedFromStorage;

		const deficit = takenFromGridWithBattery - reclaimedFromStorage;

		return {
			month: input.month,
			takenFromGrid: input.takenFromGrid,
			coveredByBattery,
			sentToGridWithBattery,
			takenFromGridWithBattery,
			storedInGrid: accumulatedStorage,
			deficit,
			reclaimedFromStorage: reclaimedFromStorage,
			reclaimTotal: reclaimedFromStorage * tariffs.reclaimFeePerKWh,
			purchaseTotal: deficit * input.electricityPrice,
			grandTotal:
				reclaimedFromStorage * tariffs.reclaimFeePerKWh +
				deficit * input.electricityPrice,
		};
	});
}

export function calculatePlanTotals(
	results: CalculationResult[],
	planType: 1 | 2 | 3,
	capacityKW: number,
	tariffs: TariffRates = DEFAULT_TARIFFS,
) {
	// Total sent to grid in the scenario
	const totalSent = results.reduce(
		(acc, r) => acc + r.sentToGridWithBattery,
		0,
	);
	const totalReclaimed = results.reduce((acc, r) => {
		return acc + r.reclaimedFromStorage;
	}, 0);
	const totalPurchaseCost = results.reduce((acc, r) => {
		return acc + r.purchaseTotal;
	}, 0);

	if (planType === 1) {
		const plan1: PlanComparison = {
			planName: "Plan I",
			planSubtitle: "Pay per kWh reclaimed",
			reclaimCost: totalReclaimed * tariffs.reclaimFeePerKWh,
			purchaseCost: totalPurchaseCost,
			capacityCost: 0,
			grandTotal: totalReclaimed * tariffs.reclaimFeePerKWh + totalPurchaseCost,
			totalReclaimed: totalReclaimed,
			totalDeficit: results.reduce((acc, r) => acc + r.deficit, 0),
			totalStored: totalSent,
			reclaimPricePerKWh: tariffs.reclaimFeePerKWh,
		};
		return plan1;
	}

	if (planType === 2) {
		const plan2: PlanComparison = {
			planName: "Plan II",
			planSubtitle: "Pay for capacity",
			reclaimCost: 0,
			purchaseCost: totalPurchaseCost,
			capacityCost: tariffs.capacityFeePerKW * capacityKW * 12,
			grandTotal:
				totalPurchaseCost + tariffs.capacityFeePerKW * capacityKW * 12,
			totalReclaimed: totalReclaimed,
			totalDeficit: results.reduce((acc, r) => acc + r.deficit, 0),
			totalStored: totalSent,
			reclaimPricePerKWh: 0,
		};
		return plan2;
	}

	const plan3: PlanComparison = {
		planName: "Plan III",
		planSubtitle: `Energy exchange ${Math.round((1 - tariffs.energyShare) * 100)}%`,
		reclaimCost: 0,
		purchaseCost: totalPurchaseCost,
		capacityCost: 0,
		grandTotal: totalPurchaseCost,
		totalReclaimed: totalReclaimed,
		totalDeficit: results.reduce((acc, r) => acc + r.deficit, 0),
		totalStored: totalSent * tariffs.energyShare,
		reclaimPricePerKWh: 0,
	};
	return plan3;
}

export function calculateBatteryCoverage(
	batterySize: number,
	takenFromGrid: number,
	sentToGrid: number,
) {
	// Rough presumption: used from a battery during night, charged during day.
	// Capacity * 30 is the max charge/discharge per month (one full cycle per day).
	return Math.min(batterySize * 30, Math.min(takenFromGrid, sentToGrid));
}
