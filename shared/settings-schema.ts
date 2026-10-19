import { z } from 'zod';

/**
 * Validation for one site's settings (the `sites.settings` jsonb column). Unknown keys are dropped,
 * so values from removed switches disappear the next time a site saves its settings.
 */

/** IANA names this runtime knows, plus UTC (which the list leaves out). */
export const isTimeZone = (value: string): boolean => value === 'UTC' || Intl.supportedValuesOf('timeZone').includes(value);

export const generalSettingsSchema = z.object({
  siteName: z.string().min(1).max(255),
  siteDescription: z.string().max(1000),
  siteUrl: z.string().url().or(z.literal('')),
  adminEmail: z.string().email().or(z.literal('')),
  timezone: z.string().min(1).refine(isTimeZone, 'Pick a timezone from the list.'),
});

export const readingSettingsSchema = z.object({
  rssPosts: z.number().int().positive().max(100),
  rssEnabled: z.boolean(),
  discourageSearchIndexing: z.boolean(),
  descriptionFrom: z.enum(["auto", "page", "excerpt", "site"]),
});

export const discussionSettingsSchema = z.object({
  enableComments: z.boolean(),
  moderateComments: z.boolean(),
  enableRegistration: z.boolean(),
});

/** Full settings: all sections required. */
export const settingsSchema = z.object({
  general: generalSettingsSchema,
  reading: readingSettingsSchema,
  discussion: discussionSettingsSchema,
});

/** For PATCH: every section and field optional. */
export const partialSettingsSchema = z.object({
  general: generalSettingsSchema.partial().optional(),
  reading: readingSettingsSchema.partial().optional(),
  discussion: discussionSettingsSchema.partial().optional(),
});

export type Settings = z.infer<typeof settingsSchema>;
export type PartialSettings = z.infer<typeof partialSettingsSchema>;
