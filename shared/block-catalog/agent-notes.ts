import type { BlockName } from "./block-names.js";

/**
 * How an agent should use each block: what it is for, what it is not for, and
 * the one or two fields that matter. The MCP server and the in-editor assistant
 * show these next to the catalog, so a wrong note means wrong pages. Keep each
 * note short and checked against the block's real content shape.
 */
export const BLOCK_AGENT_NOTES: Record<BlockName, string> = {
	"core/page-shell":
		"The page itself: exactly one, at the root, and every other block sits inside it. Page font, content width (`containerWidth`), side and top/bottom padding (`paddingInline`, `paddingBlock`) and page background live here, not on sections.",
	"core/header":
		"The site header: brand (logo or name), links and buttons. Put it first inside the page shell. `variant` picks the layout; `brand-and-blocks` takes child blocks on the right instead of built-in links. `overFirstSection` floats it over a hero, `sticky` keeps it on screen while scrolling.",
	"core/stack":
		"The default section container. `stackType` is `vertical` (blocks under each other), `horizontal` (a row) or `overlay` (children layered in one spot, first child at the back — for a hero with text over an image). Spacing between children is `styles.gap`.",
	"core/group":
		"A plain layout container (flex column with a gap by default). Use it to keep related blocks together, or as a row/grid with `styles.display`, `flexDirection`, `gridTemplateColumns`. `tagName` sets the HTML tag (`section`, `div`, …).",
	"core/container":
		"A box with background, padding, rounded corners and a max width. Use for cards and boxed sections. For plain grouping use Group or Stack instead.",
	"core/columns":
		"Side-by-side columns that fold under each other on phones. Children are the column contents; `settings.columnLayout` assigns them to columns. Use for 2–4 equal or weighted columns; for card grids a Group with `display: grid` is simpler.",
	"core/accordion":
		"Questions or sections that open and close (FAQ). Children must be Accordion item blocks. `faqSchema` adds FAQ data for search engines — turn it on for at most one accordion per page.",
	"core/accordion-item":
		"One question inside an Accordion: `title` is the question, its children are the answer (any blocks). Only use inside an Accordion.",
	"core/popup":
		"A window over the page. It stays hidden until a link points at `#popup-<slug>` (a button's `url`, a header button's `href`). Keep `slug` unique on the page (`a-z`, `0-9`, `-`). Children are anything, a form included.",
	"core/form":
		"A form whose answers appear in Admin → Forms. Children are fields (Text field, Text area, Dropdown) and one Button with `action: \"submit\"`. Every field needs a `name` and a visible `label`.",
	"core/input":
		"A one-line form field (`type`: text, email, number, tel, url, search, password). Needs `name` and `label`; `required` for must-fill fields. Only inside a Form.",
	"core/textarea":
		"A multi-line form field for messages. Needs `name` and `label`. Only inside a Form.",
	"core/select":
		"A dropdown form field. `options` (`label`, `value`) are the choices; the answer is saved as the chosen option's visible text. Only inside a Form.",
	"core/template-part":
		"Shows a linked template (a shared header, footer or section), so one edit reaches every page. Only use with a template id that exists on this site; never invent one.",
	"core/heading":
		"A title. `value` is the text, `level` 1–6. One level-1 heading per page (the main title); sections use level 2, points inside them level 3. Alignment goes in `styles.textAlign`, never in content.",
	"core/paragraph":
		"Body text in `value`. Keep paragraphs short; use several rather than one long one. For bold or links inside the text, put simple HTML in `value` and set `format: \"html\"`.",
	"core/button":
		"One call to action. `value` is the label, `url` the target: `/contact` for a page on this site, a full address for elsewhere, `#popup-<slug>` to open a popup. `action: \"submit\"` only inside a Form. Use one main button per section.",
	"core/buttons":
		"A row of simple buttons kept inside its content (`buttons`: text, url, linkTarget), not as child blocks. For buttons with their own look, put Button blocks in a horizontal Stack instead.",
	"core/list":
		"A bulleted or numbered list. `values` is the items as `<li>…</li>` HTML; `ordered: true` for numbers.",
	"core/quote":
		"A quotation: `value` is the quote as HTML (`<p>…</p>`), `citation` who said it.",
	"core/pullquote":
		"A short, large quote that stands out from the text around it. Use sparingly; for testimonials a Container with a paragraph and a name often reads better.",
	"core/table":
		"Rows and columns of data: `head`, `body` and `foot` rows, each with `cells` (`content`, `tag`). Use for real tabular data (prices, specs), not for page layout.",
	"core/code":
		"Code shown with its language (`content`, `language`). Only for code samples.",
	"core/preformatted":
		"Text that keeps its spaces and line breaks exactly (`content`). Rarely needed outside technical pages.",
	"core/html":
		"Raw HTML (`content`), cleaned before it is shown. Last resort when no block fits; prefer real blocks so people can still edit the page.",
	"core/markdown":
		"Text written in Markdown (`content`). Handy for long articles; for page sections prefer Heading and Paragraph blocks.",
	"core/icon":
		"An icon. Use `iconSet: \"lucide\"` with a kebab-case `iconName` (`check`, `arrow-right`, `star`) — published pages draw Lucide by name. `link` makes it clickable.",
	"core/spacer":
		"Empty vertical space (`height`). Prefer `styles.gap` or padding on the parent; use a spacer only for one-off breathing room.",
	"core/separator":
		"A thin line between parts of the content (`lineStyle`: solid, dashed, dotted).",
	"core/divider":
		"An older horizontal line, hidden from the block library. Use Separator instead.",
	"core/image":
		"One picture. `url` from this site's media library (`/uploads/…`) or the placeholder; always write a real `alt` that says what the picture shows (empty only for pure decoration).",
	"core/gallery":
		"Several pictures in a grid (`images`, `columns`). Each image needs its own `alt`.",
	"core/video":
		"A video player: an uploaded file or a YouTube address in `url`. For a silent looping background video set `autoplay`, `muted`, `loop` and `playsInline` together.",
	"core/audio":
		"An audio player for an uploaded sound file (`url`).",
	"core/file":
		"A download link for an uploaded file (PDF, document).",
	"core/cover":
		"One image or video with a short piece of text over it (`innerContent`, HTML) and a dark overlay (`dimRatio`). For a hero with real blocks on top (heading, buttons, form), use a Stack in `overlay` mode instead.",
	"core/media-text":
		"A picture beside text (`mediaUrl`, `mediaPosition`, `content` as HTML); stacks on phones. Good for feature rows.",
	"post/title":
		"The current post's title. Only on post templates and inside posts.",
	"post/excerpt":
		"The current post's summary. Only on post templates and inside posts.",
	"post/featured-image":
		"The current post's main picture. Only on post templates and inside posts.",
	"post/list":
		"A list or grid of published posts from a blog. Works on any page (a blog landing page, \"Latest news\").",
	"post/toc":
		"A table of contents built from the headings on the page. Use on long posts or guides.",
	"post/author-box":
		"The post author's picture, name and bio. Only on post templates and inside posts.",
	"post/comments":
		"Comments and a comment form for the current post. Only on post templates and inside posts.",
	"post/navigation":
		"Links to the previous and next post. Only on post templates and inside posts.",
	"post/info":
		"Date, categories, tags and reading time of the current post. Only on post templates and inside posts.",
	"post/progress":
		"A reading-progress bar. Only on long posts.",
};
