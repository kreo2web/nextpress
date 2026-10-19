/** The options row that holds a site's AI settings. */
export const AI_BUILDER_OPTION_NAME = "ai_builder";

/**
 * Option names the generic options routes and exports must never touch.
 *
 * WHY a prefix and not one name: later AI features can add rows (`ai_builder_…`) without another round of
 * guarding. Capitals and spaces are folded so a lookalike can't slip past.
 */
export const isReservedOptionName = (name: string): boolean =>
	name.trim().toLowerCase().startsWith(AI_BUILDER_OPTION_NAME);
