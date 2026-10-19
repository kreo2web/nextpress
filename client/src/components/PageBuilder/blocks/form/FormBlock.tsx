import type { BlockConfig } from "@shared/schema-types";
import { Send } from "lucide-react";
import { DEFAULT_FORM_CONTENT, readFormContent, type FormContent } from "@shared/form-model";
import { FormHiddenFields } from "@shared/form-hidden-fields";
import { ContainerChildren } from "../../BlockRenderer";
import { createBlockDefinition } from "../createBlockDefinition";
import { FormSettings } from "./form-settings";
import { catalogMeta } from "../catalog-meta";
import { buildGroupShellStyles, readGroupShellContent } from "@shared/group-shell-styles";

type FormCanvasProps = {
	hostBlock: BlockConfig;
	content: FormContent;
	isPreview?: boolean;
	onNestedBlockChange?: (updated: BlockConfig) => void;
};

/**
 * The same `<form>` on the canvas and in preview. On the canvas a thin caption names the form and
 * sending is off; in preview and on the live site the form runtime sends it.
 */
function FormCanvas({ hostBlock, content, isPreview, onNestedBlockChange }: FormCanvasProps) {
	const { outerStyle, isHorizontal } = buildGroupShellStyles({
		styles: hostBlock.styles,
		content: readGroupShellContent(hostBlock.content),
		children: hostBlock.children?.map((child) => ({ styles: child.styles })),
	});
	return (
		<form
			className={["wp-block-form", isHorizontal ? "is-horizontal" : ""].filter(Boolean).join(" ")}
			data-np-form={isPreview ? hostBlock.id : undefined}
			action="/api/forms/submit"
			method="post"
			noValidate={!isPreview}
			onSubmit={isPreview ? undefined : (event) => event.preventDefault()}
			style={outerStyle}
		>
			{isPreview ? null : (
				<p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-npb-text-muted">
					<Send className="h-3.5 w-3.5 shrink-0" aria-hidden />
					Form · {content.name}
					<span className="font-normal">— what visitors send appears in Forms.</span>
				</p>
			)}
			{Array.isArray(hostBlock.children) && hostBlock.children.length > 0 ? (
				<ContainerChildren
					block={hostBlock}
					isPreview={isPreview ?? false}
					onBlockChange={onNestedBlockChange}
					stackClassName="wp-block-form__fields"
				/>
			) : isPreview ? null : (
				<p className="text-npb-text-muted text-sm">Add a field from Form fields.</p>
			)}
			<FormHiddenFields formId={hostBlock.id} />
		</form>
	);
}

const FormBlock = createBlockDefinition<FormContent>({
	...catalogMeta("core/form"),
	icon: Send,
	handlesOwnChildren: true,
	defaultContent: DEFAULT_FORM_CONTENT,
	parseContent: (raw) => readFormContent(raw),
	settings: FormSettings,
	hasSettings: true,
	render: ({ value, content, isPreview, onNestedBlockChange }) => (
		<FormCanvas hostBlock={value} content={content} isPreview={isPreview} onNestedBlockChange={onNestedBlockChange} />
	),
});

export default FormBlock;
