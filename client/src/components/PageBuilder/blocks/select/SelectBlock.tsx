import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListFilter, Plus, Trash2 } from "lucide-react";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { SelectFieldView, selectOptionsWithLabels } from "@shared/select-field-view";
import { BlockShell } from "../shared/block-shell";
import { SettingsLabel } from "../../shared";
import {
	DEFAULT_FORM_FIELD_STYLES,
	DEFAULT_SELECT_CONTENT,
	type SelectFieldContent,
	type SelectOption,
} from "@shared/form-field-model";
import { FormFieldSettings } from "../form/form-field-settings";

type SelectRendererProps = {
	blockId: string;
	content: SelectFieldContent;
	styles?: React.CSSProperties;
};

function SelectRenderer({ content, styles, blockId }: SelectRendererProps) {
	const name = content?.name || "choice";
	const rawOptions = content?.options?.length
		? content.options
		: (DEFAULT_SELECT_CONTENT.options ?? []);
	// On the canvas the styled dropdown shows straight away; opening it is for preview and the live site.
	return (
		<BlockShell blockClass="wp-block-select">
			<SelectFieldView
				blockId={blockId}
				name={name}
				label={content?.label}
				help={content?.helpText}
				placeholder={content?.placeholder}
				defaultValue={content?.defaultValue ?? ""}
				required={content?.required ?? false}
				disabled={content?.disabled ?? false}
				ariaLabel={content?.ariaLabel || content?.placeholder || name}
				options={selectOptionsWithLabels(rawOptions)}
				controlClassName={content?.className}
				style={{ ...DEFAULT_FORM_FIELD_STYLES, ...styles }}
				ready
			/>
		</BlockShell>
	);
}

function SelectOptionsEditor({
	options,
	defaultValue,
	onChange,
}: {
	options: SelectOption[];
	defaultValue: string;
	onChange: (next: SelectOption[]) => void;
}) {
	const rows = options.length > 0 ? options : [{ label: "", value: "" }];
	const remaining = selectOptionsWithLabels(rows);
	const defaultMissesChoice =
		defaultValue.trim() !== "" && !remaining.some((row) => row.value === defaultValue);

	const updateRow = (index: number, patch: Partial<SelectOption>) => {
		const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
		onChange(next);
	};

	const addRow = () => onChange([...rows, { label: "New option", value: `option-${rows.length + 1}` }]);

	const removeRow = (index: number) => {
		if (rows.length <= 1) return;
		onChange(rows.filter((_, i) => i !== index));
	};

	return (
		<div className="space-y-3">
			<SettingsLabel>Options</SettingsLabel>
			{rows.map((row, index) => (
				<div key={`${index}-${row.value}`} className="flex items-center gap-2">
					<Input
						value={row.label}
						onChange={(e) => updateRow(index, { label: e.target.value })}
						placeholder="Label"
						className="h-9 flex-1"
					/>
					<Input
						value={row.value}
						onChange={(e) => updateRow(index, { value: e.target.value })}
						placeholder="Value"
						className="h-9 w-28"
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-9 w-9 shrink-0"
						onClick={() => removeRow(index)}
						disabled={rows.length <= 1}
						aria-label="Remove option"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			))}
			<Button type="button" variant="outline" size="sm" onClick={addRow}>
				<Plus className="mr-2 h-4 w-4" />
				Add option
			</Button>
			{defaultMissesChoice ? (
				<p className="npb-settings-hint-muted text-xs">The default does not match a choice.</p>
			) : null}
		</div>
	);
}

function SelectSettings({
	block,
	onUpdate,
}: {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
}) {
	return (
		<FormFieldSettings<SelectFieldContent>
			block={block}
			onUpdate={onUpdate}
			defaultContent={DEFAULT_SELECT_CONTENT}
			extraFields={({ content, updateContent }) => (
				<SelectOptionsEditor
					options={content?.options ?? DEFAULT_SELECT_CONTENT.options ?? []}
					defaultValue={content?.defaultValue ?? ""}
					onChange={(options) => updateContent({ options })}
				/>
			)}
		/>
	);
}

const SelectBlock = createBlockDefinition<SelectFieldContent>({
	...catalogMeta("core/select"),
	icon: ListFilter,
	defaultContent: DEFAULT_SELECT_CONTENT,
	settings: SelectSettings,
	hasSettings: true,
	render: ({ content, styles, value }) => <SelectRenderer content={content} styles={styles} blockId={value.id} />,
});

export default SelectBlock;
