import { cn } from "../../lib/utils";

export function PlanRow({
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
						? "text-[11px] uppercase tracking-wide text-(--ink-faint)"
						: "text-(--ink-soft)",
				)}
			>
				{label}
			</dt>
			<dd
				className={cn(
					"font-semibold tabular-nums",
					muted ? "text-xs text-(--ink-faint)" : "text-(--ink)",
				)}
			>
				{value}
			</dd>
		</div>
	);
}
