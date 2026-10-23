import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BlockConfig } from "@shared/schema-types";
// Load the renderer entry first: the renderer modules import each other through the block table.
import { getBlockComponent } from "../../../renderer/react/render-helpers";
import { LOGO_CLOUD_CSS } from "@shared/blocks/logo-cloud-css";
import { BlockActionsProvider, type BlockActionsContextValue } from "@/components/PageBuilder/BlockActionsContext";
import { blockRegistry } from "@/components/PageBuilder/blocks";
import { LogoCloudSettings } from "@/components/PageBuilder/blocks/logo-cloud/logo-cloud-settings";

vi.mock("@/components/media/MediaPickerDialog", () => ({
  default: ({ open, onSelect }: { open: boolean; onSelect: (item: { id: string; url: string; alt: string }) => void }) =>
    open ? (
      <button type="button" onClick={() => onSelect({ id: "m1", url: "/uploads/new.png", alt: "New Co" })}>
        pick-from-library
      </button>
    ) : null,
}));

const stubActions: BlockActionsContextValue = {
  selectedBlockId: null,
  editingBlockId: null,
  hoveredBlockId: null,
  onSelect: () => {},
  onStartEditing: () => {},
  onStopEditing: () => {},
  onHoverBlock: () => {},
  onDuplicate: () => {},
  onDelete: () => {},
  hoverHighlight: null,
};

const logos = [
  { url: "/a.png", alt: "Acme", href: "https://acme.test" },
  { url: "/b.png", alt: "", href: "" },
];

const logoCloud = (data: Record<string, unknown>): BlockConfig => ({
  id: "lc",
  name: "core/logo-cloud",
  type: "block",
  label: "Logo cloud",
  parentId: null,
  category: "layout",
  content: { kind: "structured", data: { logos, ...data } },
  styles: {},
  settings: {},
});

const publish = (block: BlockConfig) => {
  const Component = getBlockComponent("core/logo-cloud")!;
  return renderToStaticMarkup(<Component {...block} />);
};

describe("logo cloud published view", () => {
  it("renders a row list with classes, variables, lazy images and links", () => {
    const html = publish(logoCloud({ layout: "row", columns: 4, logoHeight: "48px" }));
    expect(html).toContain('class="wp-block-logo-cloud np-logos--row is-grayscale block-lc"');
    expect(html).toContain("--np-logo-h:48px");
    expect(html).toContain("--np-logo-cols:4");
    expect(html.match(/<li class="np-logos__item"/g)).toHaveLength(2);
    expect(html).toContain('<a href="https://acme.test"><img src="/a.png" alt="Acme" loading="lazy" decoding="async"/></a>');
    expect(html).not.toContain("np-logos__track");
  });

  it("drops grayscale when turned off", () => {
    expect(publish(logoCloud({ grayscale: false }))).not.toContain("is-grayscale");
  });

  it("renders the marquee list twice, the copy hidden from screen readers and the keyboard", () => {
    const html = publish(logoCloud({ marquee: true }));
    expect(html).toContain("is-marquee");
    expect(html).toContain('<div class="np-logos__track">');
    expect(html.match(/<ul class="np-logos__list"/g)).toHaveLength(2);
    expect(html.match(/<ul class="np-logos__list" aria-hidden="true"/g)).toHaveLength(1);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(1);
  });

  it("ignores the marquee in the grid layout", () => {
    const html = publish(logoCloud({ layout: "grid", marquee: true }));
    expect(html).toContain("np-logos--grid");
    expect(html).not.toContain("is-marquee");
    expect(html.match(/<ul /g)).toHaveLength(1);
  });
});

describe("logo cloud css", () => {
  it("moves by transform only, pauses on hover and focus, and stops for reduced motion", () => {
    expect(LOGO_CLOUD_CSS).toContain("translateX(-50%)");
    expect(LOGO_CLOUD_CSS).toContain(":focus-within .np-logos__track");
    expect(LOGO_CLOUD_CSS).toContain("prefers-reduced-motion: reduce");
    expect(LOGO_CLOUD_CSS).toMatch(/@container npb-canvas \(max-width: 767px\)/);
    expect(LOGO_CLOUD_CSS).toMatch(/@media \(max-width: 767px\)/);
  });
});

describe("logo cloud editor", () => {
  it("shows the same markup on the canvas", () => {
    const Component = blockRegistry["core/logo-cloud"].component as React.ComponentType<{
      value: BlockConfig;
      onChange: (next: BlockConfig) => void;
      isPreview?: boolean;
    }>;
    const { container } = render(
      <BlockActionsProvider value={stubActions}>
        <Component value={logoCloud({ marquee: true })} onChange={() => {}} isPreview />
      </BlockActionsProvider>,
    );
    expect(container.querySelector(".wp-block-logo-cloud.np-logos--row.is-marquee .np-logos__track")).not.toBeNull();
    expect(container.querySelectorAll(".np-logos__list")).toHaveLength(2);
  });
});

describe("logo cloud settings", () => {
  const lastLogos = (onUpdate: ReturnType<typeof vi.fn>) => {
    const call = onUpdate.mock.calls.at(-1)?.[0] as { content: { data: { logos: typeof logos } } };
    return call.content.data.logos;
  };

  it("warns when a logo has no alt text", () => {
    render(<LogoCloudSettings block={logoCloud({})} onUpdate={vi.fn()} />);
    expect(screen.getAllByText("Add the company name so screen readers can say it.")).toHaveLength(1);
  });

  it("adds a logo from the media library", () => {
    const onUpdate = vi.fn();
    render(<LogoCloudSettings block={logoCloud({})} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole("button", { name: /add logo/i }));
    fireEvent.click(screen.getByText("pick-from-library"));
    expect(lastLogos(onUpdate)).toEqual([...logos, { url: "/uploads/new.png", alt: "New Co", href: "" }]);
  });

  it("reorders and removes logos", () => {
    const onUpdate = vi.fn();
    render(<LogoCloudSettings block={logoCloud({})} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole("button", { name: "Move logo 1 down" }));
    expect(lastLogos(onUpdate).map((l) => l.url)).toEqual(["/b.png", "/a.png"]);
    fireEvent.click(screen.getByRole("button", { name: "Remove logo 1" }));
    expect(lastLogos(onUpdate).map((l) => l.url)).toEqual(["/b.png"]);
    expect(screen.getByRole("button", { name: "Move logo 1 up" })).toBeDisabled();
  });

  it("edits alt text and link", () => {
    const onUpdate = vi.fn();
    render(<LogoCloudSettings block={logoCloud({})} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByLabelText("Alt text for logo 2"), { target: { value: "Beta" } });
    expect(lastLogos(onUpdate)[1].alt).toBe("Beta");
    fireEvent.change(screen.getByLabelText("Link for logo 2"), { target: { value: "https://beta.test" } });
    expect(lastLogos(onUpdate)[1].href).toBe("https://beta.test");
  });

  it("hides columns in row layout and disables Scroll in grid layout", () => {
    const { unmount } = render(<LogoCloudSettings block={logoCloud({ layout: "row" })} onUpdate={vi.fn()} />);
    expect(screen.queryByText("Columns")).toBeNull();
    unmount();
    render(<LogoCloudSettings block={logoCloud({ layout: "grid" })} onUpdate={vi.fn()} />);
    expect(screen.getByText("Columns")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Scroll" })).toBeDisabled();
  });
});
