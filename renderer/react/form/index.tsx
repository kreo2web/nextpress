import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { getRenderProps } from "../render-helpers";
import { FormFieldLabel, formFieldControlId, formFieldHelpId, readFormFieldHelp } from "@shared/form-field-label";
import { SelectFieldView, selectOptionsWithLabels } from "@shared/select-field-view";
import {
	DEFAULT_FORM_FIELD_STYLES,
	DEFAULT_INPUT_CONTENT,
	DEFAULT_SELECT_CONTENT,
	DEFAULT_TEXTAREA_CONTENT,
	readFormFieldContent,
	type InputFieldContent,
	type SelectFieldContent,
	type TextareaFieldContent,
} from "@shared/form-field-model";

/** Text, search, email, and other single-line inputs. */
export function InputBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const parsed = readFormFieldContent<InputFieldContent>(block.content);
	const content = { ...DEFAULT_INPUT_CONTENT, ...parsed };
	const type = content.type ?? "text";
	const name = content.name || "field";
	const placeholder = content.placeholder ?? DEFAULT_INPUT_CONTENT.placeholder;
	const ariaLabel = content.ariaLabel || placeholder || name;
	const controlId = formFieldControlId(block.id);
	const help = readFormFieldHelp(content.helpText);

	return (
		<div className={["wp-block-input", className].filter(Boolean).join(" ")} {...attributes}>
			<FormFieldLabel label={content.label} htmlFor={controlId} required={content.required} help={content.helpText} />
			<input
				id={controlId}
				type={type}
				name={name}
				defaultValue={content.defaultValue ?? ""}
				placeholder={placeholder}
				required={content.required ?? false}
				disabled={content.disabled ?? false}
				aria-label={ariaLabel}
				aria-describedby={help ? formFieldHelpId(controlId) : undefined}
				className={["wp-block-input__control", content.className].filter(Boolean).join(" ")}
				style={{ ...DEFAULT_FORM_FIELD_STYLES, ...style }}
			/>
		</div>
	);
}

/** Multi-line text input. */
export function TextareaBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const parsed = readFormFieldContent<TextareaFieldContent>(block.content);
	const content = { ...DEFAULT_TEXTAREA_CONTENT, ...parsed };
	const name = content.name || "message";
	const placeholder = content.placeholder ?? DEFAULT_TEXTAREA_CONTENT.placeholder;
	const ariaLabel = content.ariaLabel || placeholder || name;
	const rows = content.rows ?? 4;
	const controlId = formFieldControlId(block.id);
	const help = readFormFieldHelp(content.helpText);

	return (
		<div className={["wp-block-textarea", className].filter(Boolean).join(" ")} {...attributes}>
			<FormFieldLabel label={content.label} htmlFor={controlId} required={content.required} help={content.helpText} />
			<textarea
				id={controlId}
				name={name}
				rows={rows}
				defaultValue={content.defaultValue ?? ""}
				placeholder={placeholder}
				required={content.required ?? false}
				disabled={content.disabled ?? false}
				aria-label={ariaLabel}
				aria-describedby={help ? formFieldHelpId(controlId) : undefined}
				className={["wp-block-textarea__control", content.className].filter(Boolean).join(" ")}
				style={{
					...DEFAULT_FORM_FIELD_STYLES,
					minHeight: `${rows * 1.5}rem`,
					resize: "vertical",
					...style,
				}}
			/>
		</div>
	);
}

/** Dropdown select list. */
export function SelectBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const parsed = readFormFieldContent<SelectFieldContent>(block.content);
	const content = { ...DEFAULT_SELECT_CONTENT, ...parsed };
	const name = content.name || "choice";
	const placeholder = content.placeholder ?? DEFAULT_SELECT_CONTENT.placeholder;
	const rawOptions = content.options?.length
		? content.options
		: (DEFAULT_SELECT_CONTENT.options ?? []);
	return (
		<SelectFieldView
			blockId={block.id}
			name={name}
			label={content.label}
			help={content.helpText}
			placeholder={placeholder}
			defaultValue={content.defaultValue ?? ""}
			required={content.required ?? false}
			disabled={content.disabled ?? false}
			ariaLabel={content.ariaLabel || placeholder || name}
			options={selectOptionsWithLabels(rawOptions)}
			className={["wp-block-select", className].filter(Boolean).join(" ")}
			wrapperAttributes={attributes}
			controlClassName={content.className}
			style={{ ...DEFAULT_FORM_FIELD_STYLES, ...style }}
		/>
	);
}
