---
title: SDK
description: Use the TypeScript SDK to create pages, read posts, edit with undo and manage docs from your own code.
slug: sdk
kind: page
order: 2
---

The SDK, `@nextpress-org/sdk`, is a TypeScript client for your NextPress site. Use it to create and update pages and posts, work with blocks, run editor sessions with undo and redo, and manage docs. It needs Node.js 20 or later and an [API key](/docs/developers/api-keys).

## Install

<CodeGroup>

```sh title="pnpm"
pnpm add @nextpress-org/sdk
```

```sh title="npm"
npm install @nextpress-org/sdk
```

</CodeGroup>

## Create a client

Pass the address of your site, your API key and the site's ID. Use the same site you chose when you created the key.

```ts title="client.ts"
import { createNextpress } from "@nextpress-org/sdk";

export const nextpress = createNextpress({
  baseUrl: "[your site address]",
  apiKey: "[your API key]",
  siteId: "[your site ID]",
});
```

| Option | Required | Default | What it does |
|---|---|---|---|
| `baseUrl` | Yes | None | The address of your NextPress site |
| `apiKey` | Yes | None | Your API key, which starts with `npk_live_` |
| `siteId` | Yes | None | The ID of the site the key belongs to |
| `fetch` | No | The built-in fetch | A custom fetch, for cookies, proxies or tests |
| `timeout` | No | 30 seconds | How long to wait for a response |

The client never shows your API key in its `config`, so it stays out of logs.

## First calls

Create a draft page with a heading and a paragraph. Changes return a result, so check `isErr` before you read `value`.

```ts title="create-page.ts"
const createResult = await nextpress.pages.create({
  title: "About Us",
  status: "draft",
  blocks: [
    nextpress.blocks.heading({ text: "About Us", level: 1 }),
    nextpress.blocks.paragraph({ text: "We build great things." }),
  ],
});
if (createResult.isErr) throw createResult.error;
const page = createResult.value;
```

List up to ten published posts:

```ts title="list-posts.ts"
const { posts, total } = await nextpress.posts.list({
  status: "publish",
  per_page: 10,
});
```

Reads throw an error when they fail. Changes return a result instead, so check `isErr`.

## Save with a version

An update needs the page's current version, so it does not overwrite someone else's work. Read the page, then send its version back as `expectedVersion`.

```ts title="update-page.ts"
const current = await nextpress.pages.get({ id: page.id });
const updateResult = await nextpress.pages.update({
  id: page.id,
  expectedVersion: current.version ?? 0,
  blocks: [nextpress.blocks.heading({ text: "Welcome", level: 1 })],
});
if (updateResult.isErr) throw updateResult.error;
```

If the page changed since you read it, the result has the code `VERSION_STALE`. Read the page again, apply your change to the new version, and save again.

## Edit with undo and redo

An editor session keeps your changes in an undo history, the same way the editor does.

```ts title="editor-session.ts"
const editor = nextpress.createEditorSession();
await editor.load({ type: "page", id: page.id });

editor.setBlocks([
  ...editor.getBlocks(),
  nextpress.blocks.paragraph({ text: "Added with the SDK" }),
]);

editor.undo();
await editor.save();
```

Publish with `editor.publish()`, or make a shareable preview link with `editor.createPreviewLink()`. Publishing is a separate step from saving, so only publish when the owner asks.

## Docs

The `docs` namespace makes a docs, moves and orders its pages, and reads and writes each page as MDX. Reads need `pages:read`, and changes need `pages:write`.

```ts title="docs.ts"
import { readDocsMdxProblem, VERSION_STALE } from "@nextpress-org/sdk";

const made = await nextpress.docs.create({ name: "Acme Docs", slug: "docs" });
if (made.isErr) throw made.error;
const { homeId } = made.value;

const added = await nextpress.docs.addItem({ homeId, parentId: homeId, title: "Install", kind: "page" });
if (added.isErr) throw added.error;
const pageId = added.value.item.id;

const current = await nextpress.docs.readPage({ pageId });
const saved = await nextpress.docs.writePage({
  pageId,
  mdx: "## Requirements\n\nDocker.\n",
  expectedVersion: current.version,
  description: "What you need before you install.",
});

if (saved.isErr) {
  const problem = readDocsMdxProblem(saved.error);
  if (problem) console.error(`Line ${problem.line}: ${problem.message}`);
  if (saved.error.code === VERSION_STALE) {
    // Read the page again, then write it with the new version.
  }
}
```

A new page is a draft. An MDX mistake is refused, and the reply names the line. Nothing is saved when a write is refused. The writing rules are the same as in [Writing docs](/docs/pages-and-content/writing-docs).

## Move a page to another site

Use one client for each site, because each key works on one site. Export the page from the source site, then import the file into the target.

```ts title="move-page.ts"
const file = await source.pageTransfer.export({ pageId });
const result = await target.pageTransfer.import({ file: file.bytes, fileName: file.fileName });
if (result.isErr) throw result.error;
```

The key for each site needs both page and media permissions for this to work.

## Next steps

<Cards cols="2">

<Card title="API keys and permissions" href="/docs/developers/api-keys">

Create a key with the permissions your code needs.

</Card>

<Card title="MCP server" href="/docs/developers/mcp-server">

Let an AI agent work on your site with the same permissions.

</Card>

</Cards>
