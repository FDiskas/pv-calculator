import { useEffect, useState } from "react";
import { ESO_PRICES, type MonthlyInput } from "../lib/calculator";
import { DEFAULT_MONTHLY_INPUTS } from "../lib/months";

const STORAGE_KEY = "electricity_planner_data";

export interface PersistedInputs {
	batterySize: number;
	setBatterySize: (value: number) => void;
	vat: number;
	setVat: (value: number) => void;
	operatorCost: number;
	setOperatorCost: (value: number) => void;
	capacityKW: number;
	setCapacityKW: (value: number) => void;
	batteryCostPerKWh: number;
	setBatteryCostPerKWh: (value: number) => void;
	batteryRecupYears: number;
	setBatteryRecupYears: (value: number) => void;
	showResults: boolean;
	setShowResults: (value: boolean) => void;
	monthlyInputs: MonthlyInput[];
	setMonthlyInputs: React.Dispatch<React.SetStateAction<MonthlyInput[]>>;
	isLoaded: boolean;
}

/**
 * Holds every planner input that survives reloads, hydrating from localStorage
 * on mount and persisting back whenever any field changes.
 */
export function usePersistedInputs(): PersistedInputs {
	const [batterySize, setBatterySize] = useState(10);
	const [vat, setVat] = useState(21);
	const [operatorCost, setOperatorCost] = useState(0.136);
	const [capacityKW, setCapacityKW] = useState(10);
	const [batteryCostPerKWh, setBatteryCostPerKWh] = useState(
		ESO_PRICES.BATTERY_COST_PER_KWH,
	);
	const [batteryRecupYears, setBatteryRecupYears] = useState(10);
	const [showResults, setShowResults] = useState(false);
	const [monthlyInputs, setMonthlyInputs] = useState<MonthlyInput[]>(
		DEFAULT_MONTHLY_INPUTS,
	);
	const [isLoaded, setIsLoaded] = useState(false);

	useEffect(() => {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				if (typeof parsed.batterySize === "number")
					setBatterySize(parsed.batterySize);
				if (typeof parsed.operatorCost === "number")
					setOperatorCost(parsed.operatorCost);
				if (typeof parsed.vat === "number") setVat(parsed.vat);
				if (typeof parsed.capacityKW === "number")
					setCapacityKW(parsed.capacityKW);
				if (typeof parsed.batteryCostPerKWh === "number")
					setBatteryCostPerKWh(parsed.batteryCostPerKWh);
				if (typeof parsed.batteryRecupYears === "number")
					setBatteryRecupYears(parsed.batteryRecupYears);
				if (typeof parsed.showResults === "boolean")
					setShowResults(parsed.showResults);
				if (Array.isArray(parsed.monthlyInputs))
					setMonthlyInputs(parsed.monthlyInputs);
			} catch (e) {
				console.error("Failed to parse saved data", e);
			}
		}
		setIsLoaded(true);
	}, []);

	useEffect(() => {
		if (!isLoaded) return;
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				batterySize,
				operatorCost,
				vat,
				capacityKW,
				batteryCostPerKWh,
				batteryRecupYears,
				showResults,
				monthlyInputs,
			}),
		);
	}, [
		batterySize,
		operatorCost,
		vat,
		capacityKW,
		batteryCostPerKWh,
		batteryRecupYears,
		showResults,
		monthlyInputs,
		isLoaded,
	]);

	return {
		batterySize,
		setBatterySize,
		vat,
		setVat,
		operatorCost,
		setOperatorCost,
		capacityKW,
		setCapacityKW,
		batteryCostPerKWh,
		setBatteryCostPerKWh,
		batteryRecupYears,
		setBatteryRecupYears,
		showResults,
		setShowResults,
		monthlyInputs,
		setMonthlyInputs,
		isLoaded,
	};
}
