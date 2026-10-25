---
title: Templates and themes
description: Reuse layouts and shared parts like headers and footers, and understand how themes shape your site.
slug: templates-and-themes
kind: page
order: 4
---

NextPress has three ways to reuse design: templates, template parts and themes.

## Templates

A template is a ready-made layout made of pre-designed blocks. You copy a template into a page. The page does not stay linked to the template, so changing the template later does not change the page. Pre-designed blocks are kept under **Appearance**, in **Pre-designed Blocks**.

In **Page settings**, you can also choose a template for a page.

## Template parts

A template part is a header, a footer or a section that you design once and show on many pages. Change the part, and every page that shows it changes too. Parts belong to one site.

Before you change a part, check which pages show it. That way you know what the change will touch.

## Template variables

<Callout type="note" title="Experimental">

The template system is marked experimental, so its details may change.

</Callout>

Templates can hold variables, such as `{{site.title}}` for the site's name or `{{post.author}}` for a post's author. Templates can also show or hide content based on conditions, such as whether the page is the home page or a single post.

## Themes

A theme sets the look of a site. Each site has its own themes, and one theme is active at a time.

<Callout type="note" title="Not yet available">

Theme template overrides are not available yet.

</Callout>
