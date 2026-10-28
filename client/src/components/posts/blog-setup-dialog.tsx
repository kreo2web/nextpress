import { useId, useState, type FormEvent, type JSX } from "react";
import { LayoutGrid, List, Loader2, Newspaper, Rows3, type LucideIcon } from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { RadioGroup } from "@/components/ui/radio-group";
import { useQueryClient } from "@tanstack/react-query";
import { BLOG_HOME_LAYOUTS, type BlogHomeLayout } from "@shared/blog/blog-home-list";
import { DEFAULT_BLOG_POST_LOOK, type BlogPostLook } from "@shared/blog/blog-post-look";
import type { Blog } from "@shared/schema-types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SwitchRow } from "@/components/PageBuilder/docs-mode/docs-page-tab-parts";
import { useActiveSite } from "@/hooks/useActiveSite";
import { apiRequest } from "@/lib/queryClient";
import { appendSiteIdToUrl } from "@/lib/site-api";

const LAYOUTS: Record<BlogHomeLayout, { label: string; Icon: LucideIcon }> = {
	cards: { label: "Cards", Icon: Rows3 },
	grid: { label: "Grid", Icon: LayoutGrid },
	list: { label: "List", Icon: List },
};

/** Cards, grid or list, as three small cards that behave as one radio group (arrow keys move the pick). */
function LayoutChoice({ value, onChange, disabled }: { value: BlogHomeLayout; onChange: (next: BlogHomeLayout) => void; disabled: boolean }): JSX.Element {
	return (
		<div className="grid gap-2">
			<p id="blog-setup-layout" className="text-sm font-medium">
				The home page lists posts as
			</p>
			<RadioGroup value={value} aria-labelledby="blog-setup-layout" className="grid-cols-3 gap-2" disabled={disabled} onValueChange={(next) => isLayout(next) && onChange(next)}>
				{BLOG_HOME_LAYOUTS.map((layout) => {
					const { label, Icon } = LAYOUTS[layout];
					return (
						<RadioGroupPrimitive.Item
							key={layout}
							value={layout}
							className="flex flex-col items-center gap-1.5 rounded-[var(--npb-radius-surface)] border border-npb-border-strong bg-npb-surface-base px-3 py-3 text-sm font-medium text-npb-text-secondary outline-none transition-colors hover:bg-npb-surface-raised focus-visible:ring-2 focus-visible:ring-npb-focus focus-visible:ring-offset-2 focus-visible:ring-offset-npb-surface-base data-[state=checked]:border-npb-accent data-[state=checked]:bg-npb-surface-raised data-[state=checked]:text-npb-text-primary"
						>
							<Icon aria-hidden className="size-5" />
							{label}
						</RadioGroupPrimitive.Item>
					);
				})}
			</RadioGroup>
		</div>
	);
}

const LOOK_SWITCHES: ReadonlyArray<{ key: keyof BlogPostLook; label: string }> = [
	{ key: "cover", label: "Cover picture" },
	{ key: "date", label: "Date" },
	{ key: "readingTime", label: "Reading time" },
	{ key: "author", label: "Author" },
	{ key: "prevNext", label: "Previous and next" },
	{ key: "comments", label: "Comments" },
];

const isLayout = (value: string): value is BlogHomeLayout => BLOG_HOME_LAYOUTS.some((layout) => layout === value);

/** `My Travel Notes` → `my-travel-notes`; empty when nothing usable was typed. */
const addressPart = (text: string): string =>
	text
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

type Props = {
	onCreated: (blog: Blog) => void;
	onClose: () => void;
};

/**
 * "Set up your blog", once: its name, where its home page lives, how that page lists posts, and
 * what each post page shows. Everything here can be changed later in the writing editor's Blog tab.
 */
