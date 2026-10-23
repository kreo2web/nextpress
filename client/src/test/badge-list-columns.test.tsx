import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BlockConfig } from "@shared/schema-types";
import { BADGE_CSS } from "@shared/blocks/badge-css";
import { LIST_MARKERS_CSS, readListMarker } from "@shared/blocks/list-markers-css";
import { COLUMNS_EXTRAS_CSS } from "@shared/blocks/columns-extras-css";
import { BadgeBlock as PublishedBadge } from "../../../renderer/react/design/badge";
import { ListBlock as PublishedList } from "../../../renderer/react/advanced";
import { ColumnsBlock as PublishedColumns } from "../../../renderer/react/layout";
import CanvasBadgeDefinition from "../components/PageBuilder/blocks/badge/BadgeBlock";
import { BadgeSettings } from "../components/PageBuilder/blocks/badge/badge-settings";
import CanvasListDefinition from "../components/PageBuilder/blocks/list/ListBlock";
import CanvasColumnsDefinition from "../components/PageBuilder/blocks/columns/ColumnsBlock";
import { ColumnsSettings } from "../components/PageBuilder/blocks/columns/columns-settings";

/** Saved fields in these tests are always strings or booleans, matching what the editor writes. */
type SavedFields = Record<string, string | boolean>;

const CanvasBadge = CanvasBadgeDefinition.component;
const CanvasList = CanvasListDefinition.component;
const CanvasColumns = CanvasColumnsDefinition.component;
const ListSettings = CanvasListDefinition.settings;
if (!CanvasBadge || !CanvasList || !CanvasColumns || !ListSettings) {
  throw new Error("Badge, list or columns block is missing its canvas or settings component");
}

function badgeBlock(data: SavedFields): BlockConfig {
  return { id: "badge-1", name: "core/badge", type: "block", parentId: null, content: { kind: "structured", data }, styles: {}, settings: {} };
}

function listBlock(data: SavedFields): BlockConfig {
  return { id: "list-1", name: "core/list", type: "block", parentId: null, content: { kind: "structured", data }, styles: {}, settings: {} };
}

function columnsBlock(data: SavedFields): BlockConfig {
  return {
    id: "columns-1",
    name: "core/columns",
    type: "container",
    parentId: null,
    content: { kind: "structured", data: { layoutMode: "flex", ...data } },
    styles: {},
    settings: { columnLayout: [{ columnId: "col-1", width: "50%", blockIds: [] }, { columnId: "col-2", width: "50%", blockIds: [] }] },
    children: [],
  };
}

describe("Badge block", () => {
  it("publishes the pill markup with its tone and look", () => {
    const html = renderToStaticMarkup(<PublishedBadge {...badgeBlock({ text: "Pricing", tone: "success", look: "outline" })} />);

    expect(html).toContain('class="np-badge np-badge--outline"');
    expect(html).toContain('data-tone="success"');
    expect(html).toContain(">Pricing</span>");
  });

  it("falls back to the accent tone and soft look for unknown saved values", () => {
    const html = renderToStaticMarkup(<PublishedBadge {...badgeBlock({ text: "New", tone: "purple", look: "glow" })} />);

    expect(html).toContain('data-tone="accent"');
    expect(html).toContain("np-badge--soft");
  });

  it("draws the canvas pill with the same classes as the published one", () => {
    const { container } = render(<CanvasBadge value={badgeBlock({ text: "Beta", tone: "warning", look: "solid" })} onChange={vi.fn()} />);
    const pill = container.querySelector("span.np-badge");

    expect(pill).toHaveClass("np-badge", "np-badge--solid");
    expect(pill).toHaveAttribute("data-tone", "warning");
    expect(pill).toHaveTextContent("Beta");
  });

  it("saves the text, tone and look chosen in the settings panel", () => {
    const onUpdate = vi.fn();
    render(<BadgeSettings block={badgeBlock({ text: "New", tone: "accent", look: "soft" })} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByRole("radio", { name: "Danger" }));
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: expect.objectContaining({ data: expect.objectContaining({ tone: "danger" }) }) }),
    );

    fireEvent.click(screen.getByRole("radio", { name: "Outline" }));
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: expect.objectContaining({ data: expect.objectContaining({ look: "outline" }) }) }),
    );

    fireEvent.change(screen.getByLabelText("Text"), { target: { value: "Sale" } });
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: expect.objectContaining({ data: expect.objectContaining({ text: "Sale" }) }) }),
    );
  });

  it("ships the four tone colours and the three looks in its CSS", () => {
    for (const tone of ["neutral", "success", "warning", "danger"]) {
      expect(BADGE_CSS).toContain(`.np-badge[data-tone="${tone}"]`);
    }
    expect(BADGE_CSS).toContain("--npb-accent");
    expect(BADGE_CSS).toContain(".np-badge--soft");
    expect(BADGE_CSS).toContain(".np-badge--outline");
    expect(BADGE_CSS).toContain(".np-badge--solid");
    expect(BADGE_CSS).toContain("border-radius: 999px");
  });
});

