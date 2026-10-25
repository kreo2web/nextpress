import { CONTAINER_DOC_VIEWS } from "./components/container-doc-views.js";
import { LEAF_DOC_VIEWS } from "./components/leaf-doc-views.js";
import {
	DOC_COMPONENT_INTERNAL_ATTRIBUTES,
	DOC_COMPONENT_PROPS,
	type DocComponentName,
	type DocComponentView,
} from "./doc-component-props.js";
import { docComponentTag } from "./safe-mdx.js";

export { DOC_COMPONENT_PROPS };

const DOC_COMPONENT_VIEWS: Record<DocComponentName, DocComponentView> = { ...CONTAINER_DOC_VIEWS, ...LEAF_DOC_VIEWS };

const NAMES = Object.keys(DOC_COMPONENT_PROPS) as DocComponentName[];

/** The tags and attributes the sanitizer lets through, keyed by the tag each component becomes. */
export const DOC_COMPONENT_TAGS: Record<string, string[]> = Object.fromEntries(
	NAMES.map((name) => [docComponentTag(name), [...DOC_COMPONENT_PROPS[name], ...(DOC_COMPONENT_INTERNAL_ATTRIBUTES[name] ?? [])]]),
);

/** The renderer's components, keyed the same way. */
export const DOC_COMPONENT_RENDERERS: Record<string, DocComponentView> = Object.fromEntries(
	NAMES.map((name) => [docComponentTag(name), DOC_COMPONENT_VIEWS[name]]),
);
