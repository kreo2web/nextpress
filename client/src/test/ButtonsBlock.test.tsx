import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import ButtonsBlock from "../components/PageBuilder/blocks/buttons/ButtonsBlock";
import type { BlockConfig, BlockContent } from "@shared/schema-types";

const ButtonsSettings = ButtonsBlock.settings;

if (!ButtonsSettings) {
  throw new Error("Buttons block is missing settings");
}

type ButtonItem = {
  id: string;
  text: string;
  url: string;
  linkTarget?: "_self" | "_blank";
  rel?: string;
  title?: string;
  className?: string;
};

type ButtonsData = {
  buttons?: ButtonItem[];
  layout?: string;
  orientation?: string;
  className?: string;
};

const DEFAULT_BUTTON: ButtonItem = {
  id: "btn-1",
  text: "Click Me",
  url: "#",
  linkTarget: "_self",
  rel: "",
  title: "",
  className: "",
};

const DEFAULT_DATA: ButtonsData = {
  buttons: [DEFAULT_BUTTON],
  layout: "flex-start",
  orientation: "horizontal",
  className: "",
};

function buttonsContent(data: ButtonsData): BlockContent {
  return { kind: "structured", data };
}

function createButtonsBlock(data: ButtonsData = {}): BlockConfig {
  return {
    id: "test-buttons",
    name: "core/buttons",
    type: "block",
    parentId: null,
    label: "Buttons",
    content: buttonsContent({ ...DEFAULT_DATA, ...data }),
    styles: {},
    children: [],
    settings: {},
  };
}

function readStructuredData(content: BlockContent | undefined): ButtonsData {
  if (!content || typeof content !== "object" || content.kind !== "structured") {
    return {};
  }
  return content.data as ButtonsData;
}

describe("ButtonsBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("block definition", () => {
    it("describes a row of buttons", () => {
      expect(ButtonsBlock.id).toBe("core/buttons");
      expect(ButtonsBlock.description).toBe("A row of buttons");
    });
  });

  describe("settings", () => {
    it("uses one section of chips, named remove, and no Settings card", () => {
      render(<ButtonsSettings block={createButtonsBlock()} onUpdate={vi.fn()} />);

      expect(screen.queryByText("Settings")).not.toBeInTheDocument();
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
      expect(screen.getByRole("radiogroup", { name: "Alignment" })).toBeInTheDocument();
      expect(screen.getByRole("radiogroup", { name: "Direction" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Left" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Center" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Right" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Space between" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Row" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Stack" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Same window" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "New window" })).toBeInTheDocument();

      const remove = screen.getByRole("button", { name: "Remove button 1" });
      expect(remove).toHaveClass("h-9", "w-9");
      expect(remove.className).not.toMatch(/text-red-600/);
      expect(remove.className).not.toMatch(/status-error/);
    });

    it("writes alignment as flex-start | center | flex-end | space-between", () => {
      const onUpdate = vi.fn();
      render(<ButtonsSettings block={createButtonsBlock()} onUpdate={onUpdate} />);
      const alignment = screen.getByRole("radiogroup", { name: "Alignment" });

      fireEvent.click(within(alignment).getByRole("radio", { name: "Center" }));
      expect(readStructuredData(onUpdate.mock.calls.at(-1)?.[0].content).layout).toBe("center");

      fireEvent.click(within(alignment).getByRole("radio", { name: "Right" }));
      expect(readStructuredData(onUpdate.mock.calls.at(-1)?.[0].content).layout).toBe("flex-end");

      fireEvent.click(within(alignment).getByRole("radio", { name: "Space between" }));
      expect(readStructuredData(onUpdate.mock.calls.at(-1)?.[0].content).layout).toBe(
        "space-between",
      );

      fireEvent.click(within(alignment).getByRole("radio", { name: "Left" }));
      expect(readStructuredData(onUpdate.mock.calls.at(-1)?.[0].content).layout).toBe("flex-start");
    });

    it("writes direction as horizontal | vertical", () => {
      const onUpdate = vi.fn();
      render(<ButtonsSettings block={createButtonsBlock()} onUpdate={onUpdate} />);
      const direction = screen.getByRole("radiogroup", { name: "Direction" });

      fireEvent.click(within(direction).getByRole("radio", { name: "Stack" }));
      expect(readStructuredData(onUpdate.mock.calls.at(-1)?.[0].content).orientation).toBe(
        "vertical",
      );

      fireEvent.click(within(direction).getByRole("radio", { name: "Row" }));
      expect(readStructuredData(onUpdate.mock.calls.at(-1)?.[0].content).orientation).toBe(
        "horizontal",
      );
    });

    it("stores linkTarget as _self | _blank", () => {
      const onUpdate = vi.fn();
      render(<ButtonsSettings block={createButtonsBlock()} onUpdate={onUpdate} />);

      fireEvent.click(screen.getByRole("button", { name: "New window" }));
      expect(readStructuredData(onUpdate.mock.calls.at(-1)?.[0].content).buttons?.[0]?.linkTarget).toBe(
        "_blank",
      );

      fireEvent.click(screen.getByRole("button", { name: "Same window" }));
      expect(readStructuredData(onUpdate.mock.calls.at(-1)?.[0].content).buttons?.[0]?.linkTarget).toBe(
        "_self",
      );
    });
  });
});
