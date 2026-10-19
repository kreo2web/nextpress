import { applySdkBlockDefaults, withStartingChildren } from "../defaults/block-defaults.js";
import { applySanitizedBlockOverrides } from "../sanitize/apply-block-overrides.js";
import type { BlockConfig, BlockContent, IconReference } from "../types/domain.js";
import { BLOCK_DEFINITIONS, type BlockName } from "./block-definitions.js";
import type { BlockEditorSettings } from "./block-editor-settings.js";
import type { BlockStyles } from "./block-params.js";
import { createBlockId } from "./create-block-id.js";
import { serializeStructuredContent } from "./serialize-block-content.js";
import { toSavedContent } from "./to-saved-content.js";

const GROUP_LAYOUT_KEYS = new Set([
	"display",
	"flexDirection",
	"flexWrap",
	"alignItems",
	"justifyContent",
	"gap",
	"rowGap",
	"columnGap",
	"gridTemplateColumns",
	"gridTemplateRows",
	"width",
	"maxWidth",
	"minWidth",
	"height",
	"maxHeight",
	"minHeight",
	"overflow",
]);

const COLUMNS_VISUAL_KEYS = new Set(["gap", "direction"]);

/** Strips layout CSS from semantic content — layout belongs on `styles` only. */
const stripLayoutFromSemantic = (
	name: BlockName,
	semantic: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined => {
	if (!semantic) return semantic;
	const out = { ...semantic };
	if (name === "core/group") {
		for (const key of GROUP_LAYOUT_KEYS) delete out[key];
	}
	if (name === "core/columns") {
		for (const key of COLUMNS_VISUAL_KEYS) delete out[key];
	}
	return out;
};

const buildTextKindContent = (
	semantic: Record<string, unknown> | undefined,
	defaultContent: BlockContent,
): BlockContent => {
	const base = defaultContent as Extract<BlockContent, { kind: "text" }>;
	const text = typeof semantic?.text === "string" ? semantic.text : (semantic?.value ?? base.value);
	const icon =
		semantic?.icon &&
		typeof semantic.icon === "object" &&
		typeof (semantic.icon as IconReference).iconName === "string"
			? (semantic.icon as IconReference)
			: undefined;
	return {
		...base,
		kind: "text",
		value: typeof text === "string" ? text : String(text ?? ""),
		...(typeof semantic?.level === "number" ? { level: semantic.level } : {}),
		...(typeof semantic?.url === "string" ? { url: semantic.url } : {}),
		...(typeof semantic?.linkTarget === "string"
			? { linkTarget: semantic.linkTarget as "_self" | "_blank" }
			: {}),
		...(icon ? { icon } : {}),
		...(semantic?.iconPosition === "left" || semantic?.iconPosition === "right"
			? { iconPosition: semantic.iconPosition }
			: {}),
		...(typeof semantic?.iconOnly === "boolean" ? { iconOnly: semantic.iconOnly } : {}),
	};
};

const buildMediaKindContent = (
	semantic: Record<string, unknown> | undefined,
	defaultContent: BlockContent,
): BlockContent => {
	const base = defaultContent as Extract<BlockContent, { kind: "media" }>;
	const url = typeof semantic?.url === "string" ? semantic.url : (base.url ?? "");
	// The sample alt text describes the sample picture only, so another picture starts without one.
	// Video and audio have no alt text at all.
	const sampleAlt = url === base.url || base.alt === undefined ? base.alt : "";
	const alt = typeof semantic?.alt === "string" ? semantic.alt : sampleAlt;
	return {
		...base,
		kind: "media",
		url,
		...(alt !== undefined ? { alt } : {}),
		...(typeof semantic?.caption === "string" ? { caption: semantic.caption } : {}),
	};
};

/** `post/toc`, `post/info` and `post/progress` are saved without a `kind` wrapper, exactly as the editor saves them. */
const readPlainContent = (content: BlockContent): Record<string, unknown> | undefined =>
	content && typeof content === "object" && !("kind" in content) ? content : undefined;

const buildContent = (name: BlockName, editorSettings: BlockEditorSettings): BlockContent => {
	const def = BLOCK_DEFINITIONS[name];
	const defaultContent = def.defaultContent();
	const semantic = toSavedContent({
		name,
		semantic: stripLayoutFromSemantic(
			name,
			editorSettings.content as Record<string, unknown> | undefined,
		),
	});

	const plain = readPlainContent(defaultContent);
	// Cast: a plain default has no `kind`, which `BlockContent` cannot say.
	if (plain) return { ...plain, ...semantic } as BlockContent;

	if (defaultContent && typeof defaultContent === "object") {
		if (defaultContent.kind === "structured") {
			return serializeStructuredContent({
				name,
				content: semantic,
			});
		}
		if (defaultContent.kind === "text") {
			return buildTextKindContent(semantic, defaultContent);
		}
		if (defaultContent.kind === "media") {
			return buildMediaKindContent(semantic, defaultContent);
		}
	}

	return defaultContent;
};

export type ApplyEditorSettingsParams = {
	name: BlockName;
	id?: string;
	parentId?: string | null;
	label?: string;
	children?: BlockConfig[];
	html?: string;
	js?: string;
	css?: string;
	settings: BlockEditorSettings;
	/** Optional style fallback when migrating flat callers — prefer `settings.styles`. */
	styles?: BlockStyles;
};

/**
 * Maps nested editor settings to a persisted `BlockConfig`.
 * Never dual-writes layout CSS into `content`.
 */
export const applyEditorSettings = ({
	name,
	id,
	parentId,
	label,
	children,
	html,
	js,
	css,
	settings,
	styles,
}: ApplyEditorSettingsParams): BlockConfig => {
	const def = BLOCK_DEFINITIONS[name];
	const built: BlockConfig = {
		id: id ?? createBlockId(),
		name,
		type: def.type,
		parentId: parentId ?? null,
		label: label ?? def.label,
		category: def.category,
		content: buildContent(name, settings),
		styles: settings.styles ?? styles ?? def.defaultStyles,
		settings: settings.advanced ?? {},
		children,
	};
	const withDefaults = applySdkBlockDefaults(
		applySanitizedBlockOverrides(built, { html, js, css }),
	);
	return withStartingChildren(withDefaults);
};
