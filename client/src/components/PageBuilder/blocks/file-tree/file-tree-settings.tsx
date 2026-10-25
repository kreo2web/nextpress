import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { FolderTree } from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_FILE_TREE_CONTENT, MAX_FILE_TREE_LINES, readFileTreeContent, type FileTreeContent } from "@shared/blocks/file-tree-model";
import { SettingsLabel } from "../../shared";
import { useSettingsState } from "../useSettingsState";

type FileTreeSettingsProps = {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
};

/** File tree settings: the tree as text, one line per file or folder. */
export function FileTreeSettings({ block, onUpdate }: FileTreeSettingsProps) {
	const { content, updateContent } = useSettingsState<FileTreeContent>({
		block,
		onUpdate,
		defaultContent: DEFAULT_FILE_TREE_CONTENT,
		parseContent: (raw) => readFileTreeContent(raw),
	});

	return (
		<div className="space-y-4">
			<CollapsibleCard title="Files" icon={FolderTree} defaultOpen>
				<div className="space-y-2">
					<SettingsLabel htmlFor="file-tree-text">Tree</SettingsLabel>
					<Textarea
						id="file-tree-text"
						value={content.tree}
						rows={10}
						spellCheck={false}
						aria-describedby="file-tree-hint"
						className="font-mono text-xs"
						onChange={(event) => updateContent({ tree: event.target.value })}
					/>
					<p id="file-tree-hint" className="npb-settings-hint-muted text-xs">
						One line per file. Indent two spaces to go inside a folder. End a folder with /, add * to highlight a line, and # to add a note. Up to {MAX_FILE_TREE_LINES} lines.
					</p>
				</div>
			</CollapsibleCard>
		</div>
	);
}
