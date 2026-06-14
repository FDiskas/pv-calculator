/** biome-ignore-all lint/a11y/noLabelWithoutControl: label is paired visually */
import { cn } from "../../lib/utils";

export function Field({
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
			<label className="mb-1.5 block text-xs font-medium text-(--ink-soft)">
				{label}
			</label>
			<div className="relative">
				{icon && (
					<span className="absolute left-3 top-1/2 -translate-y-1/2 text-(--ink-faint)">
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
