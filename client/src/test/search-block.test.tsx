import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BlockConfig } from "@shared/schema-types";
import { SEARCH_CSS } from "@shared/blocks/search-css";
import { PUBLISH_BLOCK_CSS } from "@shared/publish-block-css";
import { createDefaultBlock } from "@shared/block-catalog";
import { SearchBlock as PublishedSearch } from "../../../renderer/react/search";
import CanvasSearchDefinition from "../components/PageBuilder/blocks/search/SearchBlock";
import { SearchSettings } from "../components/PageBuilder/blocks/search/search-settings";
import { buildPublishedPageHtml } from "../../../server/routes/shared/build-published-page-html";

const CanvasSearch = CanvasSearchDefinition.component;
if (!CanvasSearch) throw new Error("Search block is missing its canvas component");

const searchBlock = (data: Record<string, string>): BlockConfig => ({
  id: "search-1",
  name: "core/search",
  type: "block",
  parentId: null,
  content: { kind: "structured", data },
  styles: {},
  settings: {},
});

describe("Search block", () => {
  it("publishes a button with its label, hint and shortcut", () => {
    const html = renderToStaticMarkup(<PublishedSearch {...searchBlock({ label: "Find a page", placeholder: "Type a word" })} />);
    expect(html).toContain('data-np-search=""');
    expect(html).toContain('data-placeholder="Type a word"');
    expect(html).toContain(">Find a page</span>");
    expect(html).toContain("Ctrl K");
  });

  it("falls back to the default words when nothing is saved", () => {
    const html = renderToStaticMarkup(<PublishedSearch {...searchBlock({})} />);
    expect(html).toContain(">Search</span>");
    expect(html).toContain('data-placeholder="Search this site"');
  });

  it("draws the same button in the editor", () => {
    const { container } = render(<CanvasSearch value={searchBlock({ label: "Find a page" })} onChange={vi.fn()} />);
    const button = container.querySelector("button.np-search");
    expect(button).toHaveTextContent("Find a page");
    expect(button).toHaveAttribute("data-np-search");
    expect(container.querySelector(".wp-block-search")).not.toBeNull();
  });

  it("lets the author change the button text and the hint", () => {
    const onUpdate = vi.fn();
    render(<SearchSettings block={searchBlock({})} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByLabelText("Button text"), { target: { value: "Docs search" } });
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: expect.objectContaining({ data: expect.objectContaining({ label: "Docs search" }) }) }),
    );
    fireEvent.change(screen.getByLabelText("Hint in the search box"), { target: { value: "Find a guide" } });
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: expect.objectContaining({ data: expect.objectContaining({ placeholder: "Find a guide" }) }) }),
    );
  });

  it("starts from the catalog defaults and ships its styles on published pages", () => {
    expect(createDefaultBlock({ name: "core/search", id: "s", newId: () => "x" })?.content).toEqual({ kind: "structured", data: { label: "Search", placeholder: "Search this site" } });
    expect(PUBLISH_BLOCK_CSS).toContain(SEARCH_CSS);
    expect(SEARCH_CSS).toContain("prefers-reduced-motion");
  });

  it("loads the search script only on pages that have the block", () => {
    const build = (blocks: BlockConfig[]): string =>
      buildPublishedPageHtml({
        page: { id: "p", title: "Docs", blocks, other: { seo: {}, design: {} } } as Parameters<typeof buildPublishedPageHtml>[0]["page"],
        canonicalUrl: "http://localhost:5000/docs",
      });
    expect(build([searchBlock({})])).toContain('<script src="/vendor/search.js"></script>');
    expect(build([])).not.toContain("/vendor/search.js");
  });
});
