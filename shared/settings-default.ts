/**
 * Default settings for one site, used when `sites.settings` is empty or missing a value.
 * Every switch here does something on the server for its own site only; switches that did nothing
 * (writing, system, email, default role) were removed on 2026-10-19. Old stored values are ignored.
 * Timezone uses IANA identifiers.
 */
export const DEFAULT_SETTINGS = {
  general: {
    siteName: 'NextPress Site',
    siteDescription: 'WordPress-Compatible CMS',
    siteUrl: '',
    adminEmail: '',
    /** Post dates on published pages are shown in this timezone. */
    timezone: 'UTC',
  },
  reading: {
    /** How many recent posts the site's RSS feed lists. */
    rssPosts: 10,
    rssEnabled: true,
    discourageSearchIndexing: false,
    descriptionFrom: 'auto',
  },
  discussion: {
    enableComments: true,
    /** New comments wait for approval. */
    moderateComments: true,
    /** "Let visitors create an account": accounts made this way can only comment. */
    enableRegistration: false,
  },
} as const;

export type SiteSettings = typeof DEFAULT_SETTINGS;
