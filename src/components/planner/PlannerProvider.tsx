import { createContext, useContext, useMemo } from "react";
import { useCountUp } from "../../hooks/useCountUp";
import { useEsoImport } from "../../hooks/useEsoImport";
import { useEsoTariffs } from "../../hooks/useEsoTariffs";
import { useNordPoolPrices } from "../../hooks/useNordPoolPrices";
import { usePersistedInputs } from "../../hooks/usePersistedInputs";
import {
	evaluatePlans,
	getBatteryRecommendation,
	pickRecommendedSize,
} from "../../lib/calculator";
import { MONTHS } from "../../lib/months";

/**
 * Owns all planner state and the values derived from it, exposing them through
 * context so the setup and results views can stay focused on presentation.
 */
function usePlannerState() {
	const inputs = usePersistedInputs();
	const { tariffs, tariffSource } = useEsoTariffs();
	const prices = useNordPoolPrices();
	const eso = useEsoImport(inputs.setMonthlyInputs);

	const {
		batterySize,
		vat,
		operatorCost,
		capacityKW,
		batteryCostPerKWh,
		batteryRecupYears,
		monthlyInputs,
		setMonthlyInputs,
		setBatterySize,
		setShowResults,
	} = inputs;
	const { nordPoolBase } = prices;

	// Electricity price per month, derived live from NordPool base + VAT + operator.
	const priceByMonth = useMemo(() => {
		const out: Record<string, number> = {};
		for (const month of MONTHS) {
			const base = nordPoolBase[month];
			if (base != null) {
				out[month] = Number((base * (1 + vat / 100) + operatorCost).toFixed(4));
			}
		}
		return out;
	}, [nordPoolBase, vat, operatorCost]);

	const effectiveInputs = useMemo(
		() =>
			monthlyInputs.map((input) => ({
				...input,
				electricityPrice: priceByMonth[input.month] ?? input.electricityPrice,
			})),
		[monthlyInputs, priceByMonth],
	);

	const results = useMemo(
		() => evaluatePlans(effectiveInputs, batterySize, capacityKW, tariffs),
		[effectiveInputs, batterySize, capacityKW, tariffs],
	);

	const batteryRecs = useMemo(
		() =>
			getBatteryRecommendation(
				effectiveInputs,
				capacityKW,
				batteryCostPerKWh,
				tariffs,
			),
		[effectiveInputs, capacityKW, batteryCostPerKWh, tariffs],
	);

	const recommended = useMemo(
		() => pickRecommendedSize(batteryRecs, batteryRecupYears),
		[batteryRecs, batteryRecupYears],
	);

	const bestPlan = useMemo(
		() =>
			[...results.withBattery].sort((a, b) => a.grandTotal - b.grandTotal)[0],
		[results],
	);

	const cheapestNoBattery = useMemo(
		() => Math.min(...results.noBattery.map((p) => p.grandTotal)),
		[results],
	);

	const totals = useMemo(
		() => ({
			sent: monthlyInputs.reduce((a, m) => a + m.sentToGrid, 0),
			taken: monthlyInputs.reduce((a, m) => a + m.takenFromGrid, 0),
		}),
		[monthlyInputs],
	);

	const savingsWithBattery = Math.max(
		0,
		cheapestNoBattery - bestPlan.grandTotal,
	);
	const totalBatteryCost = batterySize * batteryCostPerKWh;
	const paybackYears =
		batterySize > 0 && savingsWithBattery > 0
			? totalBatteryCost / savingsWithBattery
			: Infinity;
	const hasBattery = batterySize > 0;
	const isGoodInvestment =
		hasBattery &&
		Number.isFinite(paybackYears) &&
		paybackYears <= batteryRecupYears;
	const paybackFill = Number.isFinite(paybackYears)
		? Math.min(100, (paybackYears / batteryRecupYears) * 100)
		: 100;

	const animatedSavings = useCountUp(savingsWithBattery);
	const animatedPayback = useCountUp(
		Number.isFinite(paybackYears) ? paybackYears : 0,
	);
	const animatedCovered = useCountUp(results.totalCoveredByBattery);
	const animatedRecSize = useCountUp(recommended ? recommended.size : 0);

	const hasData =
		capacityKW > 0 &&
		monthlyInputs.some((m) => m.sentToGrid > 0 || m.takenFromGrid > 0);

	const updateMonthlyInput = (
		index: number,
		field: "sentToGrid" | "takenFromGrid",
		value: string,
	) => {
		const numValue = parseFloat(value) || 0;
		setMonthlyInputs((prev) => {
			const next = [...prev];
			next[index] = { ...next[index], [field]: numValue };
			return next;
		});
	};

	const handleAnalyze = () => {
		if (!hasData) return;
		if (recommended) setBatterySize(recommended.size);
		setShowResults(true);
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const goToSetup = () => {
		setShowResults(false);
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	return {
		...inputs,
		...prices,
		...eso,
		tariffs,
		tariffSource,
		priceByMonth,
		results,
		batteryRecs,
		recommended,
		bestPlan,
		totals,
		savingsWithBattery,
		totalBatteryCost,
		paybackYears,
		hasBattery,
		isGoodInvestment,
		paybackFill,
		animatedSavings,
		animatedPayback,
		animatedCovered,
		animatedRecSize,
		hasData,
		updateMonthlyInput,
		handleAnalyze,
		goToSetup,
	};
}

type PlannerContextValue = ReturnType<typeof usePlannerState>;

const PlannerContext = createContext<PlannerContextValue | null>(null);

export function PlannerProvider({ children }: { children: React.ReactNode }) {
	const value = usePlannerState();
	return (
		<PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
	);
}

export function usePlanner(): PlannerContextValue {
	const ctx = useContext(PlannerContext);
	if (!ctx) {
		throw new Error("usePlanner must be used within a PlannerProvider");
	}
	return ctx;
}
