# Changelog

## [0.3.0] - 2026-10-17

### Added
- **Page tools** (`createPageTools(ctx)`) — one set of 12 tools over `{ readTree, writeTree }`: page outline, one block, block types, `change_blocks` (insert/update/delete/move/replace, all-or-nothing, checked like a server save, optional selected-block rule), whole-page check, phone fixes, design guide, media, pages, template parts and theme. The MCP server and the in-editor assistant use the same set.
- **Form blocks** — `blocks.form` and `blocks.submitButton` builders.
- **Template parts** — `templates.listParts`, `templates.createPart`, `templates.usage`.
- **Page transfer** — `pageTransfer.links/export/import` for copying pages between sites.
- **Form answers** — `forms.submissions.list/exportCsv/markStatus/delete`.
- **Media** — `media.copyBrandLogo`. **Pages** — `pages.reorder`.
- **History** — `pages.getHistory`, `pages.restoreVersion`.
- `outlinePage`, `checkPage` (server save rules plus the phone check) and a `replace` change on the block tree.
- Agent notes per block (`PAGE_DESIGN_GUIDE`, `shared/block-catalog/agent-notes.ts`).
- `change_blocks` is easier on agents (found running a smaller model in the editor):
  - Block names work without `core/` (`heading` is `core/heading`), the way the outline prints them. `post/` blocks keep their prefix.
  - `ref` on a new block: later ops in the same call can use it as `id` or `parentId`. The reply maps each ref to its real id.
  - Content fields are checked against what each block really uses (`shared/block-catalog/content-fields.ts`). A wrong one is refused with a guess, such as `icon.iconName` or "send textAlign in styles". `get_block_type` lists the fields.
  - `fillBehind` on a layer of an overlay Stack (the editor's "Layer size: Fills behind").
  - Each reply checks the whole page and says when it is clean, so `check_page` isn't needed after a change.
  - The first block added to an empty page gets a page shell, the same one the server adds on save.
  - Blocks added to an existing Columns block get a column each (or fill an empty one), keeping columns equal.
  - A heading or paragraph whose text has inline tags (`<strong>`, a link) is marked `format: "html"`.
  - The input description is about 30% smaller: only an insert's outer block carries descriptions.
- `createBlockSpecSchema()` — the block shape `change_blocks` takes, for tools that take blocks elsewhere (MCP `build_blocks`).
- Block catalog: `core/code` has `title` (file name above the code) and `highlightLines` ("2, 4-6"), and shows its copy button by default; `core/markdown` has `mdx` (docs components such as `<Callout>`, never run). Agent notes describe both.
- Block catalog: section blocks `core/grid`, `core/card`, `core/badge`, `core/steps` + `core/step`, `core/tabs` + `core/tab`, `core/logo-cloud`, `core/search` (a search button for the site) and `core/docs-layout` (sidebar from the page tree, "On this page", previous/next, Copy page). `core/list` has `marker` (check, arrow, dash, none) and `core/columns` has `reverseOnPhones`. `core/step` only goes inside Steps and `core/tab` only inside Tabs; the page check refuses them elsewhere. `PageSummary` takes an optional `path` (`guides/install` for a page under Guides), which `list_pages` shows as its link; the in-editor assistant fills it in.

### Changed
- Block defaults, names and the phone-layout check now come from the shared block catalog (`shared/block-catalog/`), so SDK-built blocks match what the editor inserts.
- The change check only blocks problems the change adds; problems the page already had are listed, not blocking.
- `buildColumnsLayout` and `buildColumnsLayoutFromGroups` use the page tools' equal-columns split, so SDK-built and agent-built Columns match.
- **Settings** now hold only switches the server acts on: `general` (no `dateFormat`/`timeFormat`; `timezone` sets post dates), `reading` (no `postsPerPage`), `discussion` (no `emailNotifications`/`defaultRole`). The `writing` and `system` sections and the `WritingSettings`/`SystemSettingsSection` types are gone: none of them did anything. Changing a site's settings needs that site's admin.
- **Access:** every request is checked against the role of the person who made the API key, on the key's site, at the time it runs. Editors work on content; settings, theme, options and keys need the site's admin; users, plugins and sites need a main-site admin. Content ids from another site answer 404.
- `users.create` now makes a real sign-in account (main-site admins only) and can give a role on a site (`siteId`, `role`). Responses never include a `password` field.

### Notes
- `dist/index.js` grows (~774 KB) because the save check pulls in the react-icons name index. Lazy loading is an option if it matters.
