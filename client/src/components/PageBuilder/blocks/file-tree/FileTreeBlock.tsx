import React from "react";
import { FolderTree } from "lucide-react";
import { DEFAULT_FILE_TREE_CONTENT, readFileTreeContent, type FileTreeContent } from "@shared/blocks/file-tree-model";
import { FileTreeView } from "@shared/blocks/file-tree-view";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { FileTreeSettings } from "./file-tree-settings";

/** Canvas view: the same `FileTreeView` as the page. The tree is edited in the settings panel. */
const FileTreeBlock = createBlockDefinition<FileTreeContent>({
	...catalogMeta("docs/file-tree"),
	icon: FolderTree,
	defaultContent: DEFAULT_FILE_TREE_CONTENT,
	parseContent: (raw) => readFileTreeContent(raw),
	settings: FileTreeSettings,
	hasSettings: true,
	render: ({ content, styles }) => (
		<div className="wp-block-file-tree" style={styles}>
			<FileTreeView tree={content.tree} />
		</div>
	),
});

export default FileTreeBlock;
