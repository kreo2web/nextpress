---
title: API keys and permissions
description: Create an API key for one site, choose what it may do, and change its permissions later.
slug: api-keys
kind: page
order: 1
---

An API key lets a script, an SDK client or an AI agent work on one site. Each key belongs to one site, and it can do only what its permissions allow.

## Create a key

Keys are created and revoked in the dashboard only. Go to **Settings**, then **System**, then **API Keys**.

<Steps>

<Step title="Choose the site">

Choose the site the key will work on. Do this first, because each key belongs to one site.

</Step>

<Step title="Choose the permissions">

Pick a preset, or choose the permissions one by one. The presets are listed below.

</Step>

<Step title="Copy the key">

The key starts with `npk_live_`. NextPress shows the full key once, when you create it. Copy it and store it somewhere safe.

</Step>

</Steps>

<Callout type="danger" title="Treat a key like a password">

Anyone with a key can do what its permissions allow. If a key leaks, revoke it in **API Keys** and create a new one.

</Callout>

## Presets

| Preset | What it can do |
|---|---|
| Content editor (`editor`) | Read and write all content, and create preview links. Use it for content work |
| Posts editor (`posts-editor`) | Read and write posts, and create preview links. Use it for blog-only scripts |
| Read only (`readonly`) | Read all content and settings. Use it for reports and read-only sync |
| Full access (`full`) | Every permission except managing keys. Give it only when you need it |

Keys are always made in the dashboard, so no key can create or revoke another key.

## Permissions

You can change a key's permissions later from the same screen. Each kind of content has a read permission and a write permission. A write permission also covers reading.

| Content | Read | Write |
|---|---|---|
| Pages | `pages:read` | `pages:write` |
| Posts | `posts:read` | `posts:write` |
| Blogs | `blogs:read` | `blogs:write` |
| Templates | `templates:read` | `templates:write` |
| Comments | `comments:read` | `comments:write` |
| Media | `media:read` | `media:write` |
| Themes | `themes:read` | `themes:write` |
| Plugins | `plugins:read` | `plugins:write` |
| Hooks | `hooks:read` | None |
| Dashboard stats | `dashboard:read` | None |
| Preview links | not needed | `preview:write` |

Settings and people have their own permissions: `settings:read` and `settings:write`, `users:read` and `users:write`, `sites:read` and `sites:write`, and `system:read` and `system:write`. The system write permission covers actions such as upgrades and the WordPress import.

Preview links need `preview:write` to create. To view an authenticated preview of a page, a key also needs `pages:read`.

## When a key is refused

If a key lacks a permission, NextPress answers with a `403` error and the code `API_KEY_SCOPE_DENIED`. The answer names the permission the request needs. Open the key in **Settings**, then **System**, then **API Keys**, and add that permission.

A key that targets another site is refused too. Use a key for the site you are working on.

## Sign-in is not a key

Sign-in and sign-up are not part of the SDK. A script authenticates with its API key, and it cannot create or revoke keys. The public parts of the site, such as published pages, need no key.

Next, read [SDK](/docs/developers/sdk) or [MCP server](/docs/developers/mcp-server) to use your key.
