/** The rails of the docs editor look like the page builder's: same surfaces, same tab pills, same icon buttons. */

export const LIBRARY_RAIL_CLASS =
	"npb-builder-library-sidebar npb-editor-sidebar flex h-full min-h-0 w-[var(--npb-builder-library-width)] shrink-0 flex-col overflow-hidden border-r border-npb-border-strong bg-npb-surface-base text-npb-text-secondary shadow-[var(--npb-shadow-surface)]";

export const INSPECTOR_RAIL_CLASS =
	"npb-builder-inspector-sidebar npb-editor-sidebar flex h-full min-h-0 w-[var(--npb-builder-inspector-width)] shrink-0 flex-col overflow-hidden border-l border-npb-border-strong bg-npb-surface-base text-npb-text-secondary shadow-[var(--npb-shadow-surface)]";

export const COMPACT_RAIL_CLASS =
	"npb-editor-sidebar flex h-full min-h-0 w-80 shrink-0 flex-col bg-npb-surface-base text-npb-text-secondary shadow-[var(--npb-shadow-surface)]";

export const RAIL_HEADER_CLASS = "flex w-full items-center justify-between gap-2 bg-npb-surface-header p-4";
export const RAIL_TITLE_CLASS = "text-lg font-semibold tracking-tight text-npb-text-primary";

export const RAIL_ICON_BUTTON_CLASS =
	"h-9 w-9 shrink-0 rounded-[var(--npb-radius-input)] p-0 text-npb-text-muted hover:bg-npb-interactive-bg-hover hover:text-npb-text-primary focus-visible:ring-npb-focus focus-visible:ring-offset-0";

export const tabListClass = (columns: number): string =>
	`grid h-auto min-h-10 w-full rounded-[var(--npb-radius-surface)] bg-npb-surface-inset p-1 ${columns >= 5 ? "grid-cols-5" : columns === 4 ? "grid-cols-4" : columns === 3 ? "grid-cols-3" : "grid-cols-2"}`;

export const TAB_TRIGGER_CLASS =
	"flex min-h-9 items-center justify-center gap-1.5 rounded-[var(--npb-radius-input)] px-2 py-2 text-sm font-medium text-npb-text-muted transition-colors hover:bg-npb-interactive-bg-hover hover:text-npb-text-primary data-[state=active]:bg-npb-interactive-bg-active data-[state=active]:text-npb-interactive-text-active";
