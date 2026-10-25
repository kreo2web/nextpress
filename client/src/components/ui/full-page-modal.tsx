import type { JSX, ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type FullPageModalProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	/** Said to screen readers only; the title already tells everyone else what this is. */
	description: string;
	/** An icon for the tile before the title. */
	icon: ReactNode;
	/** While true, Esc, the backdrop and the close button leave the modal open (a save is running). */
	locked?: boolean;
	/** The bottom band: step text on the left, buttons on the right. */
	footer: ReactNode;
	/** Classes for the body between the header and footer. It scrolls by default. */
	bodyClassName?: string;
	children: ReactNode;
};

/**
 * The popup for making or changing something that needs room: it fills the window, with a header
 * band (icon, title, close), a body that scrolls on its own, and a footer band for the actions.
 * Small confirms stay in a Dialog or an AlertDialog.
 */
export function FullPageModal({
	open,
	onOpenChange,
	title,
	description,
	icon,
	locked = false,
	footer,
	bodyClassName,
	children,
}: FullPageModalProps): JSX.Element {
	const keepOpen = (event: Event): void => {
		if (locked) event.preventDefault();
	};

	return (
		<Dialog open={open} onOpenChange={(next) => !locked && onOpenChange(next)}>
			{open ? (
				<DialogContent
					showCloseButton={false}
					onEscapeKeyDown={keepOpen}
					onInteractOutside={keepOpen}
					className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-npb-surface-base p-0 sm:max-w-none data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100"
				>
					<header className="flex h-14 shrink-0 items-center gap-3 border-b border-npb-divider px-4 sm:h-16 sm:px-6">
						<span
							aria-hidden
							className="flex size-8 shrink-0 items-center justify-center rounded-md bg-npb-surface-inset text-npb-text-primary sm:size-9"
						>
							{icon}
						</span>
						<DialogTitle className="min-w-0 flex-1 truncate text-base font-semibold text-npb-text-primary sm:text-lg">
							{title}
						</DialogTitle>
						<DialogClose asChild>
							<Button type="button" variant="ghost" size="icon" aria-label="Close" disabled={locked}>
								<X aria-hidden />
							</Button>
						</DialogClose>
					</header>
					<DialogDescription className="sr-only">{description}</DialogDescription>
					<div className={cn("min-h-0 flex-1 overflow-y-auto", bodyClassName)}>{children}</div>
					<footer className="shrink-0 border-t border-npb-divider bg-npb-surface-raised px-4 py-3 sm:px-6">{footer}</footer>
				</DialogContent>
			) : null}
		</Dialog>
	);
}
