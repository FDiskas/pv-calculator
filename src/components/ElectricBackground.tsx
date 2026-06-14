import { useEffect, useRef } from "react";

/**
 * Immersive "electricity" backdrop rendered behind the whole page.
 *
 * Three depth layers drift at different rates as the user scrolls
 * (classic parallax), on top of continuous CSS ambient animations.
 * Scroll work is done inside a single requestAnimationFrame loop that
 * mutates the layer transforms directly — React never re-renders on
 * scroll, so the effect stays at 60fps. Honours prefers-reduced-motion.
 */
export default function ElectricBackground() {
	const layersRef = useRef<HTMLDivElement[]>([]);

	useEffect(() => {
		const reduceMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (reduceMotion) {
			return;
		}

		const factors = [0.12, 0.26, 0.45];
		let frame = 0;

		const apply = () => {
			frame = 0;
			const offset = window.scrollY;
			layersRef.current.forEach((layer, index) => {
				if (layer) {
					layer.style.transform = `translate3d(0, ${offset * factors[index]}px, 0)`;
				}
			});
		};

		const onScroll = () => {
			if (!frame) {
				frame = window.requestAnimationFrame(apply);
			}
		};

		window.addEventListener("scroll", onScroll, { passive: true });
		apply();

		return () => {
			window.removeEventListener("scroll", onScroll);
			if (frame) {
				window.cancelAnimationFrame(frame);
			}
		};
	}, []);

	const registerLayer = (index: number) => (node: HTMLDivElement | null) => {
		if (node) {
			layersRef.current[index] = node;
		}
	};

	return (
		<div className="bg-stage" aria-hidden="true">
			{/* Layer 0 — glowing energy blobs (slowest) */}
			<div ref={registerLayer(0)} className="parallax-layer">
				<div
					className="blob"
					style={{
						top: "-6%",
						left: "8%",
						width: 460,
						height: 460,
						background:
							"radial-gradient(circle, rgba(42,212,255,0.55), transparent 70%)",
					}}
				/>
				<div
					className="blob"
					style={{
						top: "30%",
						right: "4%",
						width: 520,
						height: 520,
						background:
							"radial-gradient(circle, rgba(167,139,250,0.45), transparent 70%)",
						animationDelay: "3s",
					}}
				/>
				<div
					className="blob"
					style={{
						bottom: "-4%",
						left: "35%",
						width: 420,
						height: 420,
						background:
							"radial-gradient(circle, rgba(255,210,63,0.3), transparent 70%)",
						animationDelay: "6s",
					}}
				/>
			</div>

			{/* Layer 1 — circuit grid + lightning bolts */}
			<div ref={registerLayer(1)} className="parallax-layer">
				<div className="grid-mesh" />
				<svg
					className="absolute inset-0 h-full w-full"
					viewBox="0 0 1440 900"
					preserveAspectRatio="xMidYMid slice"
					fill="none"
				>
					<title>Lightning</title>
					<path
						className="bolt"
						d="M250 60 L210 360 L300 340 L230 720"
						strokeWidth="2.5"
						strokeLinejoin="round"
						strokeLinecap="round"
					/>
					<path
						className="bolt-2"
						d="M1180 80 L1230 300 L1140 320 L1210 640"
						strokeWidth="2.5"
						strokeLinejoin="round"
						strokeLinecap="round"
					/>
				</svg>
			</div>

			{/* Layer 2 — rising sparks (fastest) */}
			<div ref={registerLayer(2)} className="parallax-layer">
				{SPARKS.map((spark) => (
					<span
						key={spark.id}
						className="spark"
						style={{
							left: spark.left,
							top: spark.top,
							animationDuration: spark.duration,
							animationDelay: spark.delay,
						}}
					/>
				))}
			</div>
		</div>
	);
}

const SPARKS = [
	{ id: 1, left: "12%", top: "30%", duration: "6s", delay: "0s" },
	{ id: 2, left: "28%", top: "55%", duration: "8s", delay: "1.2s" },
	{ id: 3, left: "44%", top: "22%", duration: "7s", delay: "2.4s" },
	{ id: 4, left: "61%", top: "60%", duration: "9s", delay: "0.6s" },
	{ id: 5, left: "73%", top: "35%", duration: "6.5s", delay: "3s" },
	{ id: 6, left: "86%", top: "50%", duration: "8.5s", delay: "1.8s" },
	{ id: 7, left: "20%", top: "75%", duration: "7.5s", delay: "2s" },
	{ id: 8, left: "52%", top: "80%", duration: "9.5s", delay: "0.3s" },
] as const;
