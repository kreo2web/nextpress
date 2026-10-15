import { useState } from "react";
import { ExternalLink, RefreshCw, Unlink } from "lucide-react";
import type { BlockConfig } from "@shared/schema-types";
import type { TemplatePartContent } from "@shared/template-parts";
import { readTemplatePartSiteId } from "@shared/template-usage";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOptionalActiveSite } from "@/hooks/useActiveSite";
import { readRequestStatus, useLinkedTemplates, usePartTemplate } from "@/hooks/use-template-parts";
import { readTemplateBlocks } from "@/lib/template-parts/read-template-blocks";
import { templateEditorPath } from "@/lib/template-parts/template-part-labels";
import { SettingsLabel, SettingsSection } from "../../shared";
import { useSettingsState } from "../useSettingsState";
import { useTemplatePartActions } from "./template-part-actions";
import { TemplatePartDetachDialog } from "./template-part-detach-dialog";

type TemplatePartSettingsProps = {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
};

const DEFAULT_CONTENT: TemplatePartContent = { templateId: "" };

/**
 * The Content tab of a template part: which linked template it shows, plus Edit and Detach for that
 * template. The list is this site's linked templates only.
 */
export function TemplatePartSettings({ block, onUpdate }: TemplatePartSettingsProps) {
	const { content, updateContent } = useSettingsState<TemplatePartContent>({
		block,
		onUpdate,
		defaultContent: DEFAULT_CONTENT,
	});
	const templateId = content?.templateId ?? "";
	const siteId = useOptionalActiveSite()?.activeSiteId ?? null;
	const partActions = useTemplatePartActions();
	const [detachOpen, setDetachOpen] = useState(false);

	const linked = useLinkedTemplates({ siteId });
	const chosen = usePartTemplate({ templateId });
	const templates = linked.data?.templates ?? [];
	const chosenTemplate = chosen.data;
	const chosenWasDeleted = Boolean(templateId) && chosen.isError && readRequestStatus(chosen.error) === 404;
	const chosenBelongsElsewhere =
		Boolean(chosenTemplate && siteId) &&
		readTemplatePartSiteId(chosenTemplate?.other) !== null &&
		readTemplatePartSiteId(chosenTemplate?.other) !== siteId;
	const canDetach = partActions !== null && Boolean(chosenTemplate) && !chosenBelongsElsewhere;

	return (
		<SettingsSection>
			<div>
				<SettingsLabel htmlFor="template-part-select">Template</SettingsLabel>
				<Select
					value={templateId || undefined}
					onValueChange={(next) => updateContent({ templateId: next })}
					disabled={!siteId}
				>
					<SelectTrigger id="template-part-select" className="h-9">
						<SelectValue placeholder={siteId ? "Choose a template" : "Pick a site first"} />
					</SelectTrigger>
					<SelectContent>
						{templates.map((template) => (
							<SelectItem key={template.id} value={template.id}>
								{template.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<p className="npb-settings-hint-muted mt-2 text-xs">
					Changes to this template show on every page that uses it.
				</p>
			</div>

			{linked.isError ? (
				<div className="flex flex-wrap items-center gap-2">
					<p className="npb-settings-hint text-xs">The list of templates could not be loaded.</p>
					<Button type="button" variant="outline" size="sm" onClick={() => void linked.refetch()}>
						<RefreshCw className="h-3.5 w-3.5" aria-hidden />
						Try again
					</Button>
				</div>
			) : null}
			{siteId && linked.isSuccess && templates.length === 0 ? (
				<p className="npb-settings-hint-muted text-xs">
					This site has no templates yet.{" "}
					<a href="/admin/templates" target="_blank" rel="noopener noreferrer" className="text-npb-accent hover:underline">
						Make one
					</a>{" "}
					to use here.
				</p>
			) : null}
			{chosenWasDeleted ? (
				<p className="npb-settings-hint text-xs">
					This template was deleted. Pick another one above, or remove the block from the page.
				</p>
			) : null}
			{chosenBelongsElsewhere ? (
				<p className="npb-settings-hint text-xs">
					This template belongs to another site, so it is not shown on this page. Pick one from this site.
				</p>
			) : null}

			{chosenTemplate && !chosenBelongsElsewhere ? (
				<div className="flex flex-wrap gap-2">
					<Button asChild variant="outline" size="sm">
						<a href={templateEditorPath(chosenTemplate.id)} target="_blank" rel="noopener noreferrer">
							<ExternalLink className="h-3.5 w-3.5" aria-hidden />
							Edit template
						</a>
					</Button>
					{canDetach ? (
						<Button type="button" variant="outline" size="sm" onClick={() => setDetachOpen(true)}>
							<Unlink className="h-3.5 w-3.5" aria-hidden />
							Detach
						</Button>
					) : null}
				</div>
			) : null}

			{chosenTemplate && canDetach ? (
				<TemplatePartDetachDialog
					open={detachOpen}
					onOpenChange={setDetachOpen}
					blockId={block.id}
					parentId={block.parentId}
					templateName={chosenTemplate.name}
					templateBlocks={readTemplateBlocks(chosenTemplate.blocks)}
				/>
			) : null}
		</SettingsSection>
	);
}
