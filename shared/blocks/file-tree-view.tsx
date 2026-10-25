import type { JSX } from "react";
import { parseFileTree, type FileTreeEntry } from "./file-tree-model.js";

/** Lucide icon paths (ISC), inlined so shared code needs no icon package. */
const FOLDER_PATH = "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z";
const FILE_PATHS = ["M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", "M14 2v4a2 2 0 0 0 2 2h4"];

const EntryIcon = ({ kind }: { kind: FileTreeEntry["kind"] }): JSX.Element => (
	<svg className="np-file-tree-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		{kind === "folder" ? <path d={FOLDER_PATH} /> : FILE_PATHS.map((path) => <path key={path} d={path} />)}
	</svg>
);

function EntryList({ entries }: { entries: FileTreeEntry[] }): JSX.Element {
	return (
		<ul className="np-file-tree-list">
			{entries.map((entry, index) => (
				<li key={`${entry.name}-${index}`} className="np-file-tree-item" data-kind={entry.kind} data-highlight={entry.highlight ? "" : undefined}>
					<span className="np-file-tree-row">
						<EntryIcon kind={entry.kind} />
						{entry.kind === "folder" ? <span className="np-visually-hidden">Folder: </span> : null}
						<span className="np-file-tree-name">{entry.name}</span>
						{entry.highlight ? <span className="np-visually-hidden"> (highlighted)</span> : null}
						{entry.note ? <span className="np-file-tree-note">{entry.note}</span> : null}
					</span>
					{entry.children.length > 0 ? <EntryList entries={entry.children} /> : null}
				</li>
			))}
		</ul>
	);
}

/**
 * A folder and file tree drawn from the block's text (or an MDX `<FileTree>` list turned into the
 * same text). A plain nested list underneath, so a screen reader hears the nesting; the icons are
 * decoration and "Folder" is spoken instead. Pure: the published page, the editor and MDX share it.
 */
export function FileTreeView({ tree }: { tree: string }): JSX.Element {
	const entries = parseFileTree(tree);
	return <div className="np-file-tree">{entries.length > 0 ? <EntryList entries={entries} /> : null}</div>;
}
