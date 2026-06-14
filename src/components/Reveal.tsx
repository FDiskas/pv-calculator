import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";

interface RevealProps {
	children: ReactNode;
	className?: string;
	/** Stagger delay in milliseconds before the element animates in. */
	delay?: number;
	as?: "div" | "section" | "li";
}

/**
 * Reveals its children with a fade-and-rise transition the first time
 * they scroll into view. Server and first client render emit identical
 * markup (the hidden `.reveal` class) to avoid hydration mismatches;
 * the IntersectionObserver then adds `.is-visible`. The reduced-motion
 * media query in CSS neutralises the transform for users who opt out.
 */
export default function Reveal({
	children,
	className,
	delay = 0,
	as = "div",
}: RevealProps) {
	const ref = useRef<HTMLElement>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const node = ref.current;
		if (!node) {
			return;
		}

		if (typeof IntersectionObserver === "undefined") {
			setVisible(true);
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					setVisible(true);
					observer.disconnect();
				}
			},
			{ threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
		);

		observer.observe(node);
		return () => observer.disconnect();
	}, []);

	const Tag = as;

	return (
		<Tag
			// biome-ignore lint/suspicious/noExplicitAny: single ref shared across allowed tags
			ref={ref as any}
			className={cn("reveal", visible && "is-visible", className)}
			style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
		>
			{children}
		</Tag>
	);
}
