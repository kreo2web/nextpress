import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { TableBlock, CodeBlock } from "../../../renderer/react/advanced";
import { TableSettings } from "../components/PageBuilder/blocks/table/table-settings";
import CanvasTableBlock from "../components/PageBuilder/blocks/table/TableBlock";
import type { BlockConfig } from "@shared/schema-types";

const CanvasTable = CanvasTableBlock.component;

if (!CanvasTable) {
  throw new Error("Table block is missing canvas component");
}

describe("renderer/react/advanced TableBlock", () => {
  it("renders structured table data with headers and body rows properly", () => {
    const block: BlockConfig = {
      id: "table-1",
      name: "core/table",
      type: "block",
      parentId: null,
      content: {
        kind: "structured",
        data: {
          head: [
            {
              cells: [
                { content: "Product", tag: "th" },
                { content: "Price", tag: "th" },
              ],
            },
          ],
          body: [
            {
              cells: [
                { content: "Coffee", tag: "td" },
                { content: "$4.00", tag: "td" },
              ],
            },
            {
              cells: [
                { content: "Tea", tag: "td" },
                { content: "$3.00", tag: "td" },
              ],
            },
          ],
          caption: "Menu Prices",
          striped: true,
        },
      },
    };

    const { container } = render(<TableBlock {...block} />);
    const table = container.querySelector("table");
    expect(table).not.toBeNull();

    const headers = container.querySelectorAll("th");
    expect(headers.length).toBe(2);
    expect(headers[0].textContent).toBe("Product");
    expect(headers[1].textContent).toBe("Price");

    const cells = container.querySelectorAll("tbody td");
    expect(cells.length).toBe(4);
    expect(cells[0].textContent).toBe("Coffee");
    expect(cells[1].textContent).toBe("$4.00");

    const caption = container.querySelector("caption");
    expect(caption?.textContent).toBe("Menu Prices");

    const wrap = table?.parentElement;
    expect(wrap?.style.overflowX).toBe("auto");
    expect(wrap?.style.maxWidth).toBe("100%");
    expect(headers[0].style.overflowWrap).toBe("break-word");
    expect(headers[0].style.minWidth).toBe("6rem");
  });

  it("scrolls a wide table inside a wrapper instead of stretching the page", () => {
    const block: BlockConfig = {
      id: "table-wide",
      name: "core/table",
      type: "block",
      parentId: null,
      content: {
        kind: "structured",
        data: {
          head: [
            {
              cells: [
                { content: "One", tag: "th" },
                { content: "Two", tag: "th" },
                { content: "Three", tag: "th" },
                { content: "Four", tag: "th" },
                { content: "Five", tag: "th" },
                { content: "Six", tag: "th" },
              ],
            },
          ],
          body: [
            {
              cells: [
                { content: "A", tag: "td" },
                { content: "B", tag: "td" },
                { content: "C", tag: "td" },
                { content: "D", tag: "td" },
                { content: "E", tag: "td" },
                { content: "F", tag: "td" },
              ],
            },
          ],
        },
      },
    };

    const { container } = render(<TableBlock {...block} />);
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(table?.parentElement?.style.overflowX).toBe("auto");
    expect(table?.parentElement?.style.maxWidth).toBe("100%");
  });

  it("maintains backward compatibility with legacy headers and rows arrays", () => {
    const block: BlockConfig = {
      id: "table-legacy",
      name: "core/table",
      type: "block",
      parentId: null,
      content: {
        kind: "structured",
        data: {
          headers: ["Col 1", "Col 2"],
          rows: [
            ["A1", "A2"],
            ["B1", "B2"],
          ],
        },
      },
    };

    const { container } = render(<TableBlock {...block} />);
    const ths = container.querySelectorAll("th");
    expect(ths.length).toBe(2);
    expect(ths[0].textContent).toBe("Col 1");

    const tds = container.querySelectorAll("tbody td");
    expect(tds.length).toBe(4);
    expect(tds[0].textContent).toBe("A1");
  });
});

