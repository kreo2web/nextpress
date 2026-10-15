import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import QuoteBlock from "../components/PageBuilder/blocks/quote/QuoteBlock";
import type { BlockConfig, BlockContent } from "@shared/schema-types";

const QuoteSettings = QuoteBlock.settings;
const QuoteCanvas = QuoteBlock.component;

if (!QuoteSettings) {
  throw new Error("Quote block is missing settings");
}

if (!QuoteCanvas) {
  throw new Error("Quote block is missing canvas component");
}

function quoteData(data: Record<string, string>): BlockContent {
  return { kind: "structured", data };
}

function createQuoteBlock(data: Record<string, string> = {}): BlockConfig {
  return {
    id: "test-quote",
    name: "core/quote",
    type: "block",
    parentId: null,
    label: "Quote",
    content: quoteData({
      value: "<p>Add a quote</p>",
      citation: "",
      ...data,
    }),
    styles: {},
    children: [],
    settings: {},
  };
}

function readStructuredValue(content: BlockContent | undefined): string {
  if (!content || typeof content !== "object" || content.kind !== "structured") {
    return "";
  }
  const value = content.data.value;
  return typeof value === "string" ? value : "";
}

describe("QuoteBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("blank lines", () => {
    it("saves Enter as an empty paragraph and reads it back in the sidebar", () => {
      const onUpdate = vi.fn();
      const { rerender } = render(
        <QuoteSettings block={createQuoteBlock()} onUpdate={onUpdate} />,
      );

      fireEvent.change(screen.getByLabelText("Quote text"), {
        target: { value: "First\n\nSecond" },
      });

      expect(onUpdate).toHaveBeenCalledWith({
        content: {
          kind: "structured",
          data: {
            value: "<p>First</p><p></p><p>Second</p>",
            citation: "",
          },
        },
      });

      const saved = onUpdate.mock.calls[0][0] as { content: BlockContent };
      rerender(
        <QuoteSettings
          block={createQuoteBlock({ value: readStructuredValue(saved.content) })}
          onUpdate={onUpdate}
        />,
      );

      expect(screen.getByLabelText("Quote text")).toHaveValue("First\n\nSecond");
    });

    it("reads empty <p></p> and <p><br></p> as blank lines", () => {
      render(
        <QuoteSettings
          block={createQuoteBlock({
            value: "<p>First</p><p></p><p>Second</p><p><br></p><p>Third</p>",
          })}
          onUpdate={vi.fn()}
        />,
      );

      expect(screen.getByLabelText("Quote text")).toHaveValue(
        "First\n\nSecond\n\nThird",
      );
    });

    it("keeps a blank line in the canvas editor after Enter", () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <QuoteCanvas
          value={createQuoteBlock({ value: "<p>First</p>" })}
          onChange={onChange}
          isEditing
        />,
      );

      fireEvent.change(screen.getByPlaceholderText("Add a quote"), {
        target: { value: "First\n\nSecond" },
      });

      const updated = onChange.mock.calls[0][0] as BlockConfig;
      expect(readStructuredValue(updated.content)).toBe(
        "<p>First</p><p></p><p>Second</p>",
      );

      rerender(
        <QuoteCanvas value={updated} onChange={onChange} isEditing />,
      );
      expect(screen.getByPlaceholderText("Add a quote")).toHaveValue(
        "First\n\nSecond",
      );
    });
  });

  describe("settings chips", () => {
    it("uses one section of chips and no Settings card", () => {
      render(<QuoteSettings block={createQuoteBlock()} onUpdate={vi.fn()} />);

      expect(screen.queryByText("Settings")).not.toBeInTheDocument();
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
      expect(screen.getByRole("radiogroup", { name: "Alignment" })).toBeInTheDocument();
      expect(screen.getByRole("radiogroup", { name: "Width" })).toBeInTheDocument();
    });

    it("clears alignment with null and drops an old content.textAlign", () => {
      const onUpdate = vi.fn();
      render(
        <QuoteSettings
          block={{
            ...createQuoteBlock({ textAlign: "center" }),
            styles: { textAlign: "right" },
          }}
          onUpdate={onUpdate}
        />,
      );

      fireEvent.click(
        within(screen.getByRole("radiogroup", { name: "Alignment" })).getByRole(
          "radio",
          { name: "Default" },
        ),
      );

      expect(onUpdate).toHaveBeenCalledWith({
        styles: { textAlign: null },
      });
      expect(onUpdate).toHaveBeenCalledWith({
        content: {
          kind: "structured",
          data: {
            value: "<p>Add a quote</p>",
            citation: "",
            textAlign: null,
          },
        },
      });
    });

    it("writes left alignment on styles", () => {
      const onUpdate = vi.fn();
      render(<QuoteSettings block={createQuoteBlock()} onUpdate={onUpdate} />);

      fireEvent.click(
        within(screen.getByRole("radiogroup", { name: "Alignment" })).getByRole(
          "radio",
          { name: "Left" },
        ),
      );

      expect(onUpdate).toHaveBeenCalledWith({
        styles: { textAlign: "left" },
      });
    });

    it("writes wide and full on content.align, and Default clears it", () => {
      const onUpdate = vi.fn();
      render(<QuoteSettings block={createQuoteBlock()} onUpdate={onUpdate} />);
      const width = screen.getByRole("radiogroup", { name: "Width" });

      fireEvent.click(within(width).getByRole("radio", { name: "Wide" }));
      expect(onUpdate).toHaveBeenCalledWith({
        content: {
          kind: "structured",
          data: {
            value: "<p>Add a quote</p>",
            citation: "",
            align: "wide",
          },
        },
      });

      fireEvent.click(within(width).getByRole("radio", { name: "Full" }));
      expect(onUpdate).toHaveBeenCalledWith({
        content: {
          kind: "structured",
          data: {
            value: "<p>Add a quote</p>",
            citation: "",
            align: "full",
          },
        },
      });

      fireEvent.click(within(width).getByRole("radio", { name: "Default" }));
      expect(onUpdate).toHaveBeenCalledWith({
        content: {
          kind: "structured",
          data: {
            value: "<p>Add a quote</p>",
            citation: "",
            align: null,
          },
        },
      });
    });
  });
});
