export interface MonthlyInput {
  month: string;
  sentToGrid: number; // Surplus electricity sent to grid from PV
  purchasedFromGrid: number; // Purchased at full price
  reclaimedFromGrid: number; // Reclaimed from grid storage
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
  BATTERY_RECUP_YEARS: 10,
};

export function calculateBatteryCoverage(
  batterySize: number,
  takenFromGrid: number,
  sentToGrid: number
) {
  // Rough presumption: used from battery during night, charged during day.
  // Capacity * 30 is the max charge/discharge per month (one full cycle per day).
  return Math.min(batterySize * 30, Math.min(takenFromGrid, sentToGrid));
}

export function calculateResults(
  inputs: MonthlyInput[],
  batterySize: number,
  electricityPrice: number
): CalculationResult[] {
  let accumulatedStorage = 0;

  return inputs.map((input) => {
    const takenFromGrid = input.purchasedFromGrid + input.reclaimedFromGrid;
    const coveredByBattery = calculateBatteryCoverage(
      batterySize,
      takenFromGrid,
      input.sentToGrid
    );

    const sentToGridWithBattery = Math.max(0, input.sentToGrid - coveredByBattery);
    const takenFromGridWithBattery = Math.max(0, takenFromGrid - coveredByBattery);

    // Grid storage logic (Annual accumulation starting from April)
    // We assume the inputs are already 12 months starting from April.
    accumulatedStorage += sentToGridWithBattery;
    
    const reclaimedFromStorage = Math.min(accumulatedStorage, takenFromGridWithBattery);
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
      purchaseTotal: deficit * electricityPrice,
      grandTotal: (reclaimedFromStorage * ESO_PRICES.PLAN_1_RECLAIM_FEE) + (deficit * electricityPrice),
    };
  });
}

export function evaluatePlans(
  inputs: MonthlyInput[],
  batterySize: number,
  electricityPrice: number,
  capacityKW: number
) {
  // We evaluate each plan both WITH and WITHOUT battery
  const resultsNoBattery = calculateResults(inputs, 0, electricityPrice);
  const resultsWithBattery = calculateResults(inputs, batterySize, electricityPrice);

  const calculatePlanTotals = (results: CalculationResult[], withBattery: boolean) => {
    // For Plan Comparison, we need to apply each plan's logic to the 'withBattery' or 'noBattery' scenario
    
    // Total sent to grid in the scenario
    const totalSent = results.reduce((acc, r) => acc + r.sentToGridWithBattery, 0);
    const totalTaken = results.reduce((acc, r) => acc + r.takenFromGridWithBattery, 0);

    // Plan 1: Pay per kWh reclaimed
    const reclaimedkWh1 = Math.min(totalSent, totalTaken);
    const purchasedkWh1 = Math.max(0, totalTaken - totalSent);
    const plan1: PlanComparison = {
      planName: "Plan I (Pay per kWh reclaimed)",
      reclaimCost: reclaimedkWh1 * ESO_PRICES.PLAN_1_RECLAIM_FEE,
      purchaseCost: purchasedkWh1 * electricityPrice,
      capacityCost: 0,
      grandTotal: (reclaimedkWh1 * ESO_PRICES.PLAN_1_RECLAIM_FEE) + (purchasedkWh1 * electricityPrice),
    };

    // Plan 2: Pay for capacity
    const plan2: PlanComparison = {
      planName: "Plan II (Pay for capacity)",
      reclaimCost: 0,
      purchaseCost: purchasedkWh1 * electricityPrice,
      capacityCost: ESO_PRICES.PLAN_2_CAPACITY_FEE * capacityKW * 12,
      grandTotal: (purchasedkWh1 * electricityPrice) + (ESO_PRICES.PLAN_2_CAPACITY_FEE * capacityKW * 12),
    };

    // Plan 3: Energy exchange
    const purchasedkWh3 = Math.max(0, totalTaken - (totalSent * ESO_PRICES.PLAN_3_ENERGY_SHARE));
    const plan3: PlanComparison = {
      planName: "Plan III (Energy exchange 37%)",
      reclaimCost: 0,
      purchaseCost: purchasedkWh3 * electricityPrice,
      capacityCost: 0,
      grandTotal: purchasedkWh3 * electricityPrice,
    };

    return [plan1, plan2, plan3];
  };

  return {
    noBattery: calculatePlanTotals(resultsNoBattery, false),
    withBattery: calculatePlanTotals(resultsWithBattery, true),
    resultsWithBattery,
    resultsNoBattery
  };
}

export function getBatteryRecommendation(
  inputs: MonthlyInput[],
  electricityPrice: number,
  capacityKW: number
) {
  // Try different battery sizes to find optimal
  const sizes = [0, 5, 10, 15, 20];
  const evaluations = sizes.map(size => {
    const evalResult = evaluatePlans(inputs, size, electricityPrice, capacityKW);
    const bestPlanWithBattery = Math.min(...evalResult.withBattery.map(p => p.grandTotal));
    const bestPlanNoBattery = Math.min(...evalResult.noBattery.map(p => p.grandTotal));
    const annualSaving = bestPlanNoBattery - bestPlanWithBattery;
    const batteryCost = size * ESO_PRICES.BATTERY_COST_PER_KWH;
    const yearsToRecup = annualSaving > 0 ? batteryCost / annualSaving : Infinity;
    
    return { size, annualSaving, batteryCost, yearsToRecup };
  });

  return evaluations;
}
