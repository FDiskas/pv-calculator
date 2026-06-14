import { useEffect, useRef, useState } from "react";

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Smoothly animates a displayed number towards `target` whenever the
 * target changes. Falls back to the raw value when the user prefers
 * reduced motion or during SSR. Duration is in milliseconds.
 */
export function useCountUp(target: number, duration = 700): number {
	const [display, setDisplay] = useState(target);
	const fromRef = useRef(target);
	const frameRef = useRef(0);

	useEffect(() => {
		const reduceMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (reduceMotion || !Number.isFinite(target)) {
			setDisplay(target);
			return;
		}

		const from = fromRef.current;
		const startTime = performance.now();

		const tick = (now: number) => {
			const progress = Math.min(1, (now - startTime) / duration);
			const value = from + (target - from) * easeOut(progress);
			setDisplay(value);
			if (progress < 1) {
				frameRef.current = requestAnimationFrame(tick);
			} else {
				fromRef.current = target;
			}
		};

		frameRef.current = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frameRef.current);
	}, [target, duration]);

	return display;
}