describe("List markers", () => {
  it("accepts only the known markers and falls back to the browser bullet", () => {
    expect(readListMarker("check")).toBe("check");
    expect(readListMarker("dash")).toBe("dash");
    expect(readListMarker("bogus")).toBe("default");
    expect(readListMarker(undefined)).toBe("default");
  });

  it("publishes a class for a custom marker and keeps the browser bullet for the default", () => {
    const checked = renderToStaticMarkup(<PublishedList {...listBlock({ ordered: false, values: "<li>One</li><li>Two</li>", marker: "check" })} />);
    const plain = renderToStaticMarkup(<PublishedList {...listBlock({ ordered: false, values: "<li>One</li>", marker: "default" })} />);

    expect(checked).toContain("np-list--check");
    expect(checked).not.toContain("list-style-type:disc");
    expect(plain).not.toContain("np-list--");
    expect(plain).toContain("list-style-type:disc");
  });

  it("never applies a custom marker to a numbered list", () => {
    const html = renderToStaticMarkup(<PublishedList {...listBlock({ ordered: true, values: "<li>One</li>", marker: "arrow" })} />);

    expect(html).toContain("<ol");
    expect(html).not.toContain("np-list--");
  });

  it("reads the marker from the saved structured content the catalog writes", () => {
    const html = renderToStaticMarkup(<PublishedList {...listBlock({ ordered: false, values: "<li>One</li>", marker: "dash" })} />);

    expect(html).toContain("np-list--dash");
  });

  it("draws the canvas list with the same marker class", () => {
    const { container } = render(<CanvasList value={listBlock({ ordered: false, values: "<li>One</li>", marker: "arrow" })} onChange={vi.fn()} />);

    expect(container.querySelector("ul")).toHaveClass("wp-block-list", "np-list--arrow");
  });

  it("offers marker chips for bullets, and hides Bullet Style once a custom marker is set", () => {
    const onUpdate = vi.fn();
    const { unmount } = render(<ListSettings block={listBlock({ ordered: false, values: "<li>One</li>", marker: "default" })} onUpdate={onUpdate} />);

    expect(screen.getByText("Bullet Style")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Check" }));
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: expect.objectContaining({ data: expect.objectContaining({ marker: "check" }) }) }),
    );
    unmount();

    render(<ListSettings block={listBlock({ ordered: false, values: "<li>One</li>", marker: "check" })} onUpdate={onUpdate} />);
    expect(screen.queryByText("Bullet Style")).not.toBeInTheDocument();
  });

  it("ships a drawn check, a text arrow and dash, and no bullet for none", () => {
    expect(LIST_MARKERS_CSS).toContain(".wp-block-list.np-list--check > li::before");
    expect(LIST_MARKERS_CSS).toContain('content: "→"');
    expect(LIST_MARKERS_CSS).toContain('content: "–"');
    expect(LIST_MARKERS_CSS).toMatch(/\.wp-block-list\.np-list--none \{\s*list-style: none;\s*padding-left: 0;/);
  });
});

describe("Columns reverse on phones", () => {
  it("publishes the reversed class only when the switch is on", () => {
    const on = renderToStaticMarkup(<PublishedColumns {...columnsBlock({ reverseOnPhones: true })} />);
    const off = renderToStaticMarkup(<PublishedColumns {...columnsBlock({ reverseOnPhones: false })} />);

    expect(on).toContain("is-reversed-on-phones");
    expect(off).not.toContain("is-reversed-on-phones");
  });

  it("adds the reversed class to the canvas columns", () => {
    const { container } = render(
      <CanvasColumns value={columnsBlock({ reverseOnPhones: true })} onChange={vi.fn()} isPreview />,
    );

    expect(container.querySelector(".wp-block-columns")).toHaveClass("is-reversed-on-phones");
  });

  it("reverses stacked columns only at phone width, in both the page and the editor preview", () => {
    expect(COLUMNS_EXTRAS_CSS).toContain("@media (max-width: 767px)");
    expect(COLUMNS_EXTRAS_CSS).toContain("@container npb-canvas (max-width: 767px)");
    expect(COLUMNS_EXTRAS_CSS.match(/flex-direction: column-reverse !important;/g)).toHaveLength(2);
    expect(COLUMNS_EXTRAS_CSS).toContain(".npb-canvas-page .wp-block-columns.is-reversed-on-phones");
  });

  it("saves the reverse switch from the Row layout section", () => {
    const onUpdate = vi.fn();
    render(<ColumnsSettings block={columnsBlock({ reverseOnPhones: false })} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByRole("button", { name: /Row layout/ }));
    const toggle = screen.getByRole("switch", { name: "Reverse order on phones" });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(toggle);
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: expect.objectContaining({ data: expect.objectContaining({ reverseOnPhones: true }) }) }),
    );
  });
});
