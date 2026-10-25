import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { Type } from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_DOCS_TEXT_CONTENT, readDocsTextContent, type DocsTextContent } from "@shared/blocks/docs-text-model";
import { SettingsLabel } from "../../shared";
import { useSettingsState } from "../useSettingsState";

type DocsTextSettingsProps = {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
};

/** Text settings: the paragraph's words, with bold, italic, code and links written as markdown. */
export function DocsTextSettings({ block, onUpdate }: DocsTextSettingsProps) {
	const { content, updateContent } = useSettingsState<DocsTextContent>({
		block,
		onUpdate,
		defaultContent: DEFAULT_DOCS_TEXT_CONTENT,
		parseContent: (raw) => readDocsTextContent(raw),
	});

	return (
		<div className="space-y-4">
			<CollapsibleCard title="Text" icon={Type} defaultOpen>
				<div className="space-y-2">
					<SettingsLabel htmlFor="docs-text-content">Text</SettingsLabel>
					<Textarea id="docs-text-content" className="h-36" value={content.text} onChange={(event) => updateContent({ text: event.target.value })} />
					<p className="text-xs text-npb-text-muted">**bold**, *italic*, `code` and [label](address) work here.</p>
				</div>
			</CollapsibleCard>
		</div>
	);
}
