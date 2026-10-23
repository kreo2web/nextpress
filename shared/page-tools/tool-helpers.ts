import { z } from "zod";
import type { BlockConfig } from "../schema-types.js";
import type { PageTool, PageToolContext, PageToolResult } from "./types.js";

/** Longest list of input problems shown to the model. */
const MAX_INPUT_PROBLEMS = 5;

const formatPath = (path: Array<string | number>): string =>
	path.reduce<string>((text, part) => (typeof part === "number" ? `${text}[${part}]` : text ? `${text}.${part}` : part), "");

/** Input problems as short lines the model can act on, e.g. `ops[2].block.name: Unknown block name "x".` */
export const explainInputProblems = (error: z.ZodError): string => {
	const lines = error.issues.slice(0, MAX_INPUT_PROBLEMS).map((issue) => {
		const where = formatPath(issue.path);
		const keys = issue.code === z.ZodIssueCode.unrecognized_keys ? ` (not allowed here: ${issue.keys.join(", ")})` : "";
		return `- ${where ? `${where}: ` : ""}${issue.message}${keys}`;
	});
	const more = error.issues.length - MAX_INPUT_PROBLEMS;
	return [...lines, ...(more > 0 ? [`- and ${more} more`] : [])].join("\n");
};

type ParsedInput<S extends z.ZodRawShape> = { ok: true; value: z.infer<z.ZodObject<S>> } | { ok: false; text: string };

/** Checks a tool's raw input against its shape. Never throws. */
export const parseToolInput = <S extends z.ZodRawShape>({
	shape,
	input,
}: {
	shape: S;
	input: Record<string, unknown>;
}): ParsedInput<S> => {
	const parsed = z.object(shape).safeParse(input ?? {});
	if (parsed.success) return { ok: true, value: parsed.data };
	return { ok: false, text: `The input was rejected, so nothing was done:\n${explainInputProblems(parsed.error)}\nFix the input and call the tool again.` };
};

type Attempt<T> = { ok: true; value: T } | { ok: false; error: Error };

/**
 * Runs async work that may throw (reading or writing the page, a site lookup) and hands back
 * the outcome instead. Shared page code cannot import `slang-ts`, so this is its `safeTry`.
 */
export const attempt = async <T>(work: () => Promise<T>): Promise<Attempt<T>> => {
	try {
		return { ok: true, value: await work() };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
};

type ReadOutcome = { ok: true; blocks: BlockConfig[] } | { ok: false; result: PageToolResult };

/** Reads the page for a tool. A failed read comes back as a ready-made failed result. */
export const readPageTree = async (ctx: PageToolContext): Promise<ReadOutcome> => {
	const read = await attempt(() => ctx.readTree());
	if (read.ok) return { ok: true, blocks: read.value };
	ctx.onError?.({ tool: "readTree", error: read.error });
	return { ok: false, result: { ok: false, text: `The page could not be read: ${read.error.message}.` } };
};

type ToolDefinition<S extends z.ZodRawShape> = {
	name: string;
	title: string;
	description: string;
	inputShape: S;
	changesPage: boolean;
	run: (input: z.infer<z.ZodObject<S>>) => Promise<PageToolResult>;
};

/**
 * Builds a `PageTool`: the input is checked before `run` sees it, and anything `run` throws
 * comes back as a failed result (and is reported to `ctx.onError`) instead of escaping.
 */
export const defineTool = <S extends z.ZodRawShape>({
	ctx,
	definition,
}: {
	ctx: PageToolContext;
	definition: ToolDefinition<S>;
}): PageTool => ({
	name: definition.name,
	title: definition.title,
	description: definition.description,
	inputShape: definition.inputShape,
	changesPage: definition.changesPage,
	run: async (input) => {
		const parsed = parseToolInput({ shape: definition.inputShape, input });
		if (!parsed.ok) return { ok: false, text: parsed.text };
		const outcome = await attempt(() => definition.run(parsed.value));
		if (outcome.ok) return outcome.value;
		ctx.onError?.({ tool: definition.name, error: outcome.error });
		return { ok: false, text: `${definition.title} failed: ${outcome.error.message}. Read the outline again to see the page as it is now.` };
	},
});

export type SerialQueue = <T>(job: () => Promise<T>) => Promise<T>;

/** Runs jobs one after another, so two changes sent together never read the same starting page. */
export const createSerialQueue = (): SerialQueue => {
	let tail: Promise<void> = Promise.resolve();
	return <T>(job: () => Promise<T>): Promise<T> => {
		const next = tail.then(job);
		tail = next.then(
			() => undefined,
			() => undefined,
		);
		return next;
	};
};
