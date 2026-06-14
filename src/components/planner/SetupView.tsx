import {
	AlertCircle,
	ArrowRight,
	BatteryCharging,
	CheckCircle2,
	ExternalLink,
	Sparkles,
	Upload,
	Zap,
} from "lucide-react";
import { euro } from "../../lib/format";
import { localizeError } from "../../lib/planner-i18n";
import { translate, withParams } from "../../lib/translate";
import { cn } from "../../lib/utils";
import Reveal from "../Reveal";
import { Field } from "../ui/Field";
import { SetupCard } from "../ui/SetupCard";
import { MonthlyDataTable } from "./MonthlyDataTable";
import { usePlanner } from "./PlannerProvider";
import { PriceStatus } from "./PriceStatus";

/**
 * Setup view — collects the system, consumption, and assumption inputs we need
 * before running the analysis.
 */
export function SetupView() {
	const t = translate;
	const {
		capacityKW,
		setCapacityKW,
		batteryCostPerKWh,
		setBatteryCostPerKWh,
		batteryRecupYears,
		setBatteryRecupYears,
		isImportingEso,
		esoFileInputRef,
		manualEntry,
		setManualEntry,
		esoImported,
		esoImportError,
		totals,
		hasData,
		handleAnalyze,
	} = usePlanner();

	return (
		<div className="mx-auto max-w-3xl px-4 pb-20 pt-14 sm:px-6 lg:px-8 lg:pt-20">
			<Reveal className="text-center">
				<span className="inline-flex items-center gap-2 rounded-full border border-(--line-strong) bg-[rgba(8,14,27,0.5)] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-(--elec-cyan)">
					<Sparkles className="h-3.5 w-3.5" />
					{t.setupBadge}
				</span>
				<h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
					<span className="text-gradient-elec">{t.setupTitleHighlight}</span>{" "}
					{t.setupTitleRest}
				</h1>
				<p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-(--ink-soft)">
					{t.setupSubtitle}
				</p>
			</Reveal>

			<div className="mt-10 space-y-5">
				{/* Step 1 — system */}
				<Reveal delay={80}>
					<SetupCard step={1} title={t.setupStep1Title}>
						<div className="max-w-xs">
							<Field
								label={t.fieldCapacity}
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
					<SetupCard step={2} title={t.setupStep2Title}>
						<p className="mb-4 text-sm text-(--ink-soft)">
							{t.setupStep2Desc}{" "}
							<a
								href="https://mano.eso.lt/consumption/history"
								target="_blank"
								rel="noopener noreferrer"
							>
								<ExternalLink className="size-3 inline" />
							</a>
						</p>

						<div className="flex flex-col gap-3 sm:flex-row">
							<button
								type="button"
								disabled={isImportingEso}
								onClick={() => esoFileInputRef.current?.click()}
								className={cn(
									"group flex flex-1 items-center justify-center gap-2.5 rounded-2xl bg-linear-to-r from-(--elec-cyan) to-(--elec-blue) px-6 py-3.5 text-sm font-bold text-[#04101f] transition glow-cyan hover:scale-[1.01]",
									isImportingEso && "cursor-not-allowed opacity-70",
								)}
							>
								{isImportingEso ? (
									<>
										<span className="h-4 w-4 animate-spin rounded-full border-2 border-[#04101f]/40 border-t-[#04101f]" />
										{t.importing}
									</>
								) : (
									<>
										<Upload className="h-4 w-4" />
										{t.importButton}
									</>
								)}
							</button>
							<button
								type="button"
								onClick={() => setManualEntry((v) => !v)}
								className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-(--line-strong) bg-[rgba(8,14,27,0.5)] px-6 py-3.5 text-sm font-semibold transition hover:border-(--elec-cyan)"
							>
								{manualEntry ? t.manualHide : t.manualShow}
							</button>
						</div>

						{esoImported && !esoImportError && (
							<p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-(--elec-green)">
								<CheckCircle2 className="h-3.5 w-3.5" />
								{withParams(t.importSuccess, {
									sent: euro(totals.sent),
									taken: euro(totals.taken),
								})}
							</p>
						)}
						{esoImportError && (
							<p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-(--elec-red)">
								<AlertCircle className="h-3.5 w-3.5" />
								{localizeError(esoImportError)}
							</p>
						)}

						{(manualEntry || (hasData && !esoImported)) && (
							<div className="mt-5">
								<MonthlyDataTable />
							</div>
						)}

						<PriceStatus />
					</SetupCard>
				</Reveal>

				{/* Step 3 — assumptions */}
				<Reveal delay={240}>
					<SetupCard step={3} title={t.setupStep3Title}>
						<div className="grid grid-cols-2 gap-4">
							<Field
								label={t.fieldBatteryCost}
								value={batteryCostPerKWh}
								step="1"
								onChange={setBatteryCostPerKWh}
							/>
							<Field
								label={t.fieldPayback}
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
								? "bg-linear-to-r from-(--elec-cyan) to-(--elec-blue) text-[#04101f] glow-cyan hover:scale-[1.01]"
								: "cursor-not-allowed border border-(--line) bg-[rgba(8,14,27,0.5)] text-(--ink-faint)",
						)}
					>
						<BatteryCharging className="h-5 w-5" />
						{t.analyzeButton}
						<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
					</button>
					{!hasData && (
						<p className="mt-3 text-center text-xs text-(--ink-faint)">
							{t.analyzeHint}
						</p>
					)}
				</Reveal>
			</div>
		</div>
	);
}