export function BlogSetupDialog({ onCreated, onClose }: Props): JSX.Element {
	const { activeSiteId, activeSite } = useActiveSite();
	const queryClient = useQueryClient();
	const ids = { name: useId(), address: useId() };
	const [name, setName] = useState("");
	const [address, setAddress] = useState("blog");
	const [layout, setLayout] = useState<BlogHomeLayout>("cards");
	const [look, setLook] = useState<BlogPostLook>(DEFAULT_BLOG_POST_LOOK);
	const [problem, setProblem] = useState<{ field: "name" | "form"; message: string } | null>(null);
	const [saving, setSaving] = useState(false);
	const host = (activeSite?.siteUrl ?? "").replace(/^https?:\/\//, "").replace(/\/+$/, "") || "your site";

	const submit = async (event: FormEvent): Promise<void> => {
		event.preventDefault();
		if (!name.trim()) {
			setProblem({ field: "name", message: "Give your blog a name." });
			return;
		}
		setSaving(true);
		setProblem(null);
		try {
			const response = await apiRequest("POST", appendSiteIdToUrl("/api/blogs", activeSiteId), {
				name: name.trim(),
				status: "publish",
				settings: { post: look },
				home: { address: addressPart(address) || "blog", publish: true, list: { layout } },
			});
			const blog = (await response.json()) as Blog;
			void queryClient.invalidateQueries({ queryKey: ["/api/blogs"] });
			void queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
			onCreated(blog);
		} catch (error) {
			console.error({ atFunction: "blogSetup.create", data: { siteId: activeSiteId, name, error }, message: "Setting up the blog failed" });
			setProblem({ field: "form", message: "We couldn't set up the blog. Check your connection and try again." });
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
			<DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg flex-col gap-0 p-0" showCloseButton={!saving}>
				<form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" aria-busy={saving || undefined}>
					<DialogHeader className="flex-row items-center gap-3 border-b border-npb-divider px-5 py-4 text-left">
						<span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-md bg-npb-surface-inset text-npb-text-primary">
							<Newspaper className="size-4" />
						</span>
						<DialogTitle className="text-base">Set up your blog</DialogTitle>
						<DialogDescription className="sr-only">Name your blog, choose where it lives, how it lists posts and what each post shows.</DialogDescription>
					</DialogHeader>

					<div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-5 py-5">
						<p className="text-sm text-npb-text-secondary">You do this once. After that, a new post only asks for its title.</p>
						<div className="grid gap-2">
							<Label htmlFor={ids.name}>Name</Label>
							<Input id={ids.name} value={name} onChange={(event) => setName(event.target.value)} placeholder="Notes from the team" autoFocus disabled={saving} aria-invalid={problem?.field === "name" || undefined} />
							{problem?.field === "name" ? (
								<p role="alert" className="text-sm text-npb-status-error">
									{problem.message}
								</p>
							) : null}
						</div>
						<div className="grid gap-2">
							<Label htmlFor={ids.address}>Address</Label>
							<div className="flex items-stretch overflow-hidden rounded-[var(--npb-radius-input)] border border-npb-border-default focus-within:ring-2 focus-within:ring-npb-focus">
								<span className="flex items-center bg-npb-surface-inset px-2.5 text-sm text-npb-text-muted">{host}/</span>
								<input id={ids.address} value={address} onChange={(event) => setAddress(event.target.value)} disabled={saving} className="h-9 min-w-0 flex-1 bg-npb-surface-base px-2.5 text-sm text-npb-text-primary outline-none" />
							</div>
							<p className="text-xs text-npb-text-muted">Where the blog's home page lists its posts.</p>
						</div>
						<LayoutChoice value={layout} onChange={setLayout} disabled={saving} />
						<div className="grid gap-3">
							<p className="text-sm font-medium text-npb-text-secondary">Each post shows</p>
							{LOOK_SWITCHES.map(({ key, label }) => (
								<SwitchRow key={key} label={label} checked={look[key]} disabled={saving} onChange={(on) => setLook((current) => ({ ...current, [key]: on }))} />
							))}
						</div>
						{problem?.field === "form" ? (
							<p role="alert" className="text-sm text-npb-status-error">
								{problem.message}
							</p>
						) : null}
					</div>

					<DialogFooter className="border-t border-npb-divider bg-npb-surface-raised px-5 py-3">
						<Button type="button" variant="outline" onClick={onClose} disabled={saving}>
							Cancel
						</Button>
						<Button type="submit" disabled={saving}>
							{saving ? <Loader2 aria-hidden className="animate-spin" /> : null}
							{saving ? "Setting up…" : "Set up blog"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
