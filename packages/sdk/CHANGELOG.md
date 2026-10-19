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

### Changed
- Block defaults, names and the phone-layout check now come from the shared block catalog (`shared/block-catalog/`), so SDK-built blocks match what the editor inserts.
- The change check only blocks problems the change adds; problems the page already had are listed, not blocking.
- **Settings** now hold only switches the server acts on: `general` (no `dateFormat`/`timeFormat`; `timezone` sets post dates), `reading` (no `postsPerPage`), `discussion` (no `emailNotifications`/`defaultRole`). The `writing` and `system` sections and the `WritingSettings`/`SystemSettingsSection` types are gone: none of them did anything. Changing a site's settings needs that site's admin.
- **Access:** every request is checked against the role of the person who made the API key, on the key's site, at the time it runs. Editors work on content; settings, theme, options and keys need the site's admin; users, plugins and sites need a main-site admin. Content ids from another site answer 404.
- `users.create` now makes a real sign-in account (main-site admins only) and can give a role on a site (`siteId`, `role`). Responses never include a `password` field.

### Notes
- `dist/index.js` grows (~774 KB) because the save check pulls in the react-icons name index. Lazy loading is an option if it matters.
