import { useState } from "react";
import { ChevronDown, ChevronRight, LayoutPanelTop, Plus } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOptionalActiveSite } from "@/hooks/useActiveSite";
import { useLinkedTemplates, type LinkedTemplate } from "@/hooks/use-template-parts";
import { templateRootLabel } from "@/lib/template-parts/template-part-labels";
import {
	NPB_TEMPLATE_LIST_NAME_MAX_CHARS,
	truncateWithEllipsis,
} from "@/lib/truncate-with-ellipsis";
import { useTemplatePartActions } from "./blocks/template-part/template-part-actions";

/**
 * The "Templates" group of the block library: this site's linked templates. Adding one puts a
 * template part on the page, which keeps following that template. Renders nothing until a site is
 * active, because the list is per site.
 */
export function TemplatePartLibrary() {
	const [isOpen, setIsOpen] = useState(false);
	const siteId = useOptionalActiveSite()?.activeSiteId ?? null;
	const partActions = useTemplatePartActions();
	const query = useLinkedTemplates({ siteId, enabled: isOpen });

	if (!siteId) return null;
	const templates = query.data?.templates ?? [];

	const handleInsert = (template: LinkedTemplate) => {
		partActions?.insertTemplatePart(template.id);
	};

	return (
		<div className="mt-4 rounded-[var(--npb-radius-surface)] bg-npb-surface-raised">
			<Collapsible open={isOpen} onOpenChange={setIsOpen}>
				<CollapsibleTrigger asChild>
					<Button
						variant="ghost"
						className="w-full justify-between p-4 h-auto font-semibold text-sm text-npb-text-primary hover:text-npb-text-primary hover:bg-npb-interactive-bg-hover"
					>
						<span className="flex items-center gap-2">
							<LayoutPanelTop className="w-4 h-4" />
							Templates
						</span>
						{isOpen ? (
							<ChevronDown className="w-4 h-4 text-npb-text-muted" />
						) : (
							<ChevronRight className="w-4 h-4 text-npb-text-muted" />
						)}
					</Button>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<div className="px-4 pb-4">
						{query.isPending ? (
							<p className="text-xs text-npb-text-muted text-center py-4">Loading templates...</p>
						) : query.isError ? (
							<div className="space-y-2 px-1 py-4 text-center">
								<p className="text-xs text-npb-text-muted">Templates could not be loaded.</p>
								<Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
									Try again
								</Button>
							</div>
						) : templates.length === 0 ? (
							<div className="space-y-2 px-1 py-4 text-center">
								<p className="text-xs text-npb-text-muted">No templates yet.</p>
								<a
									href="/admin/templates"
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1 text-xs font-medium text-npb-accent hover:underline"
								>
									<Plus className="h-3 w-3" aria-hidden />
									Make a template
								</a>
							</div>
						) : (
							<ScrollArea className="max-h-64">
								<div className="space-y-1.5 pr-2">
									{templates.map((template) => {
										const nameDisplay = truncateWithEllipsis({
											text: template.name,
											maxChars: NPB_TEMPLATE_LIST_NAME_MAX_CHARS,
										});
										return (
											<button
												key={template.id}
												type="button"
												onClick={() => handleInsert(template)}
												disabled={!partActions}
												className="w-full text-left px-3 py-2.5 rounded-md hover:bg-npb-interactive-bg-hover transition-colors group disabled:opacity-40 disabled:cursor-not-allowed"
											>
												<div className="flex items-center justify-between">
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-2">
															<span className="text-sm font-medium text-npb-text-primary min-w-0 shrink" title={template.name}>
																{nameDisplay}
															</span>
															<Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
																{templateRootLabel(template.blocks)}
															</Badge>
														</div>
														<p className="text-xs text-npb-text-muted mt-0.5">Stays linked to this template</p>
													</div>
													<Plus className="w-4 h-4 text-npb-text-muted opacity-0 group-hover:opacity-100 shrink-0 ml-2" aria-hidden />
												</div>
											</button>
										);
									})}
								</div>
							</ScrollArea>
						)}
					</div>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}
