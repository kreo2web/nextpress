import { z } from "zod";
import { AI_ASSISTANT_LIMITS, type AiChatContentType } from "@shared/ai-builder";
import type { BlockConfig } from "@shared/schema-types";
import type { UIMessage } from "ai";

export type ReadChatBody =
	| {
			ok: true;
			siteId: string;
			pageId: string;
			contentType: AiChatContentType;
			blocks: BlockConfig[];
			focusBlockId?: string;
			messages: UIMessage[];
	  }
	| { ok: false; message: string };

const uuid = z.string().uuid();

const messageSchema = z.object({
	id: z.string().min(1),
	role: z.enum(["system", "user", "assistant"]),
	parts: z.array(z.object({ type: z.string().min(1) }).passthrough()).min(1),
});

const chatBodySchema = z.object({
	siteId: uuid,
	pageId: uuid,
	contentType: z.enum(["page", "post"]),
	blocks: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) }).passthrough()),
	focusBlockId: z.string().min(1).optional(),
	messages: z.array(messageSchema).min(1).max(AI_ASSISTANT_LIMITS.maxMessages),
});

const isBlockTree = (blocks: Array<{ id: string; name: string }>): blocks is BlockConfig[] =>
	blocks.every((block) => typeof block.id === "string" && typeof block.name === "string");

/**
 * Reads the chat body. `blocks` is the tree open in the editor; it is not saved here.
 */
export const readChatBody = (body: object | null | undefined): ReadChatBody => {
	const parsed = chatBodySchema.safeParse(body ?? {});
	if (!parsed.success) {
		return { ok: false, message: parsed.error.issues[0]?.message ?? "invalid" };
	}
	const { blocks, messages, focusBlockId, ...rest } = parsed.data;
	if (!isBlockTree(blocks)) {
		return { ok: false, message: "invalid blocks" };
	}
	return {
		ok: true,
		...rest,
		blocks,
		...(focusBlockId ? { focusBlockId } : {}),
		messages: messages as UIMessage[],
	};
};
