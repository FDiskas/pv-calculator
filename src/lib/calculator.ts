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

export const ESO_PRICES = {
	PLAN_1_RECLAIM_FEE: 0.0726,
	PLAN_2_CAPACITY_FEE: 5.0336, // per kW per month
	PLAN_3_ENERGY_SHARE: 0.65, // 63% remains for the user
	BATTERY_COST_PER_KWH: 400,
	BATTERY_RECUP_YEARS: 25,
};

export function evaluatePlans(
	inputs: MonthlyInput[],
	batterySize: number,
	capacityKW: number,
) {
	// We evaluate each plan both WITH and WITHOUT battery
	const resultsNoBattery = calculateResults(inputs, 0);
	const resultsWithBattery = calculateResults(inputs, batterySize);

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
			calculatePlanTotals(calculatePlanResults(inputs, 0, 1), 1, capacityKW),
			calculatePlanTotals(calculatePlanResults(inputs, 0, 1), 2, capacityKW),
			calculatePlanTotals(
				calculatePlanResults(inputs, 0, ESO_PRICES.PLAN_3_ENERGY_SHARE),
				3,
				capacityKW,
			),
		],
		withBattery: [
			calculatePlanTotals(
				calculatePlanResults(inputs, batterySize, 1),
				1,
				capacityKW,
			),
			calculatePlanTotals(
				calculatePlanResults(inputs, batterySize, 1),
				2,
				capacityKW,
			),
			calculatePlanTotals(
				calculatePlanResults(
					inputs,
					batterySize,
					ESO_PRICES.PLAN_3_ENERGY_SHARE,
				),
				3,
				capacityKW,
			),
		],
		resultsWithBattery,
		resultsNoBattery,
		totalTakenFromGrid,
		totalSentToGrid,
		totalCoveredByBattery,
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

export function calculateResults(
	inputs: MonthlyInput[],
	batterySize: number,
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
			reclaimTotal: reclaimedFromStorage * ESO_PRICES.PLAN_1_RECLAIM_FEE,
			purchaseTotal: deficit * input.electricityPrice,
			grandTotal:
				reclaimedFromStorage * ESO_PRICES.PLAN_1_RECLAIM_FEE +
				deficit * input.electricityPrice,
		};
	});
}

export function calculatePlanResults(
	inputs: MonthlyInput[],
	batterySize: number,
	energyShare: number,
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
			reclaimTotal: reclaimedFromStorage * ESO_PRICES.PLAN_1_RECLAIM_FEE,
			purchaseTotal: deficit * input.electricityPrice,
			grandTotal:
				reclaimedFromStorage * ESO_PRICES.PLAN_1_RECLAIM_FEE +
				deficit * input.electricityPrice,
		};
	});
}

export function calculatePlanTotals(
	results: CalculationResult[],
	planType: 1 | 2 | 3,
	capacityKW: number,
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
			reclaimCost: totalReclaimed * ESO_PRICES.PLAN_1_RECLAIM_FEE,
			purchaseCost: totalPurchaseCost,
			capacityCost: 0,
			grandTotal:
				totalReclaimed * ESO_PRICES.PLAN_1_RECLAIM_FEE + totalPurchaseCost,
			totalReclaimed: totalReclaimed,
			totalDeficit: results.reduce((acc, r) => acc + r.deficit, 0),
			totalStored: totalSent,
			reclaimPricePerKWh: ESO_PRICES.PLAN_1_RECLAIM_FEE,
		};
		return plan1;
	}

	if (planType === 2) {
		const plan2: PlanComparison = {
			planName: "Plan II",
			planSubtitle: "Pay for capacity",
			reclaimCost: 0,
			purchaseCost: totalPurchaseCost,
			capacityCost: ESO_PRICES.PLAN_2_CAPACITY_FEE * capacityKW * 12,
			grandTotal:
				totalPurchaseCost + ESO_PRICES.PLAN_2_CAPACITY_FEE * capacityKW * 12,
			totalReclaimed: totalReclaimed,
			totalDeficit: results.reduce((acc, r) => acc + r.deficit, 0),
			totalStored: totalSent,
			reclaimPricePerKWh: 0,
		};
		return plan2;
	}

	const plan3: PlanComparison = {
		planName: "Plan III",
		planSubtitle: "Energy exchange 37%",
		reclaimCost: 0,
		purchaseCost: totalPurchaseCost,
		capacityCost: 0,
		grandTotal: totalPurchaseCost,
		totalReclaimed: totalReclaimed,
		totalDeficit: results.reduce((acc, r) => acc + r.deficit, 0),
		totalStored: totalSent * ESO_PRICES.PLAN_3_ENERGY_SHARE,
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
