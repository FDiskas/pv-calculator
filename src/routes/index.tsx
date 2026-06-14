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
	SlidersHorizontal,
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
	DEFAULT_TARIFFS,
	ESO_PRICES,
	evaluatePlans,
	getBatteryRecommendation,
	type MonthlyInput,
	pickRecommendedSize,
	type TariffRates,
} from "../lib/calculator";
import { importEsoZip, mergeEsoIntoInputs } from "../lib/eso-csv";
import {
	type EsoTariffResult,
	fetchEsoTariffs,
	TARIFFS_TTL_MS,
} from "../lib/eso-tariffs";
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
const TARIFFS_CACHE_KEY = "eso_tariffs_cache_v1";
const NORDPOOL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const DEFAULT_MONTHLY_INPUTS: MonthlyInput[] = MONTHS.map((month) => ({
	month,
	sentToGrid: 0,
	takenFromGrid: 0,
	electricityPrice: 0.25,
}));

const euro = (value: number) =>
	`${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}€`;

/* ---- localStorage TTL cache helpers ---- */

function readFreshCache<T>(key: string, ttl: number): T | null {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as { ts: number; value: T };
		if (typeof parsed.ts !== "number" || Date.now() - parsed.ts > ttl) {
			return null;
		}
		return parsed.value;
	} catch {
		return null;
	}
}

function writeCache<T>(key: string, value: T) {
	try {
		localStorage.setItem(key, JSON.stringify({ ts: Date.now(), value }));
	} catch {
		/* ignore quota / serialization errors */
	}
}

/** Fetches NordPool prices for a settlement year as raw €/kWh per month. */
async function loadNordPoolBase(year: string): Promise<Record<string, number>> {
	const json = await fetchNordPoolPrices({ data: { year } });
	const base: Record<string, number> = {};
	if (json.success && json.data.lt) {
		const ltData: { timestamp: number; price: number }[] = json.data.lt;
		const agg: Record<string, { sum: number; count: number }> = {};
		for (const entry of ltData) {
			const month = new Date(entry.timestamp * 1000).toLocaleString("en-US", {
				month: "long",
			});
			if (!agg[month]) agg[month] = { sum: 0, count: 0 };
			agg[month].sum += entry.price;
			agg[month].count += 1;
		}
		for (const month of Object.keys(agg)) {
			base[month] = agg[month].sum / agg[month].count / 1000;
		}
	}
	return base;
}

