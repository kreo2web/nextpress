import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { FileCode2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Switch } from "@/components/ui/switch";
import { readCodeGroupContent, type CodeGroupContent } from "@shared/blocks/code-group-model";
import { readCodeGroupTabs } from "@shared/markdown/components/code-group-tabs";
import { useSettingsState } from "../useSettingsState";
import { buildGroupCode } from "./code-group-factory";

type CodeGroupSettingsProps = {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
};

/** Code group settings: remembering the reader's choice and adding a code tab. Each tab is named by its code block's title. */
export function CodeGroupSettings({ block, onUpdate }: CodeGroupSettingsProps) {
	const { content, updateContent } = useSettingsState<CodeGroupContent>({ block, onUpdate, parseContent: readCodeGroupContent });
	const { codes } = readCodeGroupTabs(block.children ?? []);

	const addCode = () => {
		const code = buildGroupCode({ parentId: block.id, title: `Tab ${codes.length + 1}` });
		if (code) onUpdate?.({ children: [...(block.children ?? []), code] });
	};

	return (
		<div className="space-y-4">
			<CollapsibleCard title="Code group" icon={FileCode2} defaultOpen>
				<div className="space-y-4">
					<div className="flex items-center justify-between gap-3">
						<p className="text-sm text-npb-text-secondary">
							{codes.length} {codes.length === 1 ? "code block" : "code blocks"}
						</p>
						<Button type="button" variant="outline" size="sm" onClick={addCode} className="gap-1">
							<Plus className="h-3.5 w-3.5" aria-hidden />
							Add code
						</Button>
					</div>
					<div className="flex items-center justify-between gap-3">
						<div className="min-w-0">
							<label htmlFor={`code-group-remember-${block.id}`} className="text-sm font-medium">
								Remember the reader's choice
							</label>
							<p className="npb-settings-hint-muted text-xs">
								A reader who picks pnpm sees pnpm in every code group with the same tabs, on later pages too.
							</p>
						</div>
						<Switch
							id={`code-group-remember-${block.id}`}
							checked={content.remember}
							onCheckedChange={(checked) => updateContent({ remember: checked })}
						/>
					</div>
					<p className="npb-settings-hint-muted text-xs">
						Each tab is named by its code block's title (or its language when it has no title). Click a tab on the canvas, then set the title in that code block's settings.
					</p>
				</div>
			</CollapsibleCard>
		</div>
	);
}
