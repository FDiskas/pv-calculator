/** biome-ignore-all lint/a11y/noLabelWithoutControl: label is paired visually */
import {
	Activity,
	AlertCircle,
	BatteryCharging,
	CheckCircle2,
	Clock,
	Gauge,
	Info,
	Layers,
	PiggyBank,
	SlidersHorizontal,
	Sparkles,
	TrendingUp,
	Wallet,
} from "lucide-react";
import { euro } from "../../lib/format";
import {
	energyExchangePct,
	planDisplayName,
	planDisplaySubtitle,
} from "../../lib/planner-i18n";
import { translate, withParams } from "../../lib/translate";
import { cn } from "../../lib/utils";
import Reveal from "../Reveal";
import { Metric } from "../ui/Metric";
import { PlanRow } from "../ui/PlanRow";
import { SectionHeading } from "../ui/SectionHeading";
import { StatChip } from "../ui/StatChip";
import { MonthlyDataTable } from "./MonthlyDataTable";
import { usePlanner } from "./PlannerProvider";
import { PriceStatus } from "./PriceStatus";

/** Results view — recommendation hero, verdict cockpit, size matrix, and plans. */
export function ResultsView() {
	const t = translate;
	const {
		recommended,
		animatedRecSize,
		batteryRecupYears,
		batteryCostPerKWh,
		animatedSavings,
		paybackYears,
		animatedPayback,
		animatedCovered,
		bestPlan,
		results,
		batteryRecs,
		batterySize,
		setBatterySize,
		totalBatteryCost,
		hasBattery,
		isGoodInvestment,
		paybackFill,
		tariffs,
		goToSetup,
	} = usePlanner();

	const exchangePct = energyExchangePct(tariffs);

	return (
		<>
			{/* Recommendation hero */}
			<section className="mx-auto max-w-6xl px-4 pb-8 pt-14 sm:px-6 lg:px-8 lg:pt-20">
				<Reveal className="text-center">
					<span className="inline-flex items-center gap-2 rounded-full border border-(--line-strong) bg-[rgba(8,14,27,0.5)] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-(--elec-cyan)">
						<Sparkles className="h-3.5 w-3.5" />
						{t.resultsBadge}
					</span>
					{recommended ? (
						<>
							<h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
								{t.recBuyPrefix}{" "}
								<span className="text-gradient-elec">
									{Math.round(animatedRecSize)} kWh
								</span>{" "}
								{t.recBuySuffix}
							</h1>
							<p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-(--ink-soft) sm:text-lg">
								{t.recSubPre}{" "}
								<strong className="text-(--ink)">
									{withParams(t.recYears, {
										years: recommended.yearsToRecup.toFixed(1),
									})}
								</strong>{" "}
								{t.recSubMid}{" "}
								<strong className="text-(--elec-green)">
									{withParams(t.recPerYear, {
										amount: euro(recommended.annualSaving),
									})}
								</strong>{" "}
								{withParams(t.recSubPost, { target: batteryRecupYears })}
							</p>
						</>
					) : (
						<>
							<h1 className="mt-6 text-3xl font-black leading-tight tracking-tight sm:text-5xl">
								{t.noneTitlePre}{" "}
								<span className="text-gradient-elec">
									{t.noneTitleHighlight}
								</span>
							</h1>
							<p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-(--ink-soft)">
								{withParams(t.noneSub, {
									price: batteryCostPerKWh,
									target: batteryRecupYears,
								})}
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
						label={t.statAnnualSavings}
						value={withParams(t.perYr, { amount: euro(animatedSavings) })}
					/>
					<StatChip
						icon={<Clock className="h-5 w-5" />}
						accent="amber"
						label={t.statPaybackPeriod}
						value={
							Number.isFinite(paybackYears)
								? withParams(t.yrs, { n: animatedPayback.toFixed(1) })
								: "—"
						}
					/>
					<StatChip
						icon={<TrendingUp className="h-5 w-5" />}
						accent="cyan"
						label={withParams(t.statCheapestPlan, {
							plan: planDisplayName(bestPlan.planName),
						})}
						value={withParams(t.perYr, { amount: euro(bestPlan.grandTotal) })}
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
						eyebrow={t.verdictEyebrow}
						title={t.verdictTitle}
					/>
				</Reveal>
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
					<Reveal className="lg:col-span-2" delay={80}>
						<div className="glass h-full rounded-3xl p-6 sm:p-7">
							<div className="flex items-baseline justify-between">
								<label className="text-sm font-semibold text-(--ink-soft)">
									{t.verdictBatterySize}
								</label>
								<span className="text-3xl font-black text-(--elec-cyan)">
									{batterySize}
									<span className="ml-1 text-sm font-medium text-(--ink-faint)">
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
							<div className="mt-2 flex justify-between text-[10px] text-(--ink-faint)">
								<span>0</span>
								<span>20 kWh</span>
								<span>40 kWh</span>
							</div>
							{recommended && recommended.size !== batterySize && (
								<button
									type="button"
									onClick={() => setBatterySize(recommended.size)}
									className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[rgba(54,226,164,0.4)] px-3 py-2 text-xs font-semibold text-(--elec-green) transition hover:bg-[rgba(54,226,164,0.08)]"
								>
									<Sparkles className="h-3.5 w-3.5" />
									{withParams(t.verdictSnap, { size: recommended.size })}
								</button>
							)}
							{hasBattery && (
								<p className="mt-4 text-xs text-(--ink-soft)">
									{t.verdictUpfront}{" "}
									<span className="font-bold text-(--ink)">
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
									: "glass border-(--line)",
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
										? "bg-[rgba(120,165,230,0.12)] text-(--ink-soft)"
										: isGoodInvestment
											? "bg-(--elec-green) text-[#04101f]"
											: "bg-[rgba(255,107,130,0.15)] text-(--elec-red)",
								)}
							>
								{!hasBattery ? (
									<>
										<Info className="h-3.5 w-3.5" /> {t.badgeNoBattery}
									</>
								) : isGoodInvestment ? (
									<>
										<CheckCircle2 className="h-3.5 w-3.5" /> {t.badgeWorthwhile}
									</>
								) : (
									<>
										<AlertCircle className="h-3.5 w-3.5" /> {t.badgeSlowPayback}
									</>
								)}
							</span>

							<div className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-3">
								<Metric
									icon={<Clock className="h-4 w-4" />}
									label={t.statPaybackPeriod}
									value={
										Number.isFinite(paybackYears)
											? animatedPayback.toFixed(1)
											: "—"
									}
									unit={Number.isFinite(paybackYears) ? t.metricYearsUnit : ""}
									accent="amber"
								/>
								<Metric
									icon={<PiggyBank className="h-4 w-4" />}
									label={t.metricSaved}
									value={euro(animatedSavings)}
									unit={t.metricVsNoBattery}
									accent="green"
								/>
								<Metric
									icon={<Activity className="h-4 w-4" />}
									label={t.metricCovered}
									value={`${Math.round(animatedCovered)}`}
									unit={t.metricKwhPerYear}
									accent="cyan"
								/>
							</div>

							<div className="mt-8">
								<div className="mb-2 flex justify-between text-xs font-medium text-(--ink-soft)">
									<span>
										{withParams(t.verdictPaybackAgainst, {
											target: batteryRecupYears,
										})}
									</span>
									<span
										className={cn(
											"font-bold",
											isGoodInvestment
												? "text-(--elec-green)"
												: "text-(--elec-red)",
										)}
									>
										{Number.isFinite(paybackYears)
											? withParams(t.verdictPaybackRatio, {
													n: paybackYears.toFixed(1),
													target: batteryRecupYears,
												})
											: t.na}
									</span>
								</div>
								<div className="h-2.5 w-full overflow-hidden rounded-full bg-[rgba(120,165,230,0.14)]">
									<div
										className={cn(
											"charge-fill h-full rounded-full",
											!isGoodInvestment &&
												hasBattery &&
												"bg-(--elec-red)! shadow-none!",
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
						eyebrow={t.sizesEyebrow}
						title={t.sizesTitle}
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
											? "border-(--elec-cyan) glow-cyan"
											: isRecommended
												? "border-[rgba(54,226,164,0.4)]"
												: "glass hover:border-(--line-strong)",
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
										<span className="text-sm font-semibold text-(--ink-soft)">
											{rec.size} kWh
										</span>
										{isRecommended && (
											<span className="rounded-full bg-(--elec-green) px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#04101f]">
												{t.sizesBest}
											</span>
										)}
									</div>
									<p className="mt-3 text-2xl font-black text-(--ink)">
										{euro(rec.annualSaving)}
										<span className="text-xs font-medium text-(--ink-faint)">
											/yr
										</span>
									</p>
									<div className="mt-4 border-t border-(--line) pt-3">
										<p className="text-[10px] uppercase tracking-wider text-(--ink-faint)">
											{t.sizesPayback}
										</p>
										<p
											className={cn(
												"text-sm font-bold",
												rec.yearsToRecup <= batteryRecupYears &&
													Number.isFinite(rec.yearsToRecup)
													? "text-(--elec-green)"
													: "text-(--ink)",
											)}
										>
											{Number.isFinite(rec.yearsToRecup)
												? withParams(t.yrs, { n: rec.yearsToRecup.toFixed(1) })
												: t.sizesNoRecoup}
										</p>
										<p className="mt-1 text-[10px] text-(--ink-faint)">
											{withParams(t.sizesUpfront, {
												amount: euro(rec.batteryCost),
											})}
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
						eyebrow={t.plansEyebrow}
						title={t.plansTitle}
						trailing={
							hasBattery ? (
								<span className="inline-flex items-center gap-1.5 rounded-full border border-(--line-strong) px-3 py-1 text-xs font-medium text-(--elec-cyan)">
									<span className="pulse-dot h-1.5 w-1.5 rounded-full bg-(--elec-cyan)" />
									{withParams(t.plansWithBattery, { size: batterySize })}
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
										isBest ? "border-(--elec-amber) glow-amber" : "glass",
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
										<span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-(--elec-amber) px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#04101f]">
											{t.plansCheapest}
										</span>
									)}
									<div className="mb-5">
										<h3 className="font-bold text-(--ink)">
											{planDisplayName(plan.planName)}
										</h3>
										<p className="text-xs text-(--ink-faint)">
											{planDisplaySubtitle(plan.planName, exchangePct)}
										</p>
										<div className="mt-2 flex items-baseline gap-1">
											<span className="text-3xl font-black text-(--ink)">
												{plan.grandTotal.toFixed(2)}€
											</span>
											<span className="text-sm text-(--ink-faint)">/yr</span>
										</div>
									</div>
									<dl className="grow space-y-2.5 text-sm">
										<PlanRow
											label={t.planReclaimFee}
											value={`${plan.reclaimCost.toFixed(2)}€`}
										/>
										<PlanRow
											label={t.planPurchaseTotal}
											value={`${plan.purchaseCost.toFixed(2)}€`}
										/>
										<PlanRow
											label={t.planCapacityFee}
											value={`${plan.capacityCost.toFixed(2)}€`}
										/>
										<div className="mt-3! border-t border-(--line) pt-3">
											<PlanRow
												muted
												label={t.planStoredInGrid}
												value={`${plan.totalStored.toFixed(0)} kWh`}
											/>
											<PlanRow
												muted
												label={t.planReclaimed}
												value={`${plan.totalReclaimed.toFixed(0)} kWh`}
											/>
											<PlanRow
												muted
												label={t.planDeficit}
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
								<Gauge className="h-5 w-5 text-(--elec-cyan)" />
								{t.dataTitle}
							</h2>
							<button
								type="button"
								onClick={goToSetup}
								className="flex items-center gap-1.5 rounded-xl border border-(--line-strong) px-3.5 py-2 text-xs font-semibold transition hover:border-(--elec-cyan) hover:text-(--elec-cyan)"
							>
								<SlidersHorizontal className="h-3.5 w-3.5" />
								{t.editInputs}
							</button>
						</div>
						<MonthlyDataTable />
						<PriceStatus />
					</div>
				</Reveal>
			</section>
		</>
	);
}