function App() {
	const [isLoaded, setIsLoaded] = useState(false);
	const [showResults, setShowResults] = useState(false);
	const [manualEntry, setManualEntry] = useState(false);

	const [isLoadingPrices, setIsLoadingPrices] = useState(false);
	const [isImportingEso, setIsImportingEso] = useState(false);
	const [esoImportError, setEsoImportError] = useState<string | null>(null);
	const [esoImported, setEsoImported] = useState(false);
	const esoFileInputRef = useRef<HTMLInputElement>(null);

	const [batterySize, setBatterySize] = useState<number>(10);
	const [vat, setVat] = useState<number>(21);
	const [operatorCost, setOperatorCost] = useState<number>(0.136);
	const [capacityKW, setCapacityKW] = useState<number>(10);
	const [nordPoolYear, setNordPoolYear] = useState<string>("2025");
	const [batteryCostPerKWh, setBatteryCostPerKWh] = useState<number>(
		ESO_PRICES.BATTERY_COST_PER_KWH,
	);
	const [batteryRecupYears, setBatteryRecupYears] = useState<number>(10);

	const [monthlyInputs, setMonthlyInputs] = useState<MonthlyInput[]>(
		DEFAULT_MONTHLY_INPUTS,
	);
	const [nordPoolBase, setNordPoolBase] = useState<Record<string, number>>({});
	const [tariffs, setTariffs] = useState<TariffRates>(DEFAULT_TARIFFS);
	const [tariffSource, setTariffSource] =
		useState<EsoTariffResult["source"]>("fallback");

	// Load saved state
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

	// Persist state
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
		monthlyInputs,
		isLoaded,
		showResults,
		batteryCostPerKWh,
		batteryRecupYears,
	]);

	// Auto-load ESO tariffs (cached client-side for ~half a year)
	useEffect(() => {
		const cached = readFreshCache<EsoTariffResult>(
			TARIFFS_CACHE_KEY,
			TARIFFS_TTL_MS,
		);
		if (cached) {
			setTariffs(cached.tariffs);
			setTariffSource(cached.source);
			return;
		}
		let cancelled = false;
		fetchEsoTariffs()
			.then((res) => {
				if (cancelled) return;
				setTariffs(res.tariffs);
				setTariffSource(res.source);
				writeCache(TARIFFS_CACHE_KEY, res);
			})
			.catch((e) => console.error("ESO tariff fetch failed", e));
		return () => {
			cancelled = true;
		};
	}, []);

	// Auto-load NordPool prices for the selected year (cached client-side)
	useEffect(() => {
		const cacheKey = `nordpool_base_${nordPoolYear}`;
		const cached = readFreshCache<Record<string, number>>(
			cacheKey,
			NORDPOOL_TTL_MS,
		);
		if (cached) {
			setNordPoolBase(cached);
			return;
		}
		let cancelled = false;
		setIsLoadingPrices(true);
		loadNordPoolBase(nordPoolYear)
			.then((base) => {
				if (cancelled) return;
				setNordPoolBase(base);
				writeCache(cacheKey, base);
			})
			.catch((e) => console.error("NordPool fetch failed", e))
			.finally(() => {
				if (!cancelled) setIsLoadingPrices(false);
			});
		return () => {
			cancelled = true;
		};
	}, [nordPoolYear]);

	// Electricity price per month, derived live from NordPool base + VAT + operator
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

	const handleEsoImport = async (file: File) => {
		setIsImportingEso(true);
		setEsoImportError(null);
		try {
			const rows = await importEsoZip(file);
			setMonthlyInputs((prev) => mergeEsoIntoInputs(prev, rows));
			setEsoImported(true);
			setManualEntry(false);
		} catch (err) {
			setEsoImportError(err instanceof Error ? err.message : "Import failed");
			console.error("ESO import failed", err);
		} finally {
			setIsImportingEso(false);
			if (esoFileInputRef.current) esoFileInputRef.current.value = "";
		}
	};

	const hasData =
		capacityKW > 0 &&
		monthlyInputs.some((m) => m.sentToGrid > 0 || m.takenFromGrid > 0);

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
			<header className="glass sticky top-0 z-40 border-b border-[var(--line)]">
				<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
					<a href="#top" className="flex items-center gap-2.5">
						<span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[var(--elec-cyan)] to-[var(--elec-blue)] glow-cyan">
							<Zap className="h-5 w-5 text-[#04101f]" fill="currentColor" />
						</span>
						<span className="text-[15px] font-bold tracking-tight">
							Volt<span className="text-[var(--elec-cyan)]">Invest</span>
						</span>
					</a>

					{showResults ? (
						<div className="flex items-center gap-5">
							<nav className="hidden items-center gap-6 text-sm font-medium text-[var(--ink-soft)] md:flex">
								<a
									className="transition hover:text-[var(--ink)]"
									href="#verdict"
								>
									Verdict
								</a>
								<a className="transition hover:text-[var(--ink)]" href="#sizes">
									Sizes
								</a>
								<a className="transition hover:text-[var(--ink)]" href="#plans">
									Plans
								</a>
							</nav>
							<button
								type="button"
								onClick={goToSetup}
								className="flex items-center gap-1.5 rounded-full border border-[var(--line-strong)] bg-[rgba(8,14,27,0.6)] px-3.5 py-1.5 text-xs font-semibold transition hover:border-[var(--elec-cyan)] hover:text-[var(--elec-cyan)]"
							>
								<SlidersHorizontal className="h-3.5 w-3.5" />
								Edit inputs
							</button>
						</div>
					) : (
						<span className="text-xs font-medium text-[var(--ink-faint)]">
							Battery Investment Analysis
						</span>
					)}
				</div>
			</header>

			<main id="top" className="relative z-10">
				{showResults ? renderResults() : renderSetup()}
			</main>

			{/* ---------------- Footer ---------------- */}
			<footer className="relative z-10 border-t border-[var(--line)] py-10">
				<div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 text-center text-sm text-[var(--ink-faint)] sm:px-6 lg:px-8">
					<a
						href="https://www.eso.lt/namams/elektra/tarifu-planai-kainos-atsiskaitymas/gaminanciu-vartotoju-atsiskaitymo-budai-2026-metais/4829"
						target="_blank"
						rel="noreferrer"
						className="flex items-center gap-1.5 font-medium text-[var(--ink-soft)] transition hover:text-[var(--elec-cyan)]"
					>
						ESO 2026 settlement guide
						<ExternalLink className="h-3.5 w-3.5" />
					</a>
					<p className="flex items-center gap-1.5">
						<span
							className={cn(
								"h-1.5 w-1.5 rounded-full",
								tariffSource === "live"
									? "bg-[var(--elec-green)]"
									: "bg-[var(--ink-faint)]",
							)}
						/>
						{tariffSource === "live"
							? "Tariffs parsed live from ESO"
							: "Using built-in 2026 ESO tariffs"}{" "}
						· reclaim {tariffs.reclaimFeePerKWh}€/kWh · capacity{" "}
						{tariffs.capacityFeePerKW}€/kW
					</p>
					<p>© 2026 VoltInvest · Estimates based on VERT 2026 regulations</p>
				</div>
			</footer>
		</div>
	);

	/* ============================================================
	   SETUP VIEW — collect the data we need before showing results
	   ============================================================ */
	function renderSetup() {
		return (
			<div className="mx-auto max-w-3xl px-4 pb-20 pt-14 sm:px-6 lg:px-8 lg:pt-20">
				<Reveal className="text-center">
					<span className="inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] bg-[rgba(8,14,27,0.5)] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--elec-cyan)]">
						<Sparkles className="h-3.5 w-3.5" />
						ESO 2026 · Lithuania
					</span>
					<h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
						<span className="text-gradient-elec">What battery</span> should you
						buy?
					</h1>
					<p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[var(--ink-soft)]">
						Tell us about your solar setup. We'll size the battery that pays for
						itself fastest under the 2026 ESO tariffs — prices are pulled in
						automatically.
					</p>
				</Reveal>

				<div className="mt-10 space-y-5">
					{/* Step 1 — system */}
					<Reveal delay={80}>
						<SetupCard step={1} title="Your solar system">
							<div className="max-w-xs">
								<Field
									label="Plant capacity (kW)"
									value={capacityKW}
									step="1"
									onChange={setCapacityKW}
									icon={<Zap className="h-3.5 w-3.5" />}
								/>
							</div>
						</SetupCard>
					</Reveal>

					{/* Step 2 — data */}
					<Reveal delay={160}>
						<SetupCard step={2} title="Your energy use">
							<p className="mb-4 text-sm text-[var(--ink-soft)]">
								Import the ZIP export from your ESO self-service account — the
								fastest, most accurate option — or enter the 12 months by hand.
							</p>

							<div className="flex flex-col gap-3 sm:flex-row">
								<button
									type="button"
									disabled={isImportingEso}
									onClick={() => esoFileInputRef.current?.click()}
									className={cn(
										"group flex flex-1 items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[var(--elec-cyan)] to-[var(--elec-blue)] px-6 py-3.5 text-sm font-bold text-[#04101f] transition glow-cyan hover:scale-[1.01]",
										isImportingEso && "cursor-not-allowed opacity-70",
									)}
								>
									{isImportingEso ? (
										<>
											<span className="h-4 w-4 animate-spin rounded-full border-2 border-[#04101f]/40 border-t-[#04101f]" />
											Importing…
										</>
									) : (
										<>
											<Upload className="h-4 w-4" />
											Import ESO ZIP
										</>
									)}
								</button>
								<button
									type="button"
									onClick={() => setManualEntry((v) => !v)}
									className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[var(--line-strong)] bg-[rgba(8,14,27,0.5)] px-6 py-3.5 text-sm font-semibold transition hover:border-[var(--elec-cyan)]"
								>
									{manualEntry ? "Hide manual entry" : "Enter manually"}
								</button>
							</div>

							{esoImported && !esoImportError && (
								<p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[var(--elec-green)]">
									<CheckCircle2 className="h-3.5 w-3.5" />
									Imported — {euro(totals.sent)} kWh sent, {euro(totals.taken)}{" "}
									kWh taken across the year.
								</p>
							)}
							{esoImportError && (
								<p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[var(--elec-red)]">
									<AlertCircle className="h-3.5 w-3.5" />
									{esoImportError}
								</p>
							)}

							{(manualEntry || (hasData && !esoImported)) && (
								<div className="mt-5">{renderDataTable()}</div>
							)}

							<PriceStatus />
						</SetupCard>
					</Reveal>

					{/* Step 3 — assumptions */}
					<Reveal delay={240}>
						<SetupCard step={3} title="Battery assumptions">
							<div className="grid grid-cols-2 gap-4">
								<Field
									label="Battery cost (€/kWh)"
									value={batteryCostPerKWh}
									step="1"
									onChange={setBatteryCostPerKWh}
								/>
								<Field
									label="Acceptable payback (yrs)"
									value={batteryRecupYears}
									step="1"
									onChange={setBatteryRecupYears}
								/>
							</div>
						</SetupCard>
					</Reveal>

					<Reveal delay={320}>
						<button
							type="button"
							disabled={!hasData}
							onClick={handleAnalyze}
							className={cn(
								"group flex w-full items-center justify-center gap-2.5 rounded-2xl px-7 py-4 text-base font-bold transition",
								hasData
									? "bg-gradient-to-r from-[var(--elec-cyan)] to-[var(--elec-blue)] text-[#04101f] glow-cyan hover:scale-[1.01]"
									: "cursor-not-allowed border border-[var(--line)] bg-[rgba(8,14,27,0.5)] text-[var(--ink-faint)]",
							)}
						>
							<BatteryCharging className="h-5 w-5" />
							Analyze battery options
							<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
						</button>
						{!hasData && (
							<p className="mt-3 text-center text-xs text-[var(--ink-faint)]">
								Add your plant capacity and at least one month of energy data to
								continue.
							</p>
						)}
					</Reveal>
				</div>
			</div>
		);
	}

	/* ============================================================
	   RESULTS VIEW
	   ============================================================ */
	function renderResults() {
		return (
			<>
				{/* Recommendation hero */}
				<section className="mx-auto max-w-6xl px-4 pb-8 pt-14 sm:px-6 lg:px-8 lg:pt-20">
					<Reveal className="text-center">
						<span className="inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] bg-[rgba(8,14,27,0.5)] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--elec-cyan)]">
							<Sparkles className="h-3.5 w-3.5" />
							Your recommendation
						</span>
						{recommended ? (
							<>
								<h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
									Buy a{" "}
									<span className="text-gradient-elec">
										{Math.round(animatedRecSize)} kWh
									</span>{" "}
									battery
								</h1>
								<p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[var(--ink-soft)] sm:text-lg">
									It pays for itself in{" "}
									<strong className="text-[var(--ink)]">
										{recommended.yearsToRecup.toFixed(1)} years
									</strong>{" "}
									and saves about{" "}
									<strong className="text-[var(--elec-green)]">
										{euro(recommended.annualSaving)}/year
									</strong>{" "}
									— the largest battery that still recoups within your{" "}
									{batteryRecupYears}-year target.
								</p>
							</>
						) : (
							<>
								<h1 className="mt-6 text-3xl font-black leading-tight tracking-tight sm:text-5xl">
									A battery isn't worth it{" "}
									<span className="text-gradient-elec">yet</span>
								</h1>
								<p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[var(--ink-soft)]">
									At {batteryCostPerKWh}€/kWh, no battery size recoups within
									your {batteryRecupYears}-year target for this consumption
									profile. Try a longer target, a lower price, or explore the
									sizes below.
								</p>
							</>
						)}
					</Reveal>

					<Reveal
						delay={160}
						className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3"
					>
						<StatChip
							icon={<PiggyBank className="h-5 w-5" />}
							accent="green"
							label="Annual savings"
							value={`${euro(animatedSavings)}/yr`}
						/>
						<StatChip
							icon={<Clock className="h-5 w-5" />}
							accent="amber"
							label="Payback period"
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
							value={`${euro(bestPlan.grandTotal)}/yr`}
						/>
					</Reveal>
				</section>

				{/* Verdict cockpit */}
				<section
					id="verdict"
					className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10 sm:px-6 lg:px-8"
				>
					<Reveal>
						<SectionHeading
							icon={<BatteryCharging className="h-5 w-5" />}
							eyebrow="Explore"
							title="Fine-tune the battery size"
						/>
					</Reveal>
					<div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
						<Reveal className="lg:col-span-2" delay={80}>
							<div className="glass h-full rounded-3xl p-6 sm:p-7">
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
								{recommended && recommended.size !== batterySize && (
									<button
										type="button"
										onClick={() => setBatterySize(recommended.size)}
										className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[rgba(54,226,164,0.4)] px-3 py-2 text-xs font-semibold text-[var(--elec-green)] transition hover:bg-[rgba(54,226,164,0.08)]"
									>
										<Sparkles className="h-3.5 w-3.5" />
										Snap to recommended · {recommended.size} kWh
									</button>
								)}
								{hasBattery && (
									<p className="mt-4 text-xs text-[var(--ink-soft)]">
										Upfront cost{" "}
										<span className="font-bold text-[var(--ink)]">
											{euro(totalBatteryCost)}
										</span>
									</p>
								)}
							</div>
						</Reveal>

						<Reveal className="lg:col-span-3" delay={160}>
							<div
								className={cn(
									"relative h-full overflow-hidden rounded-3xl border p-6 sm:p-8",
									isGoodInvestment
										? "border-[rgba(54,226,164,0.35)] glow-green"
										: "glass border-[var(--line)]",
								)}
								style={{
									background: isGoodInvestment
										? "linear-gradient(135deg, rgba(54,226,164,0.1), rgba(42,212,255,0.06))"
										: undefined,
								}}
							>
								<span
									className={cn(
										"inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider",
										!hasBattery
											? "bg-[rgba(120,165,230,0.12)] text-[var(--ink-soft)]"
											: isGoodInvestment
												? "bg-[var(--elec-green)] text-[#04101f]"
												: "bg-[rgba(255,107,130,0.15)] text-[var(--elec-red)]",
									)}
								>
									{!hasBattery ? (
										<>
											<Info className="h-3.5 w-3.5" /> No battery
										</>
									) : isGoodInvestment ? (
										<>
											<CheckCircle2 className="h-3.5 w-3.5" /> Worthwhile
										</>
									) : (
										<>
											<AlertCircle className="h-3.5 w-3.5" /> Slow payback
										</>
									)}
								</span>

								<div className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-3">
									<Metric
										icon={<Clock className="h-4 w-4" />}
										label="Payback period"
										value={
											Number.isFinite(paybackYears)
												? animatedPayback.toFixed(1)
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
								</div>
							</div>
						</Reveal>
					</div>
				</section>

				{/* Size matrix */}
				<section
					id="sizes"
					className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10 sm:px-6 lg:px-8"
				>
					<Reveal>
						<SectionHeading
							icon={<Layers className="h-5 w-5" />}
							eyebrow="Compare sizes"
							title="Savings & payback by battery size"
						/>
					</Reveal>
					<div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
						{batteryRecs.map((rec, idx) => {
							const isSelected = rec.size === batterySize;
							const isRecommended = rec.size === recommended?.size;
							return (
								<Reveal key={rec.size} delay={idx * 70}>
									<button
										type="button"
										onClick={() => setBatterySize(rec.size)}
										className={cn(
											"lift w-full rounded-2xl border p-5 text-left",
											isSelected
												? "border-[var(--elec-cyan)] glow-cyan"
												: isRecommended
													? "border-[rgba(54,226,164,0.4)]"
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
											{isRecommended && (
												<span className="rounded-full bg-[var(--elec-green)] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#04101f]">
													Best
												</span>
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
													rec.yearsToRecup <= batteryRecupYears &&
														Number.isFinite(rec.yearsToRecup)
														? "text-[var(--elec-green)]"
														: "text-[var(--ink)]",
												)}
											>
												{Number.isFinite(rec.yearsToRecup)
													? `${rec.yearsToRecup.toFixed(1)} yrs`
													: "No recoup"}
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

				{/* Plan comparison */}
				<section
					id="plans"
					className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10 sm:px-6 lg:px-8"
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

				{/* Edit data */}
				<section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
					<Reveal>
						<div className="glass rounded-3xl p-6">
							<div className="mb-5 flex items-center justify-between">
								<h2 className="flex items-center gap-2 text-lg font-bold">
									<Gauge className="h-5 w-5 text-[var(--elec-cyan)]" />
									Your monthly energy
								</h2>
								<button
									type="button"
									onClick={goToSetup}
									className="flex items-center gap-1.5 rounded-xl border border-[var(--line-strong)] px-3.5 py-2 text-xs font-semibold transition hover:border-[var(--elec-cyan)] hover:text-[var(--elec-cyan)]"
								>
									<SlidersHorizontal className="h-3.5 w-3.5" />
									Edit inputs
								</button>
							</div>
							{renderDataTable()}
							<PriceStatus />
						</div>
					</Reveal>
				</section>
			</>
		);
	}

	/* ---- Shared: NordPool price status + year picker ---- */
	function PriceStatus() {
		return (
			<div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[var(--line)] pt-4 text-xs text-[var(--ink-soft)]">
				<span className="flex items-center gap-1.5">
					{isLoadingPrices ? (
						<span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--ink-faint)] border-t-[var(--elec-amber)]" />
					) : (
						<TrendingUp className="h-3.5 w-3.5 text-[var(--elec-amber)]" />
					)}
					Prices auto-loaded from NordPool
				</span>
				<select
					value={nordPoolYear}
					onChange={(e) => setNordPoolYear(e.target.value)}
					className="field field-amber px-2.5 py-1"
					aria-label="NordPool price year"
				>
					<option value="2024">2024–2025</option>
					<option value="2025">2025–2026</option>
				</select>
				<span className="flex items-center gap-1.5">
					<Percent className="h-3 w-3" />
					VAT
					<input
						type="number"
						value={vat}
						onChange={(e) => setVat(parseInt(e.target.value, 10) || 0)}
						className="field field-amber w-14 px-2 py-1 tabular-nums"
					/>
				</span>
				<span className="flex items-center gap-1.5">
					<Euro className="h-3 w-3" />
					Operator €/kWh
					<input
						type="number"
						step="0.001"
						value={operatorCost}
						onChange={(e) => setOperatorCost(parseFloat(e.target.value) || 0)}
						className="field field-amber w-20 px-2 py-1 tabular-nums"
					/>
				</span>
			</div>
		);
	}

	/* ---- Shared: monthly data table ---- */
	function renderDataTable() {
		return (
			<div className="overflow-x-auto">
				<table className="w-full min-w-[460px] text-sm">
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
											updateMonthlyInput(idx, "takenFromGrid", e.target.value)
										}
										className="field w-24 px-2.5 py-1.5 tabular-nums"
									/>
								</td>
								<td className="px-3 py-2.5">
									<input
										type="number"
										value={input.sentToGrid}
										onChange={(e) =>
											updateMonthlyInput(idx, "sentToGrid", e.target.value)
										}
										className="field w-24 px-2.5 py-1.5 tabular-nums"
									/>
								</td>
								<td className="px-3 py-2.5 tabular-nums text-[var(--elec-amber)]">
									{priceByMonth[input.month] != null
										? priceByMonth[input.month].toFixed(3)
										: "—"}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		);
	}
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

function SetupCard({
	step,
	title,
	children,
}: {
	step: number;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="glass rounded-3xl p-6 sm:p-7">
			<div className="mb-5 flex items-center gap-3">
				<span className="grid h-7 w-7 place-items-center rounded-full border border-[var(--line-strong)] text-xs font-black text-[var(--elec-cyan)]">
					{step}
				</span>
				<h2 className="text-lg font-bold">{title}</h2>
			</div>
			{children}
		</div>
	);
}

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
