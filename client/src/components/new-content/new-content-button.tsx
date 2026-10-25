import { useState, type JSX } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NewContentFlow } from "./new-content-flow";

type NewContentButtonProps = {
	/** `chrome` sits in the always-dark admin top bar; `header` is the page header's main action. */
	variant: "chrome" | "header";
};

const VARIANT_CLASS: Record<NewContentButtonProps["variant"], string> = {
	chrome: "h-6 gap-1 rounded-md bg-white px-2.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-200 md:h-6",
	header: "npb-btn-accent",
};

/** The one "New" button: it opens "What are you making?" and carries on from there. */
export function NewContentButton({ variant }: NewContentButtonProps): JSX.Element {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button type="button" aria-haspopup="dialog" className={cn(VARIANT_CLASS[variant])} onClick={() => setOpen(true)}>
				<Plus aria-hidden className={variant === "chrome" ? "size-3.5" : undefined} />
				New
			</Button>
			{open ? <NewContentFlow onClose={() => setOpen(false)} /> : null}
		</>
	);
}
