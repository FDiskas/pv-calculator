export interface MonthlyInput {
	month: string;
	sentToGrid: number; // Surplus PV electricity exported to the grid
	takenFromGrid: number; // Electricity imported from the grid
	electricityPrice: number; // €/kWh for this month
}

interface MonthlyResult {
	coveredByBattery: number;
	sentToGridWithBattery: number;
	reclaimedFromStorage: number;
	deficit: number;
	purchaseTotal: number;
}

interface PlanComparison {
	planName: string;
	reclaimCost: number;
	purchaseCost: number;
	capacityCost: number;
	grandTotal: number;
	totalReclaimed: number;
	totalDeficit: number;
	totalStored: number;
}

/**
 * The three ESO settlement tariffs for prosumers. Sourced live from ESO when
 * available (see lib/eso-tariffs.ts), falling back to the verified 2026 values.
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
};

/** Battery sizes (kWh) offered in the comparison matrix. */
const SCAN_SIZES = [5, 10, 15, 20, 25] as const;

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
	// Plans I and II settle the full stored surplus; Plan III only the share the
	// prosumer retains. Battery coverage is independent of that share, so the
	// full-share run also provides the kWh covered by the battery.
	const noBatteryFull = simulateMonths(inputs, 0, 1);
	const noBatteryShare = simulateMonths(inputs, 0, tariffs.energyShare);
	const withBatteryFull = simulateMonths(inputs, batterySize, 1);
	const withBatteryShare = simulateMonths(
		inputs,
		batterySize,
		tariffs.energyShare,
	);

	const totalCoveredByBattery = withBatteryFull.reduce(
		(acc, r) => acc + r.coveredByBattery,
		0,
	);

	return {
		noBattery: [
			summarizePlan(noBatteryFull, 1, capacityKW, tariffs),
			summarizePlan(noBatteryFull, 2, capacityKW, tariffs),
			summarizePlan(noBatteryShare, 3, capacityKW, tariffs),
		],
		withBattery: [
			summarizePlan(withBatteryFull, 1, capacityKW, tariffs),
			summarizePlan(withBatteryFull, 2, capacityKW, tariffs),
			summarizePlan(withBatteryShare, 3, capacityKW, tariffs),
		],
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

/**
 * Walks the 12 months, charging the battery from monthly surplus and drawing it
 * down against grid imports. `energyShare` is the fraction of exported surplus
 * that returns as usable storage (1 for per-kWh/capacity plans, < 1 for the
 * energy-exchange plan).
 */
function simulateMonths(
	inputs: MonthlyInput[],
	batterySize: number,
	energyShare: number,
): MonthlyResult[] {
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
			coveredByBattery,
			sentToGridWithBattery,
			reclaimedFromStorage,
			deficit,
			purchaseTotal: deficit * input.electricityPrice,
		};
	});
}

function summarizePlan(
	results: MonthlyResult[],
	planType: 1 | 2 | 3,
	capacityKW: number,
	tariffs: TariffRates,
): PlanComparison {
	const totalStored = results.reduce(
		(acc, r) => acc + r.sentToGridWithBattery,
		0,
	);
	const totalReclaimed = results.reduce(
		(acc, r) => acc + r.reclaimedFromStorage,
		0,
	);
	const totalPurchaseCost = results.reduce(
		(acc, r) => acc + r.purchaseTotal,
		0,
	);
	const totalDeficit = results.reduce((acc, r) => acc + r.deficit, 0);

	if (planType === 1) {
		const reclaimCost = totalReclaimed * tariffs.reclaimFeePerKWh;
		return {
			planName: "Plan I",
			reclaimCost,
			purchaseCost: totalPurchaseCost,
			capacityCost: 0,
			grandTotal: reclaimCost + totalPurchaseCost,
			totalReclaimed,
			totalDeficit,
			totalStored,
		};
	}

	if (planType === 2) {
		const capacityCost = tariffs.capacityFeePerKW * capacityKW * 12;
		return {
			planName: "Plan II",
			reclaimCost: 0,
			purchaseCost: totalPurchaseCost,
			capacityCost,
			grandTotal: totalPurchaseCost + capacityCost,
			totalReclaimed,
			totalDeficit,
			totalStored,
		};
	}

	return {
		planName: "Plan III",
		reclaimCost: 0,
		purchaseCost: totalPurchaseCost,
		capacityCost: 0,
		grandTotal: totalPurchaseCost,
		totalReclaimed,
		totalDeficit,
		totalStored: totalStored * tariffs.energyShare,
	};
}

function calculateBatteryCoverage(
	batterySize: number,
	takenFromGrid: number,
	sentToGrid: number,
) {
	// Rough model: the battery charges from PV surplus by day and discharges at
	// night. batterySize * 30 caps it at one full cycle per day across the month.
	return Math.min(batterySize * 30, Math.min(takenFromGrid, sentToGrid));
}
