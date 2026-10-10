import { promises as fs } from 'node:fs';
import type { Site } from '@shared/schema-types';
import { getCaddyTlsHostnames, shouldSkipPublicDnsCheck } from './validate-domain';
import { compareSitePreference, isPublicHostname, readSiteAddress } from './site-address';
import { getOptionalCaddyAcmeEmail } from '../config';
import { collectErrorText, safeTryAsync } from '../utils';

const CADDYFILE_PATH = '/etc/caddy/Caddyfile';
const CADDY_LOAD_URL = 'http://caddy:2019/load';
const CADDY_LOAD_TIMEOUT_MS = 10_000;

/** What happened to the web server setup after a site address changed. */
export type WebServerUpdate =
  | { status: 'applied'; warning?: string }
  | { status: 'saved-for-restart'; reason: string }
  | { status: 'skipped'; reason: string }
  | { status: 'refused'; reason: string };

type CaddyLoadOutcome =
  | { outcome: 'accepted' }
  | { outcome: 'refused'; reason: string }
  | { outcome: 'unreachable'; reason: string };

type CaddyWriteOutcome = { outcome: 'written' } | { outcome: 'unwritable'; reason: string };

/** The two ways we reach Caddy: its admin API and the Caddyfile on the shared volume. Swapped in tests. */
export type CaddyIo = {
  load: (caddyfile: string) => Promise<CaddyLoadOutcome>;
  write: (caddyfile: string) => Promise<CaddyWriteOutcome>;
};

type CaddySyncModels = { sites: { findMany: () => Promise<Site[]> } };

/**
 * Caddyfile-safe ACME contact line (no braces / newlines).
 */
function sanitizeAcmeEmail(raw: string): string | null {
  const t = raw.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null;
  return t.replace(/[\r\n{}]/g, '');
}

const siteBlock = (siteAddresses: string): string => `${siteAddresses} {\n  reverse_proxy app:5000\n}`;

/**
 * Builds the Caddyfile for every site address. Domains share one HTTPS block. IP addresses and
 * localhost get a plain `:80` block instead: listed with the domains, Caddy forces HTTPS on them with
 * a certificate browsers reject, which took IP-based sites (and their admin) offline.
 */
export function buildMultiSiteCaddyfile({
  addresses,
  acmeEmail,
}: {
  addresses: readonly string[];
  acmeEmail?: string | null;
}): string {
  const domains = new Set<string>();
  let servesLocalAddress = false;

  for (const address of addresses) {
    for (const host of getCaddyTlsHostnames(address)) {
      if (shouldSkipPublicDnsCheck(host)) {
        servesLocalAddress = true;
      } else if (isPublicHostname(host)) {
        domains.add(host);
      }
    }
  }

  const blocks: string[] = [];
  if (domains.size > 0) blocks.push(siteBlock([...domains].join(', ')));
  if (servesLocalAddress || domains.size === 0) blocks.push(siteBlock(':80'));

  const acme = acmeEmail ? sanitizeAcmeEmail(acmeEmail) : null;
  const emailLine = acme ? `  email ${acme}\n` : '';

  return `{
  admin 0.0.0.0:2019
${emailLine}}

${blocks.join('\n\n')}
`;
}

const defaultCaddyIo: CaddyIo = {
  load: async (caddyfile) => {
    const { err, result: response } = await safeTryAsync(() =>
      fetch(CADDY_LOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/caddyfile' },
        body: caddyfile,
        signal: AbortSignal.timeout(CADDY_LOAD_TIMEOUT_MS),
      }),
    );
    if (err || !response) return { outcome: 'unreachable', reason: collectErrorText(err) };
    if (response.ok) return { outcome: 'accepted' };

    const { err: bodyErr, result: body } = await safeTryAsync(() => response.text());
    const detail = bodyErr ? `(could not read reply: ${collectErrorText(bodyErr)})` : (body ?? '').slice(0, 500);
    return { outcome: 'refused', reason: `HTTP ${response.status}: ${detail}` };
  },
  write: async (caddyfile) => {
    const { err } = await safeTryAsync(() => fs.writeFile(CADDYFILE_PATH, caddyfile));
    return err ? { outcome: 'unwritable', reason: collectErrorText(err) } : { outcome: 'written' };
  },
};

/**
 * Hands a Caddyfile to Caddy first and writes the shared file only when Caddy accepted it, so a
 * refused setup never sits on disk waiting to break the next restart. When Caddy can't be reached
 * the file is still written, so a restart (or Caddy's file watch) picks it up.
 */
export async function applyCaddyfile({
  caddyfile,
  io = defaultCaddyIo,
}: {
  caddyfile: string;
  io?: CaddyIo;
}): Promise<WebServerUpdate> {
  const loaded = await io.load(caddyfile);
  if (loaded.outcome === 'refused') return { status: 'refused', reason: loaded.reason };

  const written = await io.write(caddyfile);
  if (loaded.outcome === 'accepted') {
    return written.outcome === 'written'
      ? { status: 'applied' }
      : { status: 'applied', warning: `Caddyfile not saved; a restart goes back to the old one: ${written.reason}` };
  }

  return written.outcome === 'written'
    ? { status: 'saved-for-restart', reason: loaded.reason }
    : { status: 'skipped', reason: `No web server here. ${loaded.reason}; ${written.reason}` };
}

const readAdminEmail = (sites: readonly Site[]): string | null => {
  const site = sites.find((candidate) => candidate.isDefault) ?? sites[0];
  const settings = site?.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;
  const email = (settings as { general?: { adminEmail?: string | null } }).general?.adminEmail;
  return typeof email === 'string' && email.trim() ? email.trim() : null;
};

async function rebuildCaddy({ models, io }: { models: CaddySyncModels; io?: CaddyIo }): Promise<WebServerUpdate> {
  const { err, result: sites } = await safeTryAsync(() => models.sites.findMany());
  if (err || !sites) {
    return { status: 'skipped', reason: `Could not read sites: ${collectErrorText(err)}` };
  }

  // Fixed order (default site first, then oldest) so the file only changes when an address does.
  const addresses = [...sites]
    .sort(compareSitePreference)
    .map((site) => readSiteAddress(site))
    .filter((address) => address.length > 0);
  if (addresses.length === 0) {
    return { status: 'skipped', reason: 'No site has an address yet' };
  }

  const acmeEmail = getOptionalCaddyAcmeEmail() ?? readAdminEmail(sites);
  return applyCaddyfile({ caddyfile: buildMultiSiteCaddyfile({ addresses, acmeEmail }), io });
}

let syncQueue: Promise<WebServerUpdate | void> = Promise.resolve();

/**
 * Rebuilds the web server setup from every site's address. Runs one at a time: two saves landing
 * together would otherwise race, and the older list of addresses could win.
 */
export function syncCaddyFromSites({
  models,
  io,
}: {
  models: CaddySyncModels;
  io?: CaddyIo;
}): Promise<WebServerUpdate> {
  const next = (): Promise<WebServerUpdate> => rebuildCaddy({ models, io });
  // Runs after the previous sync whether it worked or not, so one failure never stalls the queue.
  const run = syncQueue.then(next, next);
  syncQueue = run;
  return run;
}
