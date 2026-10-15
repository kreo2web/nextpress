import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BlockConfig, BlockContent } from "@shared/schema-types";
import { getBlockComponent } from "../../../renderer/react/render-helpers";

function imageBlock({
  name = "core/image",
  content,
}: {
  name?: "core/image" | "post/featured-image";
  content: BlockContent;
}): BlockConfig {
  return {
    id: "img-1",
    name,
    type: "block",
    parentId: null,
    label: "Image",
    category: "media",
    content,
    styles: {},
    settings: {},
  };
}

function renderPublished(block: BlockConfig): string {
  const Component = getBlockComponent(block.name);
  if (!Component) throw new Error(`No published renderer for ${block.name}`);
  return renderToStaticMarkup(<Component {...block} />);
}

describe("published ImageBlock", () => {
  it("reserves the box from intrinsic width and height when no content ratio is set", () => {
    const html = renderPublished(
      imageBlock({
        content: {
          kind: "media",
          mediaType: "image",
          url: "/uploads/pic.jpg",
          intrinsicWidth: "800",
          intrinsicHeight: "600",
        },
      }),
    );

    expect(html).toContain("aspect-ratio:800 / 600");
  });

  it("lets an explicit content.aspectRatio win over intrinsic size", () => {
    const html = renderPublished(
      imageBlock({
        content: {
          kind: "structured",
          data: {
            url: "/uploads/pic.jpg",
            intrinsicWidth: "800",
            intrinsicHeight: "600",
            aspectRatio: "16/9",
          },
        },
      }),
    );

    expect(html).toContain("aspect-ratio:16/9");
    expect(html).not.toContain("aspect-ratio:800 / 600");
  });

  it("treats auto and empty content.aspectRatio as missing so intrinsic still applies", () => {
    expect(
      renderPublished(
        imageBlock({
          content: {
            kind: "structured",
            data: {
              url: "/uploads/pic.jpg",
              intrinsicWidth: "800",
              intrinsicHeight: "600",
              aspectRatio: "auto",
            },
          },
        }),
      ),
    ).toContain("aspect-ratio:800 / 600");

    expect(
      renderPublished(
        imageBlock({
          content: {
            kind: "structured",
            data: {
              url: "/uploads/pic.jpg",
              intrinsicWidth: "800",
              intrinsicHeight: "600",
              aspectRatio: "   ",
            },
          },
        }),
      ),
    ).toContain("aspect-ratio:800 / 600");
  });

  it("reads the same content.aspectRatio on the featured-image alias", () => {
    const html = renderPublished(
      imageBlock({
        name: "post/featured-image",
        content: {
          kind: "structured",
          data: {
            url: "/uploads/hero.jpg",
            aspectRatio: "21/9",
            objectFit: "contain",
          },
        },
      }),
    );

    expect(html).toContain("aspect-ratio:21/9");
    expect(html).toContain("object-fit:contain");
    expect(html).toContain("overflow:hidden");
  });
});
