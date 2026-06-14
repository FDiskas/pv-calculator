/** biome-ignore-all lint/a11y/noLabelWithoutControl: form labels are paired visually */
import { createFileRoute } from "@tanstack/react-router";
import {
	Activity,
	AlertCircle,
	ArrowRight,
	BatteryCharging,
	CheckCircle2,
	Clock,
	Euro,
	ExternalLink,
	Gauge,
	Info,
	Layers,
	Percent,
	PiggyBank,
	Sparkles,
	TrendingUp,
	Upload,
	Wallet,
	Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ElectricBackground from "../components/ElectricBackground";
import Reveal from "../components/Reveal";
import { useCountUp } from "../hooks/useCountUp";
import { fetchNordPoolPrices } from "../lib/api";
import {
	ESO_PRICES,
	evaluatePlans,
	getBatteryRecommendation,
	type MonthlyInput,
} from "../lib/calculator";
import { importEsoZip, mergeEsoIntoInputs } from "../lib/eso-csv";
import { cn } from "../lib/utils";

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
	takenFromGrid: 100,
	electricityPrice: 0.25,
}));

const euro = (value: number) =>
	`${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}€`;

function App() {
	const [isLoaded, setIsLoaded] = useState(false);
	const [isLoadingPrices, setIsLoadingPrices] = useState(false);
	const [isImportingEso, setIsImportingEso] = useState(false);
	const [esoImportError, setEsoImportError] = useState<string | null>(null);
	const [esoImported, setEsoImported] = useState(false);
	const esoFileInputRef = useRef<HTMLInputElement>(null);
	const [batterySize, setBatterySize] = useState<number>(5);
	const [vat, setVat] = useState<number>(21);
	const [operatorCost, setOperatorCost] = useState<number>(0.136);
	const [capacityKW, setCapacityKW] = useState<number>(10);
	const [nordPoolYear, setNordPoolYear] = useState<string>("2025");
	const [batteryCostPerKWh, setBatteryCostPerKWh] = useState<number>(
		ESO_PRICES.BATTERY_COST_PER_KWH,
	);
	const [batteryRecupYears, setBatteryRecupYears] = useState<number>(
		ESO_PRICES.BATTERY_RECUP_YEARS,
	);

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
				if (typeof parsed.operatorCost === "number")
					setOperatorCost(parsed.operatorCost);
				if (typeof parsed.vat === "number") setVat(parsed.vat);
				if (typeof parsed.capacityKW === "number")
					setCapacityKW(parsed.capacityKW);
				if (typeof parsed.batteryCostPerKWh === "number")
					setBatteryCostPerKWh(parsed.batteryCostPerKWh);
				if (typeof parsed.batteryRecupYears === "number")
					setBatteryRecupYears(parsed.batteryRecupYears);
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
					operatorCost,
					vat,
					capacityKW,
					batteryCostPerKWh,
					batteryRecupYears,
					monthlyInputs,
				}),
			);
		}
	}, [
		batterySize,
		operatorCost,
		vat,
		capacityKW,
		monthlyInputs,
		isLoaded,
		batteryCostPerKWh,
		batteryRecupYears,
	]);

	const results = useMemo(() => {
		return evaluatePlans(monthlyInputs, batterySize, capacityKW);
	}, [monthlyInputs, batterySize, capacityKW]);

	const batteryRecs = useMemo(() => {
		return getBatteryRecommendation(
			monthlyInputs,
			capacityKW,
			batterySize,
			batteryCostPerKWh,
		);
	}, [monthlyInputs, capacityKW, batterySize, batteryCostPerKWh]);

	const bestPlan = useMemo(() => {
		const plans = results.withBattery;
		return [...plans].sort((a, b) => a.grandTotal - b.grandTotal)[0];
	}, [results]);

	const cheapestNoBattery = useMemo(() => {
		return Math.min(...results.noBattery.map((p) => p.grandTotal));
	}, [results]);

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

	const handleEsoImport = async (file: File) => {
		setIsImportingEso(true);
		setEsoImportError(null);
		try {
			const rows = await importEsoZip(file);
			setMonthlyInputs((prev) => mergeEsoIntoInputs(prev, rows));
			setEsoImported(true);
		} catch (err) {
			setEsoImportError(err instanceof Error ? err.message : "Import failed");
			console.error("ESO import failed", err);
		} finally {
			setIsImportingEso(false);
			if (esoFileInputRef.current) esoFileInputRef.current.value = "";
		}
	};

	const handleNordPoolPrefill = async () => {
		setIsLoadingPrices(true);
		try {
			const json = await fetchNordPoolPrices({ data: { year: nordPoolYear } });
			if (json.success && json.data.lt) {
				const ltData: { timestamp: number; price: number }[] = json.data.lt;
				const monthlyAverages: Record<string, { sum: number; count: number }> =
					{};
				for (const entry of ltData) {
					const date = new Date(entry.timestamp * 1000);
					const monthName = date.toLocaleString("en-US", { month: "long" });
					if (!monthlyAverages[monthName]) {
						monthlyAverages[monthName] = { sum: 0, count: 0 };
					}
					monthlyAverages[monthName].sum += entry.price;
					monthlyAverages[monthName].count += 1;
				}

				setMonthlyInputs((prev) =>
					prev.map((input) => {
						const avg = monthlyAverages[input.month];
						if (avg) {
							const nordPoolKWh = avg.sum / avg.count / 1000;
							return {
								...input,
								electricityPrice: Number(
									(nordPoolKWh * (1 + vat / 100) + operatorCost).toFixed(2),
								),
							};
						}
						return input;
					}),
				);
			}
		} catch (e) {
			console.error("Failed to fetch NordPool prices", e);
		} finally {
			setIsLoadingPrices(false);
		}
	};

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

	// Animated headline figures
	const animatedSavings = useCountUp(savingsWithBattery);
	const animatedPayback = useCountUp(
		Number.isFinite(paybackYears) ? paybackYears : 0,
	);
	const animatedBest = useCountUp(bestPlan.grandTotal);
	const animatedCovered = useCountUp(results.totalCoveredByBattery);

	return (
		<div className="relative min-h-screen overflow-x-hidden font-sans text-[var(--ink)]">
			<ElectricBackground />

			{/* Hidden ESO file input — shared by every "Import ESO ZIP" trigger */}
			<input
				ref={esoFileInputRef}
				type="file"
				accept=".zip,.csv"
				className="hidden"
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) handleEsoImport(file);
				}}
			/>

			{/* ---------------- Sticky nav ---------------- */}
			<header className="sticky top-0 z-40 glass border-b border-[var(--line)]">
				<div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
					<a href="#top" className="flex items-center gap-2.5">
						<span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[var(--elec-cyan)] to-[var(--elec-blue)] glow-cyan">
							<Zap className="h-5 w-5 text-[#04101f]" fill="currentColor" />
						</span>
						<span className="text-[15px] font-bold tracking-tight">
							Volt<span className="text-[var(--elec-cyan)]">Invest</span>
						</span>
					</a>

					<nav className="hidden items-center gap-7 text-sm font-medium text-[var(--ink-soft)] md:flex">
						<a className="transition hover:text-[var(--ink)]" href="#analysis">
							Analysis
						</a>
						<a className="transition hover:text-[var(--ink)]" href="#plans">
							Tariff plans
						</a>
						<a className="transition hover:text-[var(--ink)]" href="#data">
							Your data
						</a>
					</nav>

					<button
						type="button"
						disabled={isImportingEso}
						onClick={() => esoFileInputRef.current?.click()}
						className={cn(
							"flex items-center gap-1.5 rounded-full border border-[var(--line-strong)] bg-[rgba(8,14,27,0.6)] px-3.5 py-1.5 text-xs font-semibold transition hover:border-[var(--elec-cyan)] hover:text-[var(--elec-cyan)]",
							isImportingEso && "cursor-not-allowed opacity-60",
						)}
						title="Upload the ZIP export from ESO self-service"
					>
						<Upload className="h-3.5 w-3.5" />
						<span className="hidden sm:inline">Import ESO ZIP</span>
						<span className="sm:hidden">ESO</span>
					</button>
				</div>
			</header>

			<main id="top" className="relative z-10">
				{/* ---------------- Hero ---------------- */}
				<section className="mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6 lg:px-8 lg:pt-24">
					<Reveal className="mx-auto max-w-3xl text-center">
						<span className="inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] bg-[rgba(8,14,27,0.5)] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--elec-cyan)]">
							<Sparkles className="h-3.5 w-3.5" />
							ESO 2026 Tariffs · Lithuania
						</span>
						<h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
							<span className="text-gradient-elec">Battery Investment</span>
							<br />
							Analysis
						</h1>
						<p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[var(--ink-soft)] sm:text-lg">
							See exactly how fast a home battery pays for itself against the
							2026 ESO tariffs. Bring your real consumption, size the battery,
							and watch the numbers light up.
						</p>
					</Reveal>

					{/* Primary CTAs — the relocated "Import ESO ZIP" lives here as the
					    natural first step of the journey. */}
					<Reveal
						delay={120}
						className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
					>
						<button
							type="button"
							disabled={isImportingEso}
							onClick={() => esoFileInputRef.current?.click()}
							className={cn(
								"group flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[var(--elec-cyan)] to-[var(--elec-blue)] px-7 py-3.5 text-base font-bold text-[#04101f] transition glow-cyan hover:scale-[1.02] sm:w-auto",
								isImportingEso && "cursor-not-allowed opacity-70",
							)}
						>
							{isImportingEso ? (
								<>
									<span className="h-4 w-4 animate-spin rounded-full border-2 border-[#04101f]/40 border-t-[#04101f]" />
									Importing your data…
								</>
							) : (
								<>
									<Upload className="h-5 w-5" />
									Import ESO ZIP
									<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
								</>
							)}
						</button>
						<a
							href="#analysis"
							className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--line-strong)] bg-[rgba(8,14,27,0.5)] px-7 py-3.5 text-base font-semibold text-[var(--ink)] transition hover:border-[var(--elec-cyan)] sm:w-auto"
						>
							Size a battery manually
						</a>
					</Reveal>
					{esoImported && !esoImportError && (
						<p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-[var(--elec-green)]">
							<CheckCircle2 className="h-3.5 w-3.5" />
							ESO data imported — your monthly table is filled in below.
						</p>
					)}
					{esoImportError && (
						<p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-[var(--elec-red)]">
							<AlertCircle className="h-3.5 w-3.5" />
							{esoImportError}
						</p>
					)}

					{/* Floating headline stats */}
					<Reveal
						delay={240}
						className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3"
					>
						<StatChip
							icon={<PiggyBank className="h-5 w-5" />}
							accent="green"
							label="Annual savings with battery"
							value={`${euro(animatedSavings)}/yr`}
						/>
						<StatChip
							icon={<Clock className="h-5 w-5" />}
							accent="amber"
							label="Battery payback period"
							value={
								Number.isFinite(paybackYears)
									? `${animatedPayback.toFixed(1)} yrs`
									: "—"
							}
						/>
						<StatChip
							icon={<TrendingUp className="h-5 w-5" />}
							accent="cyan"
							label={`Cheapest plan · ${bestPlan.planName}`}
							value={`${euro(animatedBest)}/yr`}
						/>
					</Reveal>
				</section>

				{/* ---------------- Investment cockpit (primary purpose) ---------------- */}
				<section
					id="analysis"
					className="mx-auto max-w-7xl scroll-mt-20 px-4 py-12 sm:px-6 lg:px-8"
				>
					<Reveal>
						<SectionHeading
							icon={<BatteryCharging className="h-5 w-5" />}
							eyebrow="The verdict"
							title="Is the battery worth it?"
						/>
					</Reveal>

					<div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
						{/* Configurator */}
						<Reveal className="lg:col-span-2" delay={80}>
							<div className="glass h-full rounded-3xl p-6 sm:p-7">
								<div className="mb-7">
									<div className="flex items-baseline justify-between">
										<label className="text-sm font-semibold text-[var(--ink-soft)]">
											Battery size
										</label>
										<span className="text-3xl font-black text-[var(--elec-cyan)]">
											{batterySize}
											<span className="ml-1 text-sm font-medium text-[var(--ink-faint)]">
												kWh
											</span>
										</span>
									</div>
									<input
										type="range"
										min="0"
										max="40"
										step="1"
										value={batterySize}
										onChange={(e) => setBatterySize(parseFloat(e.target.value))}
										className="range-elec mt-4"
										style={
											{
												"--fill": `${(batterySize / 40) * 100}%`,
											} as React.CSSProperties
										}
									/>
									<div className="mt-2 flex justify-between text-[10px] text-[var(--ink-faint)]">
										<span>0</span>
										<span>20 kWh</span>
										<span>40 kWh</span>
									</div>
									{hasBattery && (
										<p className="mt-3 text-xs text-[var(--ink-soft)]">
											Upfront cost{" "}
											<span className="font-bold text-[var(--ink)]">
												{euro(totalBatteryCost)}
											</span>
										</p>
									)}
								</div>

								<div className="grid grid-cols-2 gap-4">
									<Field
										label="Cost €/kWh"
										value={batteryCostPerKWh}
										step="1"
										onChange={setBatteryCostPerKWh}
									/>
									<Field
										label="Target payback (yrs)"
										value={batteryRecupYears}
										step="1"
										onChange={setBatteryRecupYears}
									/>
									<Field
										label="Plant capacity (kW)"
										value={capacityKW}
										step="1"
										onChange={setCapacityKW}
										icon={<Zap className="h-3.5 w-3.5" />}
									/>
									<Field
										label="VAT (%)"
										value={vat}
										step="1"
										onChange={setVat}
										icon={<Percent className="h-3.5 w-3.5" />}
									/>
								</div>
							</div>
						</Reveal>

						{/* Verdict panel */}
						<Reveal className="lg:col-span-3" delay={160}>
							<div
								className={cn(
									"relative h-full overflow-hidden rounded-3xl border p-6 sm:p-8",
									isGoodInvestment
										? "border-[rgba(54,226,164,0.35)] glow-green"
										: "border-[var(--line)] glass",
								)}
								style={{
									background: isGoodInvestment
										? "linear-gradient(135deg, rgba(54,226,164,0.1), rgba(42,212,255,0.06))"
										: undefined,
								}}
							>
								<div className="flex flex-wrap items-center gap-3">
									{hasBattery ? (
										<span
											className={cn(
												"inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider",
												isGoodInvestment
													? "bg-[var(--elec-green)] text-[#04101f]"
													: "bg-[rgba(255,107,130,0.15)] text-[var(--elec-red)]",
											)}
										>
											{isGoodInvestment ? (
												<>
													<CheckCircle2 className="h-3.5 w-3.5" /> Solid
													investment
												</>
											) : (
												<>
													<AlertCircle className="h-3.5 w-3.5" /> Pays back too
													slowly
												</>
											)}
										</span>
									) : (
										<span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(120,165,230,0.12)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
											<Info className="h-3.5 w-3.5" /> No battery selected
										</span>
									)}
								</div>

								<div className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-3">
									<Metric
										icon={<Clock className="h-4 w-4" />}
										label="Payback period"
										value={
											Number.isFinite(paybackYears)
												? `${animatedPayback.toFixed(1)}`
												: "—"
										}
										unit={Number.isFinite(paybackYears) ? "years" : ""}
										accent="amber"
									/>
									<Metric
										icon={<PiggyBank className="h-4 w-4" />}
										label="Saved per year"
										value={euro(animatedSavings)}
										unit="vs no battery"
										accent="green"
									/>
									<Metric
										icon={<Activity className="h-4 w-4" />}
										label="Covered by battery"
										value={`${Math.round(animatedCovered)}`}
										unit="kWh / year"
										accent="cyan"
									/>
								</div>

								{/* Payback vs target bar */}
								<div className="mt-8">
									<div className="mb-2 flex justify-between text-xs font-medium text-[var(--ink-soft)]">
										<span>
											Payback against your {batteryRecupYears}-yr target
										</span>
										<span
											className={cn(
												"font-bold",
												isGoodInvestment
													? "text-[var(--elec-green)]"
													: "text-[var(--elec-red)]",
											)}
										>
											{Number.isFinite(paybackYears)
												? `${paybackYears.toFixed(1)} / ${batteryRecupYears} yrs`
												: "n/a"}
										</span>
									</div>
									<div className="h-2.5 w-full overflow-hidden rounded-full bg-[rgba(120,165,230,0.14)]">
										<div
											className={cn(
												"charge-fill h-full rounded-full",
												!isGoodInvestment &&
													hasBattery &&
													"!bg-[var(--elec-red)] !shadow-none",
											)}
											style={{ width: `${hasBattery ? paybackFill : 0}%` }}
										/>
									</div>
									<p className="mt-4 text-sm leading-relaxed text-[var(--ink-soft)]">
										{!hasBattery
											? "Drag the battery size slider to model an investment."
											: isGoodInvestment
												? `Your ${batterySize} kWh battery recoups its ${euro(totalBatteryCost)} cost within your target window — a worthwhile upgrade at today's tariffs.`
												: `At ${euro(totalBatteryCost)} upfront, a ${batterySize} kWh battery doesn't recoup within ${batteryRecupYears} years for this consumption profile. Try a smaller size or a lower €/kWh.`}
									</p>
								</div>
							</div>
						</Reveal>
					</div>
				</section>

				{/* ---------------- Sizing matrix ---------------- */}
				<section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
					<Reveal>
						<SectionHeading
							icon={<Layers className="h-5 w-5" />}
							eyebrow="Compare sizes"
							title="Which battery size pays back fastest?"
						/>
					</Reveal>
					<div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
						{batteryRecs.map((rec, idx) => {
							const isSelected = rec.size === batterySize;
							const recommended =
								rec.size > 0 && rec.yearsToRecup <= batteryRecupYears;
							return (
								<Reveal key={rec.size} delay={idx * 70}>
									<button
										type="button"
										onClick={() => setBatterySize(rec.size)}
										className={cn(
											"lift w-full rounded-2xl border p-5 text-left",
											isSelected
												? "border-[var(--elec-cyan)] glow-cyan"
												: "glass hover:border-[var(--line-strong)]",
										)}
										style={
											isSelected
												? {
														background:
															"linear-gradient(160deg, rgba(42,212,255,0.12), rgba(61,123,255,0.05))",
													}
												: undefined
										}
									>
										<div className="flex items-center justify-between">
											<span className="text-sm font-semibold text-[var(--ink-soft)]">
												{rec.size} kWh
											</span>
											{recommended && (
												<span className="pulse-dot h-2 w-2 rounded-full bg-[var(--elec-green)]" />
											)}
										</div>
										<p className="mt-3 text-2xl font-black text-[var(--ink)]">
											{euro(rec.annualSaving)}
											<span className="text-xs font-medium text-[var(--ink-faint)]">
												/yr
											</span>
										</p>
										<div className="mt-4 border-t border-[var(--line)] pt-3">
											<p className="text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">
												Payback
											</p>
											<p
												className={cn(
													"text-sm font-bold",
													recommended
														? "text-[var(--elec-green)]"
														: "text-[var(--ink)]",
												)}
											>
												{rec.yearsToRecup === Infinity || rec.size === 0
													? "No recoup"
													: `${rec.yearsToRecup.toFixed(1)} yrs`}
											</p>
											<p className="mt-1 text-[10px] text-[var(--ink-faint)]">
												{euro(rec.batteryCost)} upfront
											</p>
										</div>
									</button>
								</Reveal>
							);
						})}
					</div>
				</section>

				{/* ---------------- Tariff plan comparison ---------------- */}
				<section
					id="plans"
					className="mx-auto max-w-7xl scroll-mt-20 px-4 py-12 sm:px-6 lg:px-8"
				>
					<Reveal>
						<SectionHeading
							icon={<Wallet className="h-5 w-5" />}
							eyebrow="2026 ESO tariffs"
							title="Tariff plan comparison"
							trailing={
								hasBattery ? (
									<span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-strong)] px-3 py-1 text-xs font-medium text-[var(--elec-cyan)]">
										<span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--elec-cyan)]" />
										with {batterySize} kWh battery
									</span>
								) : null
							}
						/>
					</Reveal>
					<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
						{results.withBattery.map((plan, idx) => {
							const isBest = plan.planName === bestPlan.planName;
							return (
								<Reveal key={plan.planName} delay={idx * 90}>
									<div
										className={cn(
											"lift relative flex h-full flex-col rounded-3xl border p-6",
											isBest
												? "border-[var(--elec-amber)] glow-amber"
												: "glass",
										)}
										style={
											isBest
												? {
														background:
															"linear-gradient(160deg, rgba(255,210,63,0.1), rgba(255,210,63,0.02))",
													}
												: undefined
										}
									>
										{isBest && (
											<span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--elec-amber)] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#04101f]">
												Cheapest
											</span>
										)}
										<div className="mb-5">
											<h3 className="font-bold text-[var(--ink)]">
												{plan.planName}
											</h3>
											<p className="text-xs text-[var(--ink-faint)]">
												{plan.planSubtitle}
											</p>
											<div className="mt-2 flex items-baseline gap-1">
												<span className="text-3xl font-black text-[var(--ink)]">
													{plan.grandTotal.toFixed(2)}€
												</span>
												<span className="text-sm text-[var(--ink-faint)]">
													/yr
												</span>
											</div>
										</div>
										<dl className="grow space-y-2.5 text-sm">
											<PlanRow
												label="Reclaim fee"
												value={`${plan.reclaimCost.toFixed(2)}€`}
											/>
											<PlanRow
												label="Purchase total"
												value={`${plan.purchaseCost.toFixed(2)}€`}
											/>
											<PlanRow
												label="Capacity fee"
												value={`${plan.capacityCost.toFixed(2)}€`}
											/>
											<div className="!mt-3 border-t border-[var(--line)] pt-3">
												<PlanRow
													muted
													label="Stored in grid"
													value={`${plan.totalStored.toFixed(0)} kWh`}
												/>
												<PlanRow
													muted
													label="Reclaimed"
													value={`${plan.totalReclaimed.toFixed(0)} kWh`}
												/>
												<PlanRow
													muted
													label="Deficit"
													value={`${plan.totalDeficit.toFixed(0)} kWh`}
												/>
											</div>
										</dl>
									</div>
								</Reveal>
							);
						})}
					</div>
				</section>

				{/* ---------------- Your data ---------------- */}
				<section
					id="data"
					className="mx-auto max-w-7xl scroll-mt-20 px-4 py-12 sm:px-6 lg:px-8"
				>
					<Reveal>
						<div className="glass overflow-hidden rounded-3xl">
							<div className="flex flex-col gap-4 border-b border-[var(--line)] p-6 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<h2 className="flex items-center gap-2 text-lg font-bold">
										<Gauge className="h-5 w-5 text-[var(--elec-cyan)]" />
										Your monthly energy
									</h2>
									<p className="mt-1 text-sm text-[var(--ink-soft)]">
										Import your ESO ZIP, or fill the table by hand.
									</p>
								</div>
								<div className="flex flex-wrap items-center gap-2.5">
									<button
										type="button"
										disabled={isImportingEso}
										onClick={() => esoFileInputRef.current?.click()}
										className={cn(
											"flex items-center gap-1.5 rounded-xl border border-[var(--line-strong)] px-3.5 py-2 text-xs font-semibold transition hover:border-[var(--elec-cyan)] hover:text-[var(--elec-cyan)]",
											isImportingEso && "cursor-not-allowed opacity-60",
										)}
									>
										<Upload className="h-3.5 w-3.5" />
										{isImportingEso ? "Importing…" : "Import ESO ZIP"}
									</button>
									<select
										value={nordPoolYear}
										onChange={(e) => setNordPoolYear(e.target.value)}
										className="field field-amber px-3 py-2 text-xs"
										aria-label="NordPool price year"
									>
										<option value="2024">2024–2025</option>
										<option value="2025">2025–2026</option>
									</select>
									<button
										type="button"
										disabled={isLoadingPrices}
										onClick={handleNordPoolPrefill}
										className={cn(
											"flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--elec-amber)] to-[#ffb020] px-3.5 py-2 text-xs font-bold text-[#04101f] transition hover:brightness-110",
											isLoadingPrices && "cursor-not-allowed opacity-60",
										)}
									>
										{isLoadingPrices ? (
											<>
												<span className="h-3 w-3 animate-spin rounded-full border-2 border-[#04101f]/40 border-t-[#04101f]" />
												Loading…
											</>
										) : (
											<>
												<TrendingUp className="h-3.5 w-3.5" />
												Pre-fill from NordPool
											</>
										)}
									</button>
								</div>
							</div>

							{/* Operator cost row */}
							<div className="flex items-center gap-2 border-b border-[var(--line)] px-6 py-3 text-xs text-[var(--ink-soft)]">
								<Euro className="h-3.5 w-3.5 text-[var(--ink-faint)]" />
								<label htmlFor="operator-cost">Operator cost €/kWh</label>
								<input
									id="operator-cost"
									type="number"
									step="0.001"
									value={operatorCost}
									onChange={(e) =>
										setOperatorCost(parseFloat(e.target.value) || 0)
									}
									className="field field-amber w-24 px-2 py-1"
								/>
								<span className="ml-auto flex items-center gap-1.5 text-[var(--ink-faint)]">
									<Info className="h-3.5 w-3.5" />
									Added to NordPool price during pre-fill
								</span>
							</div>

							<div className="overflow-x-auto p-2 sm:p-4">
								<table className="w-full min-w-[480px] text-sm">
									<thead>
										<tr className="text-left text-xs uppercase tracking-wider text-[var(--ink-faint)]">
											<th className="px-3 pb-3 font-medium">Month</th>
											<th className="px-3 pb-3 font-medium">Taken (kWh)</th>
											<th className="px-3 pb-3 font-medium">Sent (kWh)</th>
											<th className="px-3 pb-3 font-medium">Price €/kWh</th>
										</tr>
									</thead>
									<tbody>
										{monthlyInputs.map((input, idx) => (
											<tr
												key={input.month}
												className="border-t border-[var(--line)] transition hover:bg-[rgba(42,212,255,0.04)]"
											>
												<td className="px-3 py-2.5 font-medium text-[var(--ink-soft)]">
													{input.month}
												</td>
												<td className="px-3 py-2.5">
													<input
														type="number"
														value={input.takenFromGrid}
														onChange={(e) =>
															updateMonthlyInput(
																idx,
																"takenFromGrid",
																e.target.value,
															)
														}
														className="field w-24 px-2.5 py-1.5 tabular-nums"
													/>
												</td>
												<td className="px-3 py-2.5">
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
														className="field w-24 px-2.5 py-1.5 tabular-nums"
													/>
												</td>
												<td className="px-3 py-2.5">
													<input
														type="number"
														step="0.001"
														value={input.electricityPrice}
														onChange={(e) =>
															updateMonthlyInput(
																idx,
																"electricityPrice",
																e.target.value,
															)
														}
														className="field field-amber w-24 px-2.5 py-1.5 font-medium tabular-nums text-[var(--elec-amber)]"
													/>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</Reveal>
				</section>
			</main>

			{/* ---------------- Footer ---------------- */}
			<footer className="relative z-10 border-t border-[var(--line)] py-10">
				<div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 text-center text-sm text-[var(--ink-faint)] sm:px-6 lg:px-8">
					<a
						href="https://www.eso.lt/namams/elektra/tarifu-planai-kainos-atsiskaitymas/gaminanciu-vartotoju-atsiskaitymo-budai-2026-metais/4829"
						target="_blank"
						rel="noreferrer"
						className="flex items-center gap-1.5 font-medium text-[var(--ink-soft)] transition hover:text-[var(--elec-cyan)]"
					>
						ESO 2026 settlement guide
						<ExternalLink className="h-3.5 w-3.5" />
					</a>
					<p>© 2026 VoltInvest · Estimates based on VERT 2026 regulations</p>
				</div>
			</footer>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* Presentational helpers                                              */
/* ------------------------------------------------------------------ */

const ACCENTS = {
	cyan: "var(--elec-cyan)",
	amber: "var(--elec-amber)",
	green: "var(--elec-green)",
} as const;

type Accent = keyof typeof ACCENTS;

function StatChip({
	icon,
	label,
	value,
	accent,
}: {
	icon: React.ReactNode;
	label: string;
	value: string;
	accent: Accent;
}) {
	return (
		<div className="glass lift flex items-center gap-4 rounded-2xl p-5 text-left">
			<span
				className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
				style={{
					color: ACCENTS[accent],
					background: `color-mix(in srgb, ${ACCENTS[accent]} 14%, transparent)`,
				}}
			>
				{icon}
			</span>
			<div>
				<p className="text-xs text-[var(--ink-faint)]">{label}</p>
				<p className="text-xl font-black tabular-nums text-[var(--ink)]">
					{value}
				</p>
			</div>
		</div>
	);
}

function SectionHeading({
	icon,
	eyebrow,
	title,
	trailing,
}: {
	icon: React.ReactNode;
	eyebrow: string;
	title: string;
	trailing?: React.ReactNode;
}) {
	return (
		<div className="mb-7 flex flex-wrap items-end justify-between gap-3">
			<div>
				<p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--elec-cyan)]">
					{icon}
					{eyebrow}
				</p>
				<h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
					{title}
				</h2>
			</div>
			{trailing}
		</div>
	);
}

function Metric({
	icon,
	label,
	value,
	unit,
	accent,
}: {
	icon: React.ReactNode;
	label: string;
	value: string;
	unit: string;
	accent: Accent;
}) {
	return (
		<div>
			<p
				className="flex items-center gap-1.5 text-xs font-medium"
				style={{ color: ACCENTS[accent] }}
			>
				{icon}
				{label}
			</p>
			<p className="mt-1.5 text-3xl font-black tabular-nums text-[var(--ink)]">
				{value}
			</p>
			{unit && <p className="text-xs text-[var(--ink-faint)]">{unit}</p>}
		</div>
	);
}

function PlanRow({
	label,
	value,
	muted,
}: {
	label: string;
	value: string;
	muted?: boolean;
}) {
	return (
		<div className="flex items-center justify-between">
			<dt
				className={cn(
					muted
						? "text-[11px] uppercase tracking-wide text-[var(--ink-faint)]"
						: "text-[var(--ink-soft)]",
				)}
			>
				{label}
			</dt>
			<dd
				className={cn(
					"font-semibold tabular-nums",
					muted ? "text-xs text-[var(--ink-faint)]" : "text-[var(--ink)]",
				)}
			>
				{value}
			</dd>
		</div>
	);
}

function Field({
	label,
	value,
	step,
	onChange,
	icon,
}: {
	label: string;
	value: number;
	step: string;
	onChange: (value: number) => void;
	icon?: React.ReactNode;
}) {
	return (
		<div>
			<label className="mb-1.5 block text-xs font-medium text-[var(--ink-soft)]">
				{label}
			</label>
			<div className="relative">
				{icon && (
					<span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]">
						{icon}
					</span>
				)}
				<input
					type="number"
					step={step}
					value={value}
					onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
					className={cn(
						"field py-2 text-sm tabular-nums",
						icon ? "pl-9 pr-3" : "px-3",
					)}
				/>
			</div>
		</div>
	);
}
