import type { Language } from "@vortexlabs/kirari/core";
import * as kirariLanguages from "@vortexlabs/kirari/languages";
import type { Options } from "@vortexlabs/kirari-rehype";

/**
 * Every language Kirari ships. The one list behind both ways NextPress colors code (the markdown
 * plugin for fences, Kirari's core for the code block), so a language name means the same thing
 * in both.
 */
export const KIRARI_LANGUAGES: readonly Language[] = Object.values(kirariLanguages);

/**
 * The class Kirari puts on a line named in a fence's `{2,4-6}`. The code block gives the lines
 * it marks the same class, so one CSS rule styles both.
 */
export const MARKED_LINE_CLASS = "kirari-line-highlighted";

/**
 * How code is drawn, shared by both ways so a fence and a code block give the same spans: every
 * line wrapped (line numbers and marked lines are plain CSS), and no custom token classes, so the
 * spans carry Kirari's own `kirari-*` names.
 */
export const KIRARI_RENDER_OPTIONS = { lines: true } satisfies Pick<Options, "lines">;

/** What the markdown plugin gets for fences. */
export const KIRARI_REHYPE_OPTIONS: Options = { languages: KIRARI_LANGUAGES, ...KIRARI_RENDER_OPTIONS };
