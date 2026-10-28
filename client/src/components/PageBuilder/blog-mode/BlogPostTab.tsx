import { useId, useState, type KeyboardEvent, type ReactElement } from "react";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { MediaUrlField } from "../blocks/shared/media-url-field";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { usePageContext } from "../PageContext";
import { PanelField, SwitchRow } from "../docs-mode/docs-page-tab-parts";
import { useRequiredBlogMode } from "./blog-mode-context";

/** Categories or tags as chips: Enter or a comma adds what was typed, the cross removes one. */
function TermsField({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (next: string[]) => void; placeholder: string }): ReactElement {
	const id = useId();
	const [typed, setTyped] = useState("");
	const add = (): void => {
		const words = typed.split(",").map((word) => word.trim()).filter((word) => word && !values.includes(word));
		if (words.length > 0) onChange([...values, ...words]);
		setTyped("");
	};
	const keyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
		if (event.key === "Enter" || event.key === ",") {
			event.preventDefault();
			add();
		} else if (event.key === "Backspace" && typed === "" && values.length > 0) {
			onChange(values.slice(0, -1));
		}
	};
	return (
		<PanelField label={label} htmlFor={id} hint="Press Enter or a comma after each one.">
			<div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-[var(--npb-radius-input)] border border-npb-border-default bg-npb-surface-base px-2 py-1.5 focus-within:ring-2 focus-within:ring-npb-focus">
				{values.map((value) => (
					<span key={value} className="inline-flex items-center gap-1 rounded-full bg-npb-surface-inset px-2 py-0.5 text-xs font-medium text-npb-text-primary">
						{value}
						<button type="button" onClick={() => onChange(values.filter((item) => item !== value))} aria-label={`Remove ${value}`} className="rounded-full text-npb-text-muted hover:text-npb-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-npb-focus">
							<X className="h-3 w-3" aria-hidden />
						</button>
					</span>
				))}
				<input id={id} value={typed} onChange={(event) => setTyped(event.target.value)} onKeyDown={keyDown} onBlur={add} placeholder={values.length === 0 ? placeholder : ""} className="min-w-[6rem] flex-1 bg-transparent text-sm text-npb-text-primary outline-none placeholder:text-npb-text-muted" />
			</div>
		</PanelField>
	);
}

/** The date a post shows, from a calendar; cleared, it shows the day it is published. */
function DateField({ value, onChange }: { value: string | null; onChange: (next: string | null) => void }): ReactElement {
	const id = useId();
	const [open, setOpen] = useState(false);
	const date = value ? new Date(value) : undefined;
	const shown = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "When it is published";
	return (
		<PanelField label="Date" htmlFor={id} hint="The date readers see on the post.">
			<div className="flex items-center gap-2">
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger asChild>
						<Button id={id} type="button" variant="outline" className="h-9 flex-1 justify-start gap-2 font-normal">
							<CalendarDays className="h-4 w-4 text-npb-text-muted" aria-hidden />
							{shown}
						</Button>
					</PopoverTrigger>
					<PopoverContent align="start" className="w-auto p-0">
						<Calendar
							mode="single"
							selected={date}
							onSelect={(picked) => {
								onChange(picked ? picked.toISOString() : null);
								setOpen(false);
							}}
						/>
					</PopoverContent>
				</Popover>
				{value ? (
					<Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} className="h-9">
						Clear
					</Button>
				) : null}
			</div>
		</PanelField>
	);
}

type Props = {
	slug: string;
	onSlugChange: (slug: string) => void;
};

/**
 * The Post tab: everything about this one post that isn't its writing. Title, subtitle and cover
 * are also typed or picked on the canvas; here they sit with the rest. Saved with the post.
 */
export function BlogPostTab({ slug, onSlugChange }: Props): ReactElement {
	const post = usePageContext().postDocument;
	const { blog } = useRequiredBlogMode();
	const [open, setOpen] = useState<"search" | null>(null);
	const ids = { slug: useId(), excerpt: useId(), cover: useId(), searchTitle: useId(), searchText: useId() };
	if (!post) {
		return (
			<p className="px-4 py-4 text-sm text-npb-text-muted" role="status">
				Loading the post…
			</p>
		);
	}
	const author = post.author?.name?.trim() || "You";
	return (
		<div>
			<div className="space-y-4 px-4 py-4">
				<PanelField label="Address" htmlFor={ids.slug} hint={blog ? `In ${blog.name}.` : undefined}>
					<div className="flex items-stretch overflow-hidden rounded-[var(--npb-radius-input)] border border-npb-border-default focus-within:ring-2 focus-within:ring-npb-focus">
						<span className="flex items-center bg-npb-surface-inset px-2.5 font-mono text-xs text-npb-text-muted">/post/</span>
						<input id={ids.slug} value={slug} onChange={(event) => onSlugChange(event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))} className="h-9 min-w-0 flex-1 bg-npb-surface-base px-2.5 text-sm text-npb-text-primary outline-none" />
					</div>
				</PanelField>
				<PanelField label="Subtitle" htmlFor={ids.excerpt} hint="Under the title, in the blog's list of posts, and when the post is shared.">
					<Textarea id={ids.excerpt} value={post.excerpt} onChange={(event) => post.updateDocument({ excerpt: event.target.value })} rows={3} className="text-sm" />
				</PanelField>
				<MediaUrlField id={ids.cover} label="Cover" kind="image" value={post.featuredImage} onChange={({ url }) => post.updateDocument({ featuredImage: url })} onLibrarySelect={({ item }) => post.updateDocument({ featuredImage: item.url })} placeholder="Pick a picture or paste its address" />
				<p className="text-sm text-npb-text-secondary">
					Written by <span className="font-medium text-npb-text-primary">{author}</span>
				</p>
				<DateField value={post.publishedAt ?? null} onChange={(publishedAt) => post.updateDocument({ publishedAt })} />
				<TermsField label="Categories" values={post.categories} onChange={(categories) => post.updateDocument({ categories })} placeholder="News, Guides" />
				<TermsField label="Tags" values={post.tags} onChange={(tags) => post.updateDocument({ tags })} placeholder="writing, design" />
				<SwitchRow label="Comments" checked={post.allowComments !== false} onChange={(allowComments) => post.updateDocument({ allowComments })} hint="Readers can comment on this post when the blog shows comments." />
			</div>
			<CollapsibleCard title="Search and sharing" open={open === "search"} onOpenChange={(next) => setOpen(next ? "search" : null)}>
				{open === "search" ? (
					<div className="space-y-4">
						<PanelField label="Title" htmlFor={ids.searchTitle} hint="Empty uses the post's title.">
							<Input id={ids.searchTitle} value={post.seo?.metaTitle ?? ""} onChange={(event) => post.updateDocument({ seo: { metaTitle: event.target.value } })} className="h-9 text-sm" />
						</PanelField>
						<PanelField label="Description" htmlFor={ids.searchText} hint="Empty uses the subtitle.">
							<Textarea id={ids.searchText} value={post.seo?.metaDescription ?? ""} onChange={(event) => post.updateDocument({ seo: { metaDescription: event.target.value } })} rows={3} className="text-sm" />
						</PanelField>
					</div>
				) : null}
			</CollapsibleCard>
		</div>
	);
}
