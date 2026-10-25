import type { JSX } from "react";
import { BookOpen, Check, LayoutTemplate, PenLine, type LucideIcon } from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { RadioGroup } from "@/components/ui/radio-group";

export type NewKind = "page" | "post" | "docs";

type KindCard = { kind: NewKind; title: string; blurb: string; opens: string; Icon: LucideIcon };

export const KIND_CARDS: KindCard[] = [
	{
		kind: "page",
		title: "Page",
		blurb: "One page you design freely: a landing page, pricing, about.",
		opens: "Opens the page builder",
		Icon: LayoutTemplate,
	},
	{
		kind: "post",
		title: "Blog post",
		blurb: "Writing for your blog. How the blog looks is set once.",
		opens: "Opens the post editor",
		Icon: PenLine,
	},
	{
		kind: "docs",
		title: "Docs page",
		blurb: "A page in your docs, with its own header, sidebar and search.",
		opens: "Opens the docs editor",
		Icon: BookOpen,
	},
];

export const isNewKind = (value: string): value is NewKind => KIND_CARDS.some((card) => card.kind === value);

type NewKindCardsProps = {
	value: NewKind;
	onValueChange: (kind: NewKind) => void;
	/** Enter on a card goes on, the way Enter does in a form. */
	onConfirm: () => void;
};

/**
 * The three things you can make, as cards that behave as one radio group: Tab lands on the picked
 * card, the arrow keys move the pick, Enter goes on.
 */
export function NewKindCards({ value, onValueChange, onConfirm }: NewKindCardsProps): JSX.Element {
	return (
		<RadioGroup
			value={value}
			aria-label="What are you making?"
			className="grid-cols-1 gap-3 sm:grid-cols-3"
			onValueChange={(next) => isNewKind(next) && onValueChange(next)}
			onKeyDown={(event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					onConfirm();
				}
			}}
		>
			{KIND_CARDS.map(({ kind, title, blurb, opens, Icon }) => (
				<RadioGroupPrimitive.Item
					key={kind}
					value={kind}
					id={`new-kind-${kind}`}
					aria-labelledby={`new-kind-${kind}-title`}
					aria-describedby={`new-kind-${kind}-blurb new-kind-${kind}-opens`}
					className="relative flex flex-col items-start gap-2.5 rounded-[var(--npb-radius-surface)] border border-npb-border-strong bg-npb-surface-base p-4 text-left outline-none transition-colors hover:bg-npb-surface-raised focus-visible:ring-2 focus-visible:ring-npb-focus focus-visible:ring-offset-2 focus-visible:ring-offset-npb-surface-base data-[state=checked]:border-npb-accent data-[state=checked]:bg-npb-surface-raised sm:p-5"
				>
					<span aria-hidden className="flex size-10 items-center justify-center rounded-lg bg-npb-surface-inset text-npb-text-primary">
						<Icon className="size-5" />
					</span>
					<span id={`new-kind-${kind}-title`} className="text-base font-semibold text-npb-text-primary">
						{title}
					</span>
					<span id={`new-kind-${kind}-blurb`} className="text-sm leading-relaxed text-npb-text-secondary">
						{blurb}
					</span>
					<span id={`new-kind-${kind}-opens`} className="mt-auto pt-0.5 text-xs text-npb-text-muted">
						{opens}
					</span>
					<RadioGroupPrimitive.Indicator
						aria-hidden
						className="absolute top-3.5 right-3.5 flex size-5 items-center justify-center rounded-full bg-npb-accent text-npb-accent-foreground"
					>
						<Check className="size-3" strokeWidth={3} />
					</RadioGroupPrimitive.Indicator>
				</RadioGroupPrimitive.Item>
			))}
		</RadioGroup>
	);
}
