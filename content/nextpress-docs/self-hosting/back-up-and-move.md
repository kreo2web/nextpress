---
title: Back up and move
description: Know which copies NextPress makes for you, and make your own export files to back up or move your data.
slug: back-up-and-move
kind: page
order: 3
---

NextPress keeps three kinds of copies of your data. Each one answers a different need.

| Copy | Who makes it | What it is for |
|---|---|---|
| Database backups | NextPress, before each upgrade that changes the database | Going back to the data as it was before an upgrade |
| Export files | You, with `nextpress export` | A copy of your data that you keep, or move to another install |
| Page files | You, from the Pages screen or the docs screen | Moving one page or one docs to another site |

## Database backups made by upgrades

Before an upgrade changes the database, NextPress makes a database copy with `pg_dump`. The copy is saved in the `backups` folder of the install, with a name such as `nextpress-db-20261025120000.sql`. NextPress keeps the three newest copies and removes older ones.

The upgrade stops if it cannot make the copy, so it never changes the database without one.

NextPress does not restore a backup for you. Putting a backup back is a manual job. Keep the copy somewhere safe before you start.

## Export your data

Make an export with the command. It saves the data of the site, or of every site in the install.

```bash title="Export everything to a file"
nextpress export
```

```bash title="Export everything, with the media files"
nextpress export --with-media-files
```

```bash title="Export users and posts of one site"
nextpress export --users --posts --site example.com
```

The export writes a file named `nextpress-export-YYYYMMDD-HHMMSS.json` in the current folder. With `--with-media-files`, it writes a `.tar.gz` file instead. Use `--out` to choose the file's place and name. The export refuses to overwrite an existing file unless you add `--force`.

Without entity flags, the export includes users, sites, pages, blogs, posts, comments, media, templates and options. Give flags to export only some of them. Use `--site` to limit the export to one site, by its name or hostname.

## Import an export

```bash title="Import an export file"
nextpress import nextpress-export-20261025-120000.json
```

By default, an import refreshes the rows that already exist. To keep the rows that already exist, use `--mode skip`:

```bash title="Import users and posts, and keep existing rows"
nextpress import nextpress-export.tar.gz --users --posts --mode skip
```

The import needs a file that exists, can be read, and is not empty.

<Callout type="tip" title="Test the import first">

Import into a second install before you rely on the file. That way you can check the result without changing your live site.

</Callout>

## Move one page or a docs

To move a single page, or a whole docs, to another site, export it as a page file from the Pages screen or the Docs screen, then import it there. See [Move pages between sites](/docs/pages-and-content/move-pages).

## Before you uninstall

Uninstalling removes the database and the install folder. Make an export first. See [The nextpress command](/docs/self-hosting/nextpress-command).
