import type { BlockName } from "./block-names.js";

const FORM_FIELD_EXTRAS = ["label", "helpText", "ariaLabel", "className"] as const;

/**
 * Content fields a block uses beyond the ones its default content already has. Together with the
 * defaults this is every field the editor or the published page reads, so the page tools can
 * refuse a field a block doesn't have instead of saving it where nothing reads it. A dotted name
 * is a field inside an object field (`icon.url`).
 *
 * Old spellings the renderers still read for old pages (`target`, a quote's `author`, `textAlign`
 * in content) are left out on purpose: new blocks use the current field. A field already on a
 * block is always accepted when changing that block.
 *
 * When a block's settings panel or renderer starts reading a new content field, add it here.
 */
export const BLOCK_EXTRA_CONTENT_FIELDS: Partial<Record<BlockName, readonly string[]>> = {
	"core/heading": ["format"],
	"core/paragraph": ["format"],
	"core/button": ["action", "icon", "iconOnly", "iconPosition", "iconSize"],
	"core/image": ["intrinsicWidth", "intrinsicHeight", "objectFit", "aspectRatio"],
	"core/video": ["objectFit"],
	"core/cover": ["overlayColor"],
	"core/icon": ["icon.svg", "icon.url", "icon.label", "icon.tint", "icon.sizeUnit", "icon.strokeWidthUnit"],
	"core/step": ["icon.svg", "icon.url", "icon.label", "icon.tint", "icon.iconSet", "icon.iconName", "icon.size", "icon.color", "icon.strokeWidth"],
	"core/tabs": ["linkable"],
	"core/group": ["layoutPreset"],
	"core/page-shell": ["paddingInline", "paddingBlock", "contentAlign", "scrollbar", "backgroundFill", "backgroundColor", "textColor"],
	"core/header": [
		"brand.logoUrl",
		"onScroll",
		"backgroundColor",
		"textColor",
		"backgroundFill",
		"overFirstSection",
		"progress",
		"brandShowOn",
		"navShowOn",
		"actionsShowOn",
		"blocksShowOn",
		"navPhoneMenu",
		"paddingBlock",
		"paddingInline",
		"contentWidth",
	],
	"core/accordion": ["icon.closed", "icon.open", "icon.color", "itemBackground", "itemBorderColor", "titleColor"],
	"core/popup": ["backdropColor", "background"],
	"core/input": FORM_FIELD_EXTRAS,
	"core/textarea": FORM_FIELD_EXTRAS,
	"core/select": FORM_FIELD_EXTRAS,
	"core/list": ["start", "reversed", "type"],
	"post/author-box": ["name", "avatar", "bio", "websiteUrl", "xUrl"],
};