describe("table settings and canvas", () => {
  function createEditorTableBlock(): BlockConfig {
    return {
      id: "test-table",
      name: "core/table",
      type: "block",
      parentId: null,
      label: "Table",
      content: {
        kind: "structured",
        data: {
          head: [{ cells: [{ content: "Header 1", tag: "th" }] }],
          body: [
            { cells: [{ content: "Cell 1", tag: "td" }] },
            { cells: [{ content: "Cell 2", tag: "td" }] },
          ],
          foot: [],
          compact: false,
        },
      },
      styles: {},
      children: [],
      settings: {},
    };
  }

  it("renames cards, keeps Cells Data, and uses a named ghost row delete", () => {
    render(<TableSettings block={createEditorTableBlock()} onUpdate={vi.fn()} />);

    expect(screen.queryByText("Table Layout")).not.toBeInTheDocument();
    expect(screen.queryByText("Styles & Options")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rows and columns" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Look" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cells Data" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Compact padding" })).toBeInTheDocument();

    const remove = screen.getByRole("button", { name: "Remove row 1" });
    expect(remove).toHaveClass("h-9", "w-9");
    expect(remove.className).not.toMatch(/text-red-600/);
    expect(remove.className).not.toMatch(/status-error/);
    expect(screen.getByRole("button", { name: "Remove row 2" })).toBeInTheDocument();
  });

  it("wraps the canvas table so it can scroll sideways", () => {
    const { container } = render(
      <CanvasTable value={createEditorTableBlock()} onChange={vi.fn()} />,
    );
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(table?.parentElement).toHaveClass("overflow-x-auto", "max-w-full");
  });
});

describe("renderer/react/advanced CodeBlock", () => {
  it("renders code block with language class and formatting", () => {
    const block: BlockConfig = {
      id: "code-1",
      name: "core/code",
      type: "block",
      parentId: null,
      content: {
        kind: "structured",
        data: {
          content: "const a = 1;\nconst b = 2;",
          language: "typescript",
          showLineNumbers: true,
        },
      },
    };

    const { container } = render(<CodeBlock {...block} />);
    const figure = container.querySelector(".wp-block-code > figure.np-code");
    expect(figure).not.toBeNull();
    expect(figure?.getAttribute("data-language")).toBe("typescript");
    expect(figure?.hasAttribute("data-line-numbers")).toBe(true);
    expect(container.querySelector(".np-code-language")?.textContent).toBe("TypeScript");
    expect(container.querySelector("pre code .kirari-keyword")?.textContent).toBe("const");
    expect(container.textContent).toContain("const a = 1;");
  });

  it("renders a copy button when showCopyButton is enabled", () => {
    const block: BlockConfig = {
      id: "code-2",
      name: "core/code",
      type: "block",
      parentId: null,
      content: {
        kind: "structured",
        data: {
          content: "const a = 1;",
          language: "javascript",
          showCopyButton: true,
        },
      },
    };

    const { container } = render(<CodeBlock {...block} />);
    const copyBtn = container.querySelector("button");
    expect(copyBtn).not.toBeNull();
    expect(copyBtn?.textContent).toContain("Copy");
    // Published pages run no React: /vendor/code.js finds the button by this attribute.
    expect(copyBtn?.hasAttribute("data-np-copy")).toBe(true);
  });

  it("lets long unwrapped lines scroll (no wrap flag) and keeps max-width 100%", () => {
    const block: BlockConfig = {
      id: "code-nowrap",
      name: "core/code",
      type: "block",
      parentId: null,
      content: {
        kind: "structured",
        data: {
          content: "const a = 1;",
          language: "javascript",
          wrapLines: false,
        },
      },
      styles: { maxWidth: "" },
    };

    const { container } = render(<CodeBlock {...block} />);
    expect(container.querySelector("figure.np-code")?.hasAttribute("data-wrap")).toBe(false);
    expect(container.querySelector<HTMLElement>(".wp-block-code")?.style.maxWidth).toBe("100%");
  });

  it("keeps a saved non-empty maxWidth on the published block", () => {
    const block: BlockConfig = {
      id: "code-maxwidth",
      name: "core/code",
      type: "block",
      parentId: null,
      content: {
        kind: "structured",
        data: {
          content: "const a = 1;",
          language: "javascript",
          wrapLines: true,
        },
      },
      styles: { maxWidth: "40rem" },
    };

    const { container } = render(<CodeBlock {...block} />);
    expect(container.querySelector("figure.np-code")?.hasAttribute("data-wrap")).toBe(true);
    expect(container.querySelector<HTMLElement>(".wp-block-code")?.style.maxWidth).toBe("40rem");
  });
});
