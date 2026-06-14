import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, SlidersHorizontal, Zap } from "lucide-react";
import ElectricBackground from "../components/ElectricBackground";
import { LanguageSwitcher, useLanguage } from "../components/LanguageProvider";
import {
	PlannerProvider,
	usePlanner,
} from "../components/planner/PlannerProvider";
import { ResultsView } from "../components/planner/ResultsView";
import { SetupView } from "../components/planner/SetupView";
import { ESO_TARIFFS_URL } from "../lib/eso-tariffs";
import { translate, withParams } from "../lib/translate";
import { cn } from "../lib/utils";

export const Route = createFileRoute("/")({ component: App });

function App() {
	return (
		<PlannerProvider>
			<PlannerShell />
		</PlannerProvider>
	);
}

function PlannerShell() {
	// Subscribe to language changes so every `translate.*` read below — and in
	// the whole subtree — refreshes when the language switches.
	useLanguage();
	const t = translate;
	const {
		showResults,
		goToSetup,
		esoFileInputRef,
		handleEsoImport,
		tariffSource,
		tariffs,
	} = usePlanner();

	return (
		<div className="relative min-h-screen overflow-x-hidden font-sans text-(--ink)">
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
			<header className="glass sticky top-0 z-40 border-b border-(--line)">
				<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
					<a href="#top" className="flex items-center gap-2.5">
						<span className="relative grid h-9 w-9 place-items-center rounded-xl bg-linear-to-br from-(--elec-cyan) to-(--elec-blue) glow-cyan">
							<Zap className="h-5 w-5 text-[#04101f]" fill="currentColor" />
						</span>
						<span className="text-[15px] font-bold tracking-tight">
							Volt<span className="text-(--elec-cyan)">Invest</span>
						</span>
					</a>

					<div className="flex items-center gap-3">
						{showResults ? (
							<div className="flex items-center gap-5">
								<nav className="hidden items-center gap-6 text-sm font-medium text-(--ink-soft) md:flex">
									<a className="transition hover:text-(--ink)" href="#verdict">
										{t.navVerdict}
									</a>
									<a className="transition hover:text-(--ink)" href="#sizes">
										{t.navSizes}
									</a>
									<a className="transition hover:text-(--ink)" href="#plans">
										{t.navPlans}
									</a>
								</nav>
								<button
									type="button"
									onClick={goToSetup}
									className="flex items-center gap-1.5 rounded-full border border-(--line-strong) bg-[rgba(8,14,27,0.6)] px-3.5 py-1.5 text-xs font-semibold transition hover:border-(--elec-cyan) hover:text-(--elec-cyan)"
								>
									<SlidersHorizontal className="h-3.5 w-3.5" />
									{t.editInputs}
								</button>
							</div>
						) : (
							<span className="text-xs font-medium text-(--ink-faint)">
								{t.headerTagline}
							</span>
						)}
						<LanguageSwitcher />
					</div>
				</div>
			</header>

			<main id="top" className="relative z-10">
				{showResults ? <ResultsView /> : <SetupView />}
			</main>

			{/* ---------------- Footer ---------------- */}
			<footer className="relative z-10 border-t border-(--line) py-10">
				<div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 text-center text-sm text-(--ink-faint) sm:px-6 lg:px-8">
					<a
						href={ESO_TARIFFS_URL}
						target="_blank"
						rel="noreferrer"
						className="flex items-center gap-1.5 font-medium text-(--ink-soft) transition hover:text-(--elec-cyan)"
					>
						{t.footerEsoGuide}
						<ExternalLink className="h-3.5 w-3.5" />
					</a>
					<p className="flex items-center gap-1.5">
						<span
							className={cn(
								"h-1.5 w-1.5 rounded-full",
								tariffSource === "live"
									? "bg-(--elec-green)"
									: "bg-(--ink-faint)",
							)}
						/>
						{tariffSource === "live"
							? t.footerTariffsLive
							: t.footerTariffsFallback}{" "}
						{withParams(t.footerTariffDetail, {
							reclaim: tariffs.reclaimFeePerKWh,
							capacity: tariffs.capacityFeePerKW,
						})}
					</p>
					<p>{t.footerCopyright}</p>
				</div>
			</footer>
		</div>
	);
}
