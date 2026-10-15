import { useEffect, useState } from "react";

export type HeadingEntry = {
	id: string;
	text: string;
	level: number;
};

/** Build a heading selector string like "h1, h2, h3" up to maxDepth. */
function buildHeadingSelector(maxDepth: number): string {
	return Array.from({ length: maxDepth }, (_, i) => `h${i + 1}`).join(", ");
}

/**
 * Scan the page DOM for heading elements and return structured entries.
 * Filters to the given maxDepth and derives anchor IDs from the element id
 * or text content.
 */
export function collectPageHeadings(maxDepth: number): HeadingEntry[] {
	const selector = buildHeadingSelector(maxDepth);
	const nodes = document.querySelectorAll(selector);
	const entries: HeadingEntry[] = [];

	nodes.forEach((node) => {
		const text = (node.textContent || "").trim();
		if (!text) return;

		const level = Number.parseInt(node.tagName.charAt(1), 10);
		const id =
			node.id ||
			text
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/(^-|-$)/g, "");

		entries.push({ id, text, level });
	});

	return entries;
}

function useMountEffect(effect: () => void | (() => void)) {
	/* eslint-disable react-hooks/exhaustive-deps, no-restricted-syntax */
	useEffect(effect, []);
}

/**
 * After paint, scan the document for headings up to maxDepth.
 * Mounts once — remount the caller when maxDepth changes (`key={maxDepth}`).
 */
export function usePageHeadings(maxDepth: number): HeadingEntry[] {
	const [headings, setHeadings] = useState<HeadingEntry[]>([]);

	useMountEffect(() => {
		setHeadings(collectPageHeadings(maxDepth));
	});

	return headings;
}
