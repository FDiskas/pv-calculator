export interface MonthlyInput {
	month: string;
	sentToGrid: number; // Surplus electricity sent to grid from PV
	purchasedFromGrid: number; // Purchased at full price
	reclaimedFromGrid: number; // Reclaimed from grid storage
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
}

export const ESO_PRICES = {
	PLAN_1_RECLAIM_FEE: 0.0726,
	PLAN_2_CAPACITY_FEE: 5.0336, // per kW per month
	PLAN_3_ENERGY_SHARE: 0.63, // 63% remains for the user
	BATTERY_COST_PER_KWH: 400,
	BATTERY_RECUP_YEARS: 25,
};

export function calculateBatteryCoverage(
	batterySize: number,
	takenFromGrid: number,
	sentToGrid: number,
) {
	// Rough presumption: used from a battery during night, charged during day.
	// Capacity * 30 is the max charge/discharge per month (one full cycle per day).
	return Math.min(batterySize * 30, Math.min(takenFromGrid, sentToGrid));
}

export function calculateResults(
	inputs: MonthlyInput[],
	batterySize: number,
): CalculationResult[] {
	let accumulatedStorage = 0;

	return inputs.map((input) => {
		const takenFromGrid = input.purchasedFromGrid + input.reclaimedFromGrid;
		const coveredByBattery = calculateBatteryCoverage(
			batterySize,
			takenFromGrid,
			input.sentToGrid,
		);

		const sentToGridWithBattery = Math.max(
			0,
			input.sentToGrid - coveredByBattery,
		);
		const takenFromGridWithBattery = Math.max(
			0,
			takenFromGrid - coveredByBattery,
		);

		// Grid storage logic (Annual accumulation starting from April)
		// We assume the inputs are already 12 months starting from April.
		accumulatedStorage += sentToGridWithBattery;

		const reclaimedFromStorage = Math.min(
			accumulatedStorage,
			takenFromGridWithBattery,
		);
		accumulatedStorage -= reclaimedFromStorage;

		const deficit = takenFromGridWithBattery - reclaimedFromStorage;

		return {
			month: input.month,
			takenFromGrid,
			coveredByBattery,
			sentToGridWithBattery,
			takenFromGridWithBattery,
			storedInGrid: accumulatedStorage,
			deficit,
			reclaimTotal: reclaimedFromStorage * ESO_PRICES.PLAN_1_RECLAIM_FEE,
			purchaseTotal: deficit * input.electricityPrice,
			grandTotal:
				reclaimedFromStorage * ESO_PRICES.PLAN_1_RECLAIM_FEE +
				deficit * input.electricityPrice,
		};
	});
}

export function evaluatePlans(
	inputs: MonthlyInput[],
	batterySize: number,
	capacityKW: number,
) {
	// We evaluate each plan both WITH and WITHOUT battery
	const resultsNoBattery = calculateResults(inputs, 0);
	const resultsWithBattery = calculateResults(inputs, batterySize);

	const calculatePlanTotals = (results: CalculationResult[]) => {
		// Total sent to grid in the scenario
		const totalSent = results.reduce(
			(acc, r) => acc + r.sentToGridWithBattery,
			0,
		);
		const totalTaken = results.reduce(
			(acc, r) => acc + r.takenFromGridWithBattery,
			0,
		);

		// Plan 1: Pay per kWh reclaimed
		const reclaimedkWh1 = Math.min(totalSent, totalTaken);
		const plan1PurchaseCost = results.reduce((acc, r) => {
			return acc + r.purchaseTotal;
		}, 0);

		const plan1: PlanComparison = {
			planName: "Plan I",
			planSubtitle: "Pay per kWh reclaimed",
			reclaimCost: reclaimedkWh1 * ESO_PRICES.PLAN_1_RECLAIM_FEE,
			purchaseCost: plan1PurchaseCost,
			capacityCost: 0,
			grandTotal:
				reclaimedkWh1 * ESO_PRICES.PLAN_1_RECLAIM_FEE + plan1PurchaseCost,
		};

		// Plan 2: Pay for capacity
		const plan2: PlanComparison = {
			planName: "Plan II",
			planSubtitle: "Pay for capacity",
			reclaimCost: 0,
			purchaseCost: plan1PurchaseCost,
			capacityCost: ESO_PRICES.PLAN_2_CAPACITY_FEE * capacityKW * 12,
			grandTotal:
				plan1PurchaseCost + ESO_PRICES.PLAN_2_CAPACITY_FEE * capacityKW * 12,
		};

		// Plan 3: Energy exchange
		// For Plan 3, we need to recalculate deficit because the reclaim ratio is different (0.63)
		let accumulatedStorage3 = 0;
		let purchaseCost3 = 0;
		for (let i = 0; i < inputs.length; i++) {
			const r = results[i];
			accumulatedStorage3 +=
				r.sentToGridWithBattery * ESO_PRICES.PLAN_3_ENERGY_SHARE;
			const reclaimedFromStorage3 = Math.min(
				accumulatedStorage3,
				r.takenFromGridWithBattery,
			);
			accumulatedStorage3 -= reclaimedFromStorage3;
			const deficit3 = r.takenFromGridWithBattery - reclaimedFromStorage3;
			purchaseCost3 += deficit3 * inputs[i].electricityPrice;
		}

		const plan3: PlanComparison = {
			planName: "Plan III",
			planSubtitle: "Energy exchange 37%",
			reclaimCost: 0,
			purchaseCost: purchaseCost3,
			capacityCost: 0,
			grandTotal: purchaseCost3,
		};

		return [plan1, plan2, plan3];
	};

	return {
		noBattery: calculatePlanTotals(resultsNoBattery),
		withBattery: calculatePlanTotals(resultsWithBattery),
		resultsWithBattery,
		resultsNoBattery,
	};
}

export function getBatteryRecommendation(
	inputs: MonthlyInput[],
	capacityKW: number,
	selectedSize: number,
	batteryCostPerKWh: number,
) {
	// Try different battery sizes to find optimal
	const sizes = Array.from(
		new Set([
			0,
			Math.max(0, selectedSize - 5),
			selectedSize,
			selectedSize + 5,
			selectedSize + 10,
		]),
	).sort((a, b) => a - b);

	return sizes.map((size) => {
		const evalResult = evaluatePlans(inputs, size, capacityKW);
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
