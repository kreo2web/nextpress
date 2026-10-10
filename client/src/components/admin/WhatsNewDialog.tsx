import { ScrollText } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NEXTPRESS_CONFIG } from "../../../../config";
import { WhatsNewHighlightItem } from "@/components/admin/WhatsNewHighlightItem";
import type { ReleaseHighlight } from "@shared/release/release-highlight-meta";

export type ReleaseResponse = {
	installedVersion: string;
	latestVersion: string;
	updateAvailable: boolean;
	releaseDate: string;
	highlights: ReleaseHighlight[];
	supportedUpgradeFrom: string[];
	updateCheck?: {
		source: string;
		ok: boolean;
		note: string;
		checkedAt?: string;
	};
};

type WhatsNewDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	release: ReleaseResponse | undefined;
};

/**
 * Release notes for the version this server runs. Updating lives in the update dialog (sidebar notice and
 * dashboard), which opens this one by itself once an update has finished.
 */
export function WhatsNewDialog({ open, onOpenChange, release }: WhatsNewDialogProps) {
	const installedVersion = release?.installedVersion ?? NEXTPRESS_CONFIG.version;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-xl">
						<ScrollText className="h-5 w-5 text-npb-accent" aria-hidden />
						What&apos;s new in v{installedVersion}
					</DialogTitle>
					{release?.releaseDate ? (
						<DialogDescription>Released {release.releaseDate}</DialogDescription>
					) : null}
				</DialogHeader>

				<div className="max-h-[60vh] overflow-y-auto">
					<ul className="space-y-3">
						{release?.highlights?.map((item) => (
							<WhatsNewHighlightItem key={item.title} item={item} />
						))}
					</ul>
				</div>

				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
