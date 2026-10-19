/**
 * Every block name NextPress knows. The one list: the editor, the server's save
 * check and the SDK all read it, so a block added here shows up everywhere.
 */
export const BLOCK_NAMES = [
	"core/heading",
	"core/paragraph",
	"core/button",
	"core/buttons",
	"core/image",
	"core/gallery",
	"core/video",
	"core/audio",
	"core/spacer",
	"core/separator",
	"core/columns",
	"core/container",
	"core/group",
	"core/stack",
	"core/page-shell",
	"core/header",
	"core/accordion",
	"core/accordion-item",
	"core/popup",
	"core/form",
	"core/quote",
	"core/list",
	"core/media-text",
	"core/cover",
	"core/file",
	"core/code",
	"core/html",
	"core/pullquote",
	"core/preformatted",
	"core/table",
	"core/markdown",
	"core/icon",
	"core/divider",
	"core/input",
	"core/textarea",
	"core/select",
	"core/template-part",
	"post/title",
	"post/excerpt",
	"post/featured-image",
	"post/list",
	"post/toc",
	"post/author-box",
	"post/comments",
	"post/navigation",
	"post/info",
	"post/progress",
] as const;

export type BlockName = (typeof BLOCK_NAMES)[number];

const NAME_SET = new Set<string>(BLOCK_NAMES);

export const isBlockName = (name: string): name is BlockName => NAME_SET.has(name);
