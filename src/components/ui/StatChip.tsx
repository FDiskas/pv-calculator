import { ACCENTS, type Accent } from "./accent";

export function StatChip({
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
				<p className="text-xs text-(--ink-faint)">{label}</p>
				<p className="text-xl font-black tabular-nums text-(--ink)">{value}</p>
			</div>
		</div>
	);
}
