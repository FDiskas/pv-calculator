/** biome-ignore-all lint/a11y/noLabelWithoutControl: Just cause */
/** biome-ignore-all lint/style/noNonNullAssertion: Just cause */
/** biome-ignore-all lint/suspicious/noNonNullAssertedOptionalChain: Just cause */
import {createFileRoute} from "@tanstack/react-router";
import {AlertCircle, BarChart3, Battery, Calculator, Euro, Info, TrendingUp, Zap,} from "lucide-react";
import {useEffect, useMemo, useState} from "react";
import {ESO_PRICES, evaluatePlans, getBatteryRecommendation, type MonthlyInput,} from "../lib/calculator";
import {cn} from "../lib/utils";

export const Route = createFileRoute("/")({ component: App });

const MONTHS = [
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
	"January",
	"February",
	"March",
];

const STORAGE_KEY = "electricity_planner_data";

const DEFAULT_MONTHLY_INPUTS: MonthlyInput[] = MONTHS.map((month) => ({
	month,
	sentToGrid: 500,
	purchasedFromGrid: 100,
	reclaimedFromGrid: 500,
}));

function App() {
	const [isLoaded, setIsLoaded] = useState(false);
	const [batterySize, setBatterySize] = useState<number>(5);
	const [electricityPrice, setElectricityPrice] = useState<number>(0.25);
	const [capacityKW, setCapacityKW] = useState<number>(10);

	const [monthlyInputs, setMonthlyInputs] = useState<MonthlyInput[]>(
		DEFAULT_MONTHLY_INPUTS,
	);

	// Load from local storage
	useEffect(() => {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				if (typeof parsed.batterySize === "number")
					setBatterySize(parsed.batterySize);
				if (typeof parsed.electricityPrice === "number")
					setElectricityPrice(parsed.electricityPrice);
				if (typeof parsed.capacityKW === "number")
					setCapacityKW(parsed.capacityKW);
				if (Array.isArray(parsed.monthlyInputs))
					setMonthlyInputs(parsed.monthlyInputs);
			} catch (e) {
				console.error("Failed to parse saved data", e);
			}
		}
		setIsLoaded(true);
	}, []);

	// Save to local storage
	useEffect(() => {
		if (isLoaded) {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					batterySize,
					electricityPrice,
					capacityKW,
					monthlyInputs,
				}),
			);
		}
	}, [batterySize, electricityPrice, capacityKW, monthlyInputs, isLoaded]);

	const results = useMemo(() => {
		return evaluatePlans(
			monthlyInputs,
			batterySize,
			electricityPrice,
			capacityKW,
		);
	}, [monthlyInputs, batterySize, electricityPrice, capacityKW]);

	const batteryRecs = useMemo(() => {
		return getBatteryRecommendation(
			monthlyInputs,
			electricityPrice,
			capacityKW,
			batterySize,
		);
	}, [monthlyInputs, electricityPrice, capacityKW, batterySize]);

	const updateMonthlyInput = (
		index: number,
		field: keyof MonthlyInput,
		value: string,
	) => {
		const numValue = parseFloat(value) || 0;
		const newInputs = [...monthlyInputs];
		newInputs[index] = { ...newInputs[index], [field]: numValue };
		setMonthlyInputs(newInputs);
	};

	const bestPlan = useMemo(() => {
		const plans = results.withBattery;
		return [...plans].sort((a, b) => a.grandTotal - b.grandTotal)[0];
	}, [results]);

	const cheapestNoBattery = useMemo(() => {
		return Math.min(...results.noBattery.map((p) => p.grandTotal));
	}, [results]);

	const savingsWithBattery = cheapestNoBattery - bestPlan.grandTotal;

	return (
		<div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
			{/* Hero Header */}
			<header className="bg-white border-b border-slate-200 sticky top-0 z-30">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<div className="bg-amber-500 p-2 rounded-lg">
							<Zap className="w-5 h-5 text-white" />
						</div>
						<h1 className="text-xl font-bold tracking-tight text-slate-800">
							PV Planner
						</h1>
					</div>
					<div className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-500">
						<span className="text-amber-600">Calculator</span>
						<span>Insights</span>
						<span>
							<a
								href="https://www.eso.lt/namams/elektra/tarifu-planai-kainos-atsiskaitymas/gaminanciu-vartotoju-atsiskaitymo-budai-2026-metais/4829"
								target="_blank"
								rel="noreferrer"
							>
								ESO 2026 Guide
							</a>
						</span>
					</div>
				</div>
			</header>

			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
					{/* Sidebar Inputs */}
					<div className="lg:col-span-4 space-y-6">
						<section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
							<div className="flex items-center gap-2 mb-6">
								<Calculator className="w-5 h-5 text-amber-500" />
								<h2 className="font-semibold text-lg">General Settings</h2>
							</div>

							<div className="space-y-4">
								<div>
									<label className="block text-sm font-medium text-slate-600 mb-1">
										Battery Size (kWh)
									</label>
									<div className="relative">
										<Battery className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
										<input
											type="number"
											value={batterySize}
											onChange={(e) =>
												setBatterySize(parseFloat(e.target.value) || 0)
											}
											className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
										/>
									</div>
								</div>

								<div>
									<label className="block text-sm font-medium text-slate-600 mb-1">
										Electricity Price (€/kWh)
									</label>
									<div className="relative">
										<Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
										<input
											type="number"
											step="0.01"
											value={electricityPrice}
											onChange={(e) =>
												setElectricityPrice(parseFloat(e.target.value) || 0)
											}
											className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
										/>
									</div>
								</div>

								<div>
									<label className="block text-sm font-medium text-slate-600 mb-1">
										Plant Capacity (kW)
									</label>
									<div className="relative">
										<Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
										<input
											type="number"
											value={capacityKW}
											onChange={(e) =>
												setCapacityKW(parseFloat(e.target.value) || 0)
											}
											className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
										/>
									</div>
								</div>
							</div>
						</section>

						<section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
							<div className="flex items-center gap-2 mb-4">
								<TrendingUp className="w-5 h-5 text-emerald-500" />
								<h2 className="font-semibold text-lg">Quick Summary</h2>
							</div>

							<div className="space-y-4">
								<div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
									<p className="text-xs font-medium text-emerald-700 uppercase tracking-wider mb-1">
										Best Plan
									</p>
									<p className="text-lg font-bold text-emerald-900">
										{bestPlan.planName} ({bestPlan.planSubtitle})
									</p>
									<p className="text-2xl font-black text-emerald-600 mt-1">
										{bestPlan.grandTotal.toFixed(2)}€{" "}
										<span className="text-sm font-normal text-slate-400">
											/ year
										</span>
									</p>
								</div>

								<div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
									<p className="text-xs font-medium text-blue-700 uppercase tracking-wider mb-1">
										Battery Savings
									</p>
									<p className="text-2xl font-black text-blue-600">
										{savingsWithBattery.toFixed(2)}€{" "}
										<span className="text-sm font-normal text-slate-400">
											/ year
										</span>
									</p>
									<p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
										<Info className="w-3 h-3" />
										Compared to no battery scenario
									</p>
								</div>
							</div>
						</section>
					</div>

					{/* Main Content */}
					<div className="lg:col-span-8 space-y-8">
						{/* Plan Comparison Cards */}
						<section className="space-y-4">
							<div className="flex items-center justify-between">
								<h2 className="font-bold text-slate-800 text-lg">
									Plan Comparison (2026 ESO Tariffs)
								</h2>
								{batterySize > 0 && (
									<div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
										<div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
										With Battery Analysis
									</div>
								)}
							</div>

							<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
								{results.withBattery.map((plan) => {
									const isBest = plan.planName === bestPlan.planName;
									return (
										<div
											key={plan.planName}
											className={cn(
												"relative flex flex-col p-6 rounded-2xl transition-all duration-300 border bg-white",
												isBest
													? "border-amber-400 shadow-xl shadow-amber-500/10 ring-1 ring-amber-400"
													: "border-slate-200 hover:border-slate-300 hover:shadow-md",
											)}
										>
											{isBest && (
												<div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
													Recommended
												</div>
											)}

											<div className="mb-6">
												<h3 className="font-bold text-slate-800 leading-tight">
													{plan.planName}
												</h3>
												<h3 className="text-xs font text-slate-400 leading-tight mb-1">
													{plan.planSubtitle}
												</h3>
												<div className="flex items-baseline gap-1">
													<span className="text-3xl font-black text-slate-900">
														{plan.grandTotal.toFixed(2)}€
													</span>
													<span className="text-sm font-medium text-slate-400">
														/ yr
													</span>
												</div>
											</div>

											<div className="space-y-3 grow">
												<div className="flex justify-between items-center py-2 border-b border-slate-50">
													<span className="text-xs font-medium text-slate-500">
														Reclaim Fee
													</span>
													<span className="text-sm font-semibold text-slate-700">
														{plan.reclaimCost.toFixed(2)}€
													</span>
												</div>
												<div className="flex justify-between items-center py-2 border-b border-slate-50">
													<span className="text-xs font-medium text-slate-500">
														Capacity Fee
													</span>
													<span className="text-sm font-semibold text-slate-700">
														{plan.capacityCost.toFixed(2)}€
													</span>
												</div>
												<div className="flex justify-between items-center py-2">
													<span className="text-xs font-medium text-slate-500">
														Purchase Total
													</span>
													<span className="text-sm font-semibold text-slate-700">
														{plan.purchaseCost.toFixed(2)}€
													</span>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</section>

						{/* Monthly Data Input */}
						<section className="bg-white rounded-2xl shadow-sm border border-slate-200">
							<div className="px-6 py-4 border-b border-slate-100">
								<h2 className="font-bold text-slate-800">
									Monthly Generation & Consumption
								</h2>
							</div>
							<div className="p-6">
								<div className="overflow-x-auto">
									<table className="w-full text-sm">
										<thead>
											<tr className="text-slate-400 font-medium border-b border-slate-100">
												<th className="pb-4 text-left font-medium">Month</th>
												<th className="pb-4 text-left font-medium">
													Sent to Grid (kWh)
												</th>
												<th className="pb-4 text-left font-medium">
													Purchased (kWh)
												</th>
												<th className="pb-4 text-left font-medium">
													Reclaimed (kWh)
												</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-slate-50">
											{monthlyInputs.map((input, idx) => (
												<tr key={input.month}>
													<td className="py-3 font-medium text-slate-600">
														{input.month}
													</td>
													<td className="py-3">
														<input
															type="number"
															value={input.sentToGrid}
															onChange={(e) =>
																updateMonthlyInput(
																	idx,
																	"sentToGrid",
																	e.target.value,
																)
															}
															className="w-24 px-2 py-1 bg-slate-50 border border-slate-100 rounded-md focus:ring-2 focus:ring-amber-500 outline-none"
														/>
													</td>
													<td className="py-3">
														<input
															type="number"
															value={input.purchasedFromGrid}
															onChange={(e) =>
																updateMonthlyInput(
																	idx,
																	"purchasedFromGrid",
																	e.target.value,
																)
															}
															className="w-24 px-2 py-1 bg-slate-50 border border-slate-100 rounded-md focus:ring-2 focus:ring-amber-500 outline-none"
														/>
													</td>
													<td className="py-3">
														<input
															type="number"
															value={input.reclaimedFromGrid}
															onChange={(e) =>
																updateMonthlyInput(
																	idx,
																	"reclaimedFromGrid",
																	e.target.value,
																)
															}
															className="w-24 px-2 py-1 bg-slate-50 border border-slate-100 rounded-md focus:ring-2 focus:ring-amber-500 outline-none"
														/>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						</section>

						{/* Battery Sizing Guide */}
						<section className="bg-slate-900 rounded-3xl p-8 text-white">
							<div className="flex items-center gap-3 mb-8">
								<BarChart3 className="w-6 h-6 text-amber-400" />
								<h2 className="text-2xl font-bold">
									Battery Investment Analysis
								</h2>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
								{batteryRecs.map((rec) => (
									<div
										key={rec.size}
										className={cn(
											"p-5 rounded-2xl border transition-all",
											rec.size === batterySize
												? "bg-amber-500 border-amber-400 scale-105 shadow-xl shadow-amber-500/20"
												: "bg-white/5 border-white/10",
										)}
									>
										<p className="text-sm font-medium opacity-70 mb-1">
											{rec.size} kWh
										</p>
										<p className="text-xl font-black mb-1">
											{rec.annualSaving.toFixed(0)}€
											<span className="text-xs opacity-60 font-normal">
												/yr
											</span>
										</p>
										<p className="text-[10px] text-white/40 mb-4">
											Total Cost: {rec.batteryCost.toFixed(0)}€
										</p>

										<div className="space-y-1">
											<p className="text-[10px] uppercase tracking-wider opacity-50">
												Recup Period
											</p>
											<p className="text-sm font-bold">
												{rec.yearsToRecup === Infinity || rec.size === 0
													? "No recoup"
													: `${rec.yearsToRecup.toFixed(1)} years`}
											</p>
										</div>

										{rec.yearsToRecup <= ESO_PRICES.BATTERY_RECUP_YEARS &&
											rec.size > 0 && (
												<div className="mt-4 pt-4 border-t border-white/10">
													<span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold">
														RECOMENDED
													</span>
												</div>
											)}
									</div>
								))}
							</div>

							<div className="mt-8 flex items-start gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
								<AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
								<p className="text-sm text-white/70 leading-relaxed">
									Battery size recommendation is based on a{" "}
									{ESO_PRICES.BATTERY_RECUP_YEARS}-year recuperation target at{" "}
									{ESO_PRICES.BATTERY_COST_PER_KWH}€/kWh. Currently, your{" "}
									<strong>{batterySize}kWh</strong> battery{" "}
									{batterySize > 0 &&
									batteryRecs.find((r) => r.size === batterySize)
										?.yearsToRecup! <= ESO_PRICES.BATTERY_RECUP_YEARS
										? "is a solid investment"
										: "might be too large for your current consumption profile"}
									.
								</p>
							</div>
						</section>
					</div>
				</div>
			</main>

			{/* Footer */}
			<footer className="mt-12 text-center text-slate-400 text-sm">
				<p>© 2026 PV Planner Tool • Based on VERT 2026 Regulations</p>
			</footer>
		</div>
	);
}
