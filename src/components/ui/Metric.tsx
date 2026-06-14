import { ACCENTS, type Accent } from "./accent";

export function Metric({
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
			<p className="mt-1.5 text-3xl font-black tabular-nums text-(--ink)">
				{value}
			</p>
			{unit && <p className="text-xs text-(--ink-faint)">{unit}</p>}
		</div>
	);
}
