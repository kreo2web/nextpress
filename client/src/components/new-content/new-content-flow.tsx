import { useState, type JSX } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { DocsSummary } from "@shared/docs";
import { CreatePageModal } from "@/components/Pages/CreatePageModal";
import { CreatePostDialog } from "@/components/posts/CreatePostDialog";
import { useSiteDocs } from "@/hooks/use-site-docs";
import { useActiveSite } from "@/hooks/useActiveSite";
import { DocsSetupModal } from "./docs-setup/docs-setup-modal";
import { NewChooserDialog, type DocsChoice } from "./new-chooser-dialog";
import { NewDocsPageDialog } from "./new-docs-page-dialog";
import type { NewKind } from "./new-kind-cards";

type Step = "choose" | "page" | "post" | "docs-setup" | "docs-page";

/** Stale answers count: a failed refresh must not hide docs we already know about. */
const readDocsChoice = ({ data, isError }: Pick<UseQueryResult<DocsSummary[], Error>, "data" | "isError">): DocsChoice => {
	if (data) return data.length > 0 ? { status: "some" } : { status: "none" };
	return isError ? { status: "error" } : { status: "loading" };
};

/**
 * Everything that happens after "New": the chooser, then the step each card leads to. Mounted only
 * while it is open, so each time starts fresh. A page and a blog post use the steps they always
 * had; docs go to setup when the site has none, and to "a title and where it goes" when it has.
 */
export function NewContentFlow({ onClose }: { onClose: () => void }): JSX.Element {
	const { activeSiteId } = useActiveSite();
	const docsQuery = useSiteDocs({ siteId: activeSiteId });
	const docs = readDocsChoice(docsQuery);
	const [step, setStep] = useState<Step>("choose");

	const stepFor = (kind: NewKind): Step => {
		const steps: Record<NewKind, Step> = {
			page: "page",
			post: "post",
			docs: docs.status === "none" ? "docs-setup" : "docs-page",
		};
		return steps[kind];
	};

	const closeWhenDismissed = (open: boolean): void => {
		if (!open) onClose();
	};

	const screens: Record<Step, () => JSX.Element> = {
		choose: () => (
			<NewChooserDialog
				docs={docs}
				onPick={(kind) => setStep(stepFor(kind))}
				onRetryDocs={() => void docsQuery.refetch()}
				onClose={onClose}
			/>
		),
		page: () => <CreatePageModal open onOpenChange={closeWhenDismissed} />,
		post: () => <CreatePostDialog open onOpenChange={closeWhenDismissed} />,
		"docs-setup": () => <DocsSetupModal onClose={onClose} />,
		"docs-page": () => <NewDocsPageDialog siteId={activeSiteId} onClose={onClose} onSetupDocs={() => setStep("docs-setup")} />,
	};

	return screens[step]();
}
