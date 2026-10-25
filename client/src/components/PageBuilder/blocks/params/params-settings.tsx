import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { ArrowDown, ArrowUp, ListTree, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_PARAMS_CONTENT, MAX_PARAMS, readParamsContent, type ParamItem, type ParamsContent } from "@shared/blocks/params-model";
import { SettingsLabel } from "../../shared";
import { useSettingsState } from "../useSettingsState";

type ParamsSettingsProps = {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
};

const NEW_PARAM: ParamItem = { name: "name", type: "string", default: "", required: false, description: "" };

/** Moves the item at `index` one step; out-of-range moves return the list unchanged. */
function moveParam({ items, index, step }: { items: ParamItem[]; index: number; step: -1 | 1 }): ParamItem[] {
	const target = index + step;
	if (target < 0 || target >= items.length) return items;
	const next = [...items];
	[next[index], next[target]] = [next[target], next[index]];
	return next;
}

/** Parameters settings: one row per option with its name, type, default, required switch and description. */
export function ParamsSettings({ block, onUpdate }: ParamsSettingsProps) {
	const { content, updateContent } = useSettingsState<ParamsContent>({
		block,
		onUpdate,
		defaultContent: DEFAULT_PARAMS_CONTENT,
		parseContent: (raw) => readParamsContent(raw),
	});
	const { items } = content;
	const isFull = items.length >= MAX_PARAMS;

	const setItems = (next: ParamItem[]) => updateContent({ items: next });
	const updateItem = ({ index, updates }: { index: number; updates: Partial<ParamItem> }) =>
		setItems(items.map((item, i) => (i === index ? { ...item, ...updates } : item)));

	return (
		<div className="space-y-4">
			<CollapsibleCard title="Parameters" icon={ListTree} defaultOpen>
				<div className="space-y-3">
					<div className="flex items-center justify-between gap-3">
						<SettingsLabel>Parameters ({items.length})</SettingsLabel>
						<Button type="button" variant="outline" size="sm" disabled={isFull} onClick={() => setItems([...items, { ...NEW_PARAM }])}>
							<Plus className="mr-1 h-4 w-4" aria-hidden />
							Add parameter
						</Button>
					</div>
					{isFull && <p className="text-xs text-npb-text-muted">You can list up to {MAX_PARAMS} parameters in one block. Add another block under a new heading for more.</p>}
					{items.length === 0 && <p className="text-xs text-npb-text-muted">No parameters yet. Add one to start the list.</p>}

					<ul className="space-y-3" aria-label="Parameters">
						{items.map((item, index) => (
							<li key={index} className="space-y-2 rounded border border-npb-border-default p-2">
								<div className="flex items-center gap-2">
									<span className="truncate font-mono text-xs text-npb-text-secondary">{item.name || `Parameter ${index + 1}`}</span>
									<div className="ml-auto flex items-center">
										<Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0" disabled={index === 0} aria-label={`Move parameter ${index + 1} up`} onClick={() => setItems(moveParam({ items, index, step: -1 }))}>
											<ArrowUp className="h-4 w-4" />
										</Button>
										<Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0" disabled={index === items.length - 1} aria-label={`Move parameter ${index + 1} down`} onClick={() => setItems(moveParam({ items, index, step: 1 }))}>
											<ArrowDown className="h-4 w-4" />
										</Button>
										<Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label={`Remove parameter ${index + 1}`} onClick={() => setItems(items.filter((_, i) => i !== index))}>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
								<div>
									<SettingsLabel htmlFor={`param-name-${index}`}>Name</SettingsLabel>
									<Input id={`param-name-${index}`} className="mt-1 h-9 font-mono" value={item.name} onChange={(event) => updateItem({ index, updates: { name: event.target.value } })} />
								</div>
								<div className="grid grid-cols-2 gap-2">
									<div>
										<SettingsLabel htmlFor={`param-type-${index}`}>Type</SettingsLabel>
										<Input id={`param-type-${index}`} className="mt-1 h-9 font-mono" value={item.type} onChange={(event) => updateItem({ index, updates: { type: event.target.value } })} />
									</div>
									<div>
										<SettingsLabel htmlFor={`param-default-${index}`}>Default</SettingsLabel>
										<Input id={`param-default-${index}`} className="mt-1 h-9 font-mono" value={item.default} disabled={item.required} onChange={(event) => updateItem({ index, updates: { default: event.target.value } })} />
									</div>
								</div>
								<div className="flex items-center justify-between">
									<SettingsLabel htmlFor={`param-required-${index}`}>Required</SettingsLabel>
									<Switch id={`param-required-${index}`} checked={item.required} onCheckedChange={(checked) => updateItem({ index, updates: { required: checked } })} />
								</div>
								<div>
									<SettingsLabel htmlFor={`param-description-${index}`}>Description</SettingsLabel>
									<Textarea id={`param-description-${index}`} className="mt-1" rows={3} value={item.description} placeholder="What it does. Markdown works." onChange={(event) => updateItem({ index, updates: { description: event.target.value } })} />
								</div>
							</li>
						))}
					</ul>
				</div>
			</CollapsibleCard>
		</div>
	);
}
