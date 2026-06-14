export function SetupCard({
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
				<span className="grid h-7 w-7 place-items-center rounded-full border border-(--line-strong) text-xs font-black text-(--elec-cyan)">
					{step}
				</span>
				<h2 className="text-lg font-bold">{title}</h2>
			</div>
			{children}
		</div>
	);
}
