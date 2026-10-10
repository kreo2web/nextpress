import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { WhatsNewDialog, type ReleaseResponse } from "@/components/admin/WhatsNewDialog";
import {
	CoreUpdateDialog,
	describeUpdateNotice,
	useCoreUpdateDialogOpen,
	useCoreUpdateResume,
	useCoreUpdateStatus,
} from "@/components/core-update";
import { NEXTPRESS_CONFIG } from "../../../../config";
import { cn } from "@/lib/utils";

/**
 * Sidebar notice with an orange beacon. Main-site admins see updates here ("Update available", "Updating…",
 * "Update didn't finish") and open the update dialog; everyone else sees What's New. Also hosts the one update
 * dialog for the whole admin, and opens What's New by itself after an update finishes.
 * Stays visible after click — only the dialogs open and close.
 */
export function WhatsNewSidebarBanner() {
	const [whatsNewOpen, setWhatsNewOpen] = useState(false);
	const [updateOpen, setUpdateOpen] = useCoreUpdateDialogOpen();
	const { data: release } = useQuery<ReleaseResponse>({
		queryKey: ["/api/system/release"],
	});
	const updateStatus = useCoreUpdateStatus();
	const notice = updateStatus ? describeUpdateNotice(updateStatus) : null;

	const openWhatsNew = useCallback(() => setWhatsNewOpen(true), []);
	const reopenUpdate = useCallback(() => setUpdateOpen(true), [setUpdateOpen]);
	useCoreUpdateResume({ status: updateStatus, onUpdated: openWhatsNew, onReopen: reopenUpdate });

	const installedVersion = release?.installedVersion ?? NEXTPRESS_CONFIG.version;

	return (
		<>
			<button
				type="button"
				onClick={() => (notice ? setUpdateOpen(true) : setWhatsNewOpen(true))}
				className={cn(
					"np-sidebar-attention-banner mx-3 mb-2 flex w-[calc(100%-1.5rem)] items-start gap-2 rounded border px-2 py-2 text-left text-[11px] leading-tight transition-colors hover:bg-white/10",
					notice
						? "np-sidebar-attention-banner--update border-orange-500/50 bg-orange-500/10 text-orange-50"
						: "border-orange-500/30 bg-white/5 text-zinc-200",
				)}
			>
				<span
					className={cn("np-sidebar-attention-dot mt-1 shrink-0", notice && "np-sidebar-attention-dot--urgent")}
					aria-hidden
				/>
				<span className="min-w-0">
					{notice ? (
						<>
							<span className="block font-semibold text-orange-100">{notice.label}</span>
							<span className="mt-0.5 block text-[10px] text-orange-200/80">{notice.hint}</span>
						</>
					) : (
						<>
							<span className="block font-medium text-zinc-100">What&apos;s new</span>
							<span className="mt-0.5 block text-[10px] text-zinc-400">v{installedVersion} changes</span>
						</>
					)}
				</span>
			</button>

			<WhatsNewDialog open={whatsNewOpen} onOpenChange={setWhatsNewOpen} release={release} />
			{updateStatus ? (
				<CoreUpdateDialog open={updateOpen} onOpenChange={setUpdateOpen} status={updateStatus} />
			) : null}
		</>
	);
}
