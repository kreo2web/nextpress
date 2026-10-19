import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { CoverSettings } from "../components/PageBuilder/blocks/cover/cover-settings";
import { type CoverData } from "../components/PageBuilder/blocks/cover/cover-model";
import { COVER_DEFAULT_DATA as DEFAULT_DATA } from "@shared/block-catalog/media-blocks";
import type { BlockConfig, BlockContent } from "@shared/schema-types";

vi.mock("../components/PageBuilder/blocks/shared/media-url-field", () => ({
  MediaUrlField: () => null,
}));

const DEFAULT_TITLE_HTML =
  '<p style="font-size: 2.5em; font-weight: bold;">Write title…</p>';

function coverContent(data: CoverData): BlockContent {
  return { kind: "structured", data };
}

function createCoverBlock(data: CoverData = {}): BlockConfig {
  return {
    id: "test-cover",
    name: "core/cover",
    type: "block",
    parentId: null,
    label: "Cover",
    content: coverContent(data),
    styles: {},
    children: [],
    settings: {},
  };
}

function readStructuredData(content: BlockContent | undefined): CoverData {
  if (!content || typeof content !== "object" || content.kind !== "structured") {
    return {};
  }
  return content.data;
}

describe("CoverSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("title", () => {
    it("edits a default styled paragraph as plain text and keeps the opening tag", () => {
      const onUpdate = vi.fn();
      const { rerender } = render(
        <CoverSettings
          block={createCoverBlock({ innerContent: DEFAULT_DATA.innerContent })}
          onUpdate={onUpdate}
        />,
      );

      const title = screen.getByLabelText("Title");
      expect(title).toHaveValue("Write title…");
      expect(title).toHaveAttribute("placeholder", "Write title…");
      expect(screen.queryByText("Cover Content")).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/HTML allowed/i)).not.toBeInTheDocument();
      expect(
        screen.queryByText("This title has formatting. Editing here keeps the tags."),
      ).not.toBeInTheDocument();

      fireEvent.change(title, { target: { value: "Hello city" } });

      expect(onUpdate).toHaveBeenCalledTimes(1);
      const saved = onUpdate.mock.calls[0][0] as { content: BlockContent };
      expect(readStructuredData(saved.content).innerContent).toBe(
        '<p style="font-size: 2.5em; font-weight: bold;">Hello city</p>',
      );

      rerender(
        <CoverSettings
          block={createCoverBlock({
            innerContent: readStructuredData(saved.content).innerContent,
          })}
          onUpdate={onUpdate}
        />,
      );
      expect(screen.getByLabelText("Title")).toHaveValue("Hello city");
    });

    it("saves an empty line as a break inside the same opening tag", () => {
      const onUpdate = vi.fn();
      render(
        <CoverSettings
          block={createCoverBlock({ innerContent: DEFAULT_TITLE_HTML })}
          onUpdate={onUpdate}
        />,
      );

      fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "Hello\n\nCity" },
      });

      const saved = onUpdate.mock.calls[0][0] as { content: BlockContent };
      expect(readStructuredData(saved.content).innerContent).toBe(
        '<p style="font-size: 2.5em; font-weight: bold;">Hello</p><p style="font-size: 2.5em; font-weight: bold;"><br></p><p style="font-size: 2.5em; font-weight: bold;">City</p>',
      );
    });

    it("joins multiple paragraphs with newlines and wraps each line in a plain p", () => {
      const onUpdate = vi.fn();
      render(
        <CoverSettings
          block={createCoverBlock({
            innerContent: "<p>First</p><p>Second</p>",
          })}
          onUpdate={onUpdate}
        />,
      );

      expect(screen.getByLabelText("Title")).toHaveValue("First\nSecond");

      fireEvent.change(screen.getByLabelText("Title"), {
        target: { value: "One\nTwo" },
      });

      const saved = onUpdate.mock.calls[0][0] as { content: BlockContent };
      expect(readStructuredData(saved.content).innerContent).toBe("<p>One</p><p>Two</p>");
    });

    it("keeps stored HTML when the title has tags other than p and br", () => {
      const onUpdate = vi.fn();
      const stored = "<p>Visit <a href=\"/about\">us</a></p>";
      render(
        <CoverSettings
          block={createCoverBlock({ innerContent: stored })}
          onUpdate={onUpdate}
        />,
      );

      const title = screen.getByLabelText("Title");
      expect(title).toHaveValue(stored);
      expect(
        screen.getByText("This title has formatting. Editing here keeps the tags."),
      ).toBeInTheDocument();

      fireEvent.change(title, {
        target: { value: "<p>Visit <strong>us</strong></p>" },
      });

      const saved = onUpdate.mock.calls[0][0] as { content: BlockContent };
      expect(readStructuredData(saved.content).innerContent).toBe(
        "<p>Visit <strong>us</strong></p>",
      );
    });
  });

  describe("overlay colour", () => {
    it("writes ColorField style onto customOverlayColor and Theme clears with null", () => {
      const onUpdate = vi.fn();
      render(
        <CoverSettings
          block={createCoverBlock({ customOverlayColor: "#000000" })}
          onUpdate={onUpdate}
        />,
      );

      expect(document.getElementById("cover-overlay-color")).toBeNull();
      const overlay = screen.getByRole("group", { name: /^Overlay$/ });
      expect(within(overlay).getByRole("button", { name: "Theme" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );

      fireEvent.click(within(overlay).getByRole("button", { name: "red-500" }));
      const afterPick = onUpdate.mock.calls[0][0] as { content: BlockContent };
      expect(readStructuredData(afterPick.content).customOverlayColor).toMatch(/^#/);
      expect(readStructuredData(afterPick.content).customOverlayColor).not.toBe("");

      fireEvent.click(within(overlay).getByRole("button", { name: "Theme" }));
      const afterTheme = onUpdate.mock.calls[1][0] as { content: BlockContent };
      expect(readStructuredData(afterTheme.content).customOverlayColor).toBeNull();
    });
  });
});
