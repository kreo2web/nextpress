import { useContext, useState, type CSSProperties, type JSX } from "react";
import { DEFAULT_CARD_CONTENT } from "../../blocks/card-model.js";
import { CardView, GridView } from "../../blocks/card-view.js";
import { readGridContent } from "../../blocks/grid-model.js";
import { readChoice } from "../../blocks/read-structured.js";
import { stepIconFromName } from "../../blocks/step-icon-view.js";
import { STEPS_MARKERS } from "../../blocks/steps-model.js";
import { StepItemView, StepsOtherView, StepsView } from "../../blocks/steps-view.js";
import { TabPanelView, TabsView } from "../../blocks/tabs-view.js";
import { UpdateView } from "../../blocks/update-view.js";
import { type ContainerDocName, type DocComponentProps, type DocComponentView, docProp } from "../doc-component-props.js";
import { safeHref } from "../safe-href.js";
import { codeGroupSyncKey, codeTabLabel } from "./code-tab-label.js";
import { type DocElement, MarkdownIdContext, listDocChildren, readFenceNames, splitDocChildren, tagOf } from "./doc-children.js";

/** The number NextPress gave this Tabs or CodeGroup (`doc-component-ids.ts`), so its tab ids are unique. */
const useGroupId = (props: DocComponentProps): string => {
	const prefix = useContext(MarkdownIdContext);
	return `${prefix}-md-${docProp(props.index) ?? "0"}`;
};

/** Which tab is open: local to this render, since MDX has no saved state. */
const useOpenTab = (count: number): { selected: number; select: (index: number) => void } => {
	const [open, select] = useState(0);
	return { selected: open < count ? open : 0, select };
};

const Tabs: DocComponentView = (props) => {
	const id = useGroupId(props);
	const { items, others } = splitDocChildren({ children: props.children, tag: "np-tab" });
	const { selected, select } = useOpenTab(items.length);
	return (
		<TabsView
			id={id}
			look="underline"
			linkable
			selected={selected}
			onSelect={select}
			tabs={items.map((tab, index) => ({ key: String(index), title: docProp(tab.props.title) ?? `Tab ${index + 1}`, panel: tab.props.children }))}
			after={others.length > 0 ? others : null}
		/>
	);
};

/** A Tab outside Tabs has no bar to open it, so it shows as a plain section. */
const Tab: DocComponentView = ({ children }) => <TabPanelView>{children}</TabPanelView>;

const CodeGroup: DocComponentView = (props) => {
	const id = useGroupId(props);
	const { items, others } = splitDocChildren({ children: props.children, tag: "pre" });
	const { selected, select } = useOpenTab(items.length);
	const labels = items.map((fence) => codeTabLabel(readFenceNames(fence)));
	return (
		<TabsView
			id={id}
			look="underline"
			extraClassName="np-code-group"
			selected={selected}
			onSelect={select}
			listAttributes={{ "data-np-sync": codeGroupSyncKey(labels), "data-np-remember": "true" }}
			tabs={items.map((fence, index) => ({ key: String(index), title: labels[index], panel: fence }))}
			after={others.length > 0 ? others : null}
		/>
	);
};

/**
 * `marker` is numbers (the default), dots or icons. With icons, each `<Step icon="rocket">` names a
 * Lucide icon; the markup is the Steps block's own, so the same stylesheet draws both.
 */
const Steps: DocComponentView = ({ marker, children }) => {
	const kind = readChoice({ value: docProp(marker), options: STEPS_MARKERS, fallback: "number" });
	return (
		<StepsView layout="vertical" marker={kind}>
			{listDocChildren(children).map((child, index) => {
				if (tagOf(child) !== "np-step") return <StepsOtherView key={index}>{child}</StepsOtherView>;
				const step = child as DocElement;
				return (
					<StepItemView
						key={index}
						as="li"
						title={docProp(step.props.title) ?? `Step ${index + 1}`}
						icon={kind === "icon" ? stepIconFromName(docProp(step.props.icon)) : undefined}
					>
						{step.props.children}
					</StepItemView>
				);
			})}
		</StepsView>
	);
};

/** A Step outside Steps keeps the step look on a plain div. */
const Step: DocComponentView = ({ title, children }) => (
	<StepItemView as="div" title={docProp(title) ?? "Step"}>
		{children}
	</StepItemView>
);

const CARD_BOX: CSSProperties = { width: "100%", boxSizing: "border-box", margin: 0, padding: "1.5rem", borderRadius: "12px", gap: "0.5rem" };

/** One card: the Card block's box, with `title` as its heading and `href` as the whole-card link. */
const Card: DocComponentView = ({ title, href, children }) => {
	const heading = docProp(title) ?? "";
	const link = safeHref(docProp(href));
	return (
		<CardView content={{ ...DEFAULT_CARD_CONTENT, title: heading, link, linkLabel: heading }} style={CARD_BOX}>
			{children}
		</CardView>
	);
};

/** `cols` is how many cards sit side by side on a desktop, 1 to 4 (default 2); phones always get one. (`cols` reaches us as a number: HTML knows it as an attribute, so the parser converts it.) */
const Cards: DocComponentView = ({ cols, children }) => (
	<GridView content={readGridContent({ kind: "structured", data: { columns: Math.min(4, Math.max(1, Number(cols) || 2)), phoneColumns: 1 } })} style={{ gap: "1rem", margin: "1em 0" }}>
		{listDocChildren(children)}
	</GridView>
);

const Icon = ({ path, className }: { path: string; className: string }): JSX.Element => (
	<span className={className}>
		<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d={path} />
		</svg>
	</span>
);

/**
 * A native details element with the Accordion block's classes, so it opens without JavaScript and
 * with the keyboard. Its look is `MDX_ACCORDION_CSS` (the block's default look, written once).
 */
const Accordion: DocComponentView = ({ title, children }) => (
	<div className="np-accordion np-accordion--doc">
		<details className="np-accordion__item">
			<summary className="np-accordion__title">
				<span className="np-accordion__icon" aria-hidden="true">
					<Icon className="np-accordion__icon-closed" path="M5 12h14M12 5v14" />
					<Icon className="np-accordion__icon-open" path="M5 12h14" />
				</span>
				<span className="np-accordion__label">{docProp(title) ?? "Details"}</span>
			</summary>
			<div className="np-accordion__body">{children}</div>
		</details>
	</div>
);

/** A changelog entry: the Update block's own view, so the tag and the block look the same. */
const Update: DocComponentView = ({ label, description, children }) => (
	<UpdateView label={docProp(label) ?? ""} description={docProp(description) ?? ""}>
		{children}
	</UpdateView>
);

/** How each container tag draws, keyed by the name authors write. */
export const CONTAINER_DOC_VIEWS: Record<ContainerDocName, DocComponentView> = { Tabs, Tab, CodeGroup, Steps, Step, Cards, Card, Accordion, Update };
