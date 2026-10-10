import { useState, type ReactNode } from "react";
import { ExternalLink, LayoutPanelTop, RefreshCw, Trash2, Unlink } from "lucide-react";
import { MAX_TEMPLATE_PART_DEPTH, unwrapPageShells } from "@shared/template-parts";
import { readTemplatePartSiteId } from "@shared/template-usage";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOptionalActiveSite } from "@/hooks/useActiveSite";
import { readRequestStatus, usePartTemplate } from "@/hooks/use-template-parts";
import { readTemplateBlocks } from "@/lib/template-parts/read-template-blocks";
import { templateEditorPath, templateRootLabel } from "@/lib/template-parts/template-part-labels";
import BlockRenderer from "../../BlockRenderer";
import { useBlockActions } from "../../BlockActionsContext";
import { useTemplatePartActions } from "./template-part-actions";
import { TemplatePartChainProvider, useTemplatePartChain } from "./template-part-chain";
import { TemplatePartDetachDialog } from "./template-part-detach-dialog";

type TemplatePartFrameProps = {
	blockId: string;
	parentId: string | null;
	templateId: string;
	/** True for a part shown inside another template. Those parts are read-only and cannot be detached here. */
	isPreview: boolean;
};

const noop = () => undefined;

/** A short plain note in place of the template: the reason, and at most one action. */
function FrameNotice({ children, action }: { children: ReactNode; action?: ReactNode }) {
	return (
		<div
			role="status"
			className="flex flex-wrap items-center gap-3 rounded-[var(--npb-radius-surface)] border border-dashed border-npb-border-strong bg-npb-surface-raised px-4 py-3"
		>
			<LayoutPanelTop className="h-4 w-4 shrink-0 text-npb-text-muted" aria-hidden />
			<p className="min-w-0 flex-1 text-sm text-npb-text-secondary">{children}</p>
			{action}
		</div>
	);
}

/**
 * The canvas view of a linked template part. The template's blocks show read-only inside a frame
 * with its name, an Edit template link (new tab, so the page keeps its unsaved changes) and Detach.
 * A part whose template cannot be shown says why, in plain words, and offers a way out.
 */
export function TemplatePartFrame({ blockId, parentId, templateId, isPreview }: TemplatePartFrameProps) {
	const chain = useTemplatePartChain();
	const activeSiteId = useOptionalActiveSite()?.activeSiteId ?? null;
	const blockActions = useBlockActions();
	const partActions = useTemplatePartActions();
	const [detachOpen, setDetachOpen] = useState(false);

	const isLooping = chain.includes(templateId);
	const isTooDeep = chain.length >= MAX_TEMPLATE_PART_DEPTH;
	const query = usePartTemplate({ templateId, enabled: Boolean(templateId) && !isLooping && !isTooDeep });

	const removeAction =
		!isPreview && blockActions ? (
			<Button type="button" variant="outline" size="sm" onClick={() => blockActions.onDelete(blockId)}>
				<Trash2 className="h-3.5 w-3.5" aria-hidden />
				Remove block
			</Button>
		) : null;

	if (!templateId) {
		return <FrameNotice>No template chosen yet. Choose one in the block settings.</FrameNotice>;
	}
	if (isLooping) {
		return <FrameNotice>This template is already shown above, so it is not repeated here.</FrameNotice>;
	}
	if (isTooDeep) {
		return <FrameNotice>This template is nested too deeply to show here.</FrameNotice>;
	}
	if (query.isPending) {
		return (
			<div className="space-y-2 rounded-[var(--npb-radius-surface)] border border-npb-border-default p-4" aria-label="Loading template">
				<Skeleton className="h-4 w-1/3" />
				<Skeleton className="h-3 w-full" />
				<Skeleton className="h-3 w-5/6" />
			</div>
		);
	}
	if (query.isError) {
		if (readRequestStatus(query.error) === 404) {
			return (
				<FrameNotice action={removeAction}>
					This template was deleted. Remove this block, or pick another template in the block settings.
				</FrameNotice>
			);
		}
		return (
			<FrameNotice
				action={
					<Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
						<RefreshCw className="h-3.5 w-3.5" aria-hidden />
						Try again
					</Button>
				}
			>
				This template could not be loaded. Try again.
			</FrameNotice>
		);
	}
	const template = query.data;
	if (!template) return null;

	const ownerSiteId = readTemplatePartSiteId(template.other);
	if (activeSiteId && ownerSiteId && ownerSiteId !== activeSiteId) {
		return (
			<FrameNotice action={removeAction}>
				This template belongs to another site, so it is not shown on this page.
			</FrameNotice>
		);
	}

	const content = unwrapPageShells(readTemplateBlocks(template.blocks));
	const canDetach = !isPreview && partActions !== null;

	return (
		<TemplatePartChainProvider templateId={templateId}>
			<section
				data-testid="template-part"
				aria-label={`Template: ${template.name}`}
				className="relative overflow-hidden rounded-[var(--npb-radius-surface)] border border-dashed border-npb-border-strong bg-npb-surface-raised"
			>
				<header className="flex flex-wrap items-center gap-2 border-b border-npb-divider bg-npb-surface-header px-3 py-2">
					<LayoutPanelTop className="h-4 w-4 shrink-0 text-npb-text-muted" aria-hidden />
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium text-npb-text-primary" title={template.name}>
							{template.name}
						</p>
						<p className="text-xs text-npb-text-muted">
							Linked template · {templateRootLabel(template.blocks)}
						</p>
					</div>
					<Button asChild variant="ghost" size="sm" className="h-8 px-2">
						<a href={templateEditorPath(template.id)} target="_blank" rel="noopener noreferrer">
							<ExternalLink className="h-3.5 w-3.5" aria-hidden />
							Edit template
						</a>
					</Button>
					{canDetach ? (
						<Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => setDetachOpen(true)}>
							<Unlink className="h-3.5 w-3.5" aria-hidden />
							Detach
						</Button>
					) : null}
				</header>

				<div className="pointer-events-none select-none p-3">
					{content.length === 0 ? (
						<p className="py-4 text-center text-xs text-npb-text-muted">This template has no blocks yet.</p>
					) : (
						content.map((child) => (
							<BlockRenderer
								key={child.id}
								block={child}
								isSelected={false}
								isPreview
								onDuplicate={noop}
								onDelete={noop}
							/>
						))
					)}
				</div>

				{canDetach ? (
					<TemplatePartDetachDialog
						open={detachOpen}
						onOpenChange={setDetachOpen}
						blockId={blockId}
						parentId={parentId}
						templateName={template.name}
						templateBlocks={content}
					/>
				) : null}
			</section>
		</TemplatePartChainProvider>
	);
}
