import type { Deps } from "../../routes/shared/deps";
import { safeTryAsync } from "../../utils";
import type { AssistantChatDocumentKind } from "@shared/assistant-chats";

/**
 * Removes the saved assistant chats about a page or post that was just deleted. Never fails the
 * delete: a chat left behind is harmless (nobody can open it), so a failure is only logged.
 */
export async function forgetDocumentChats({
	models,
	documentKind,
	documentId,
}: {
	models: Pick<Deps["models"], "assistantChats">;
	documentKind: AssistantChatDocumentKind;
	documentId: string;
}): Promise<void> {
	// Test model sets and older wiring may have no chat store; then there is nothing to forget.
	if (!models.assistantChats) return;
	const { err } = await safeTryAsync(() => models.assistantChats.removeForDocument({ documentKind, documentId }));
	if (err) {
		console.error("[assistant-chats] Chats of a deleted document were not removed", {
			atFunction: "forgetDocumentChats",
			data: { documentKind, documentId, error: err },
		});
	}
}
