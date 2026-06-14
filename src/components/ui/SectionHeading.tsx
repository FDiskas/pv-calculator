export function SectionHeading({
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
				<p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-(--elec-cyan)">
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
