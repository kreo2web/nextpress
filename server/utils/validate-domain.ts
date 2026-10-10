import dns from 'node:dns/promises';

const IPV4_REGEX = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
const IPV6_LITERAL_REGEX = /^\[[0-9a-f:.]+\]$/i;
const LOCALHOST_REGEX = /^(localhost|.*\.localhost)$/;

/**
 * Second-level labels that sit under a two-letter country code (example.co.uk, example.co.ug), so
 * `example.co.uk` is a top-level domain of its own and still gets a `www.` twin.
 */
const COUNTRY_SECOND_LEVELS = new Set([
  'ac', 'co', 'com', 'edu', 'go', 'gov', 'gv', 'ltd', 'me', 'mil', 'ne', 'net', 'nic', 'or', 'org', 'plc', 'sch',
]);

/**
 * Checks if a domain requires DNS validation.
 * Skips validation for localhost variants and plain IP addresses
 * since these are used during initial self-hosting setup before DNS is configured.
 */
function shouldSkipValidation(domain: string): boolean {
  const host = stripPort(domain);
  return IPV4_REGEX.test(host) || IPV6_LITERAL_REGEX.test(host) || LOCALHOST_REGEX.test(host);
}

/**
 * True for a domain people also type with `www.` (example.com, example.co.uk). A subdomain such as
 * shop.example.com gets no twin: nobody sets up DNS for www.shop.example.com, and requiring it blocked saves.
 */
function isTopLevelDomain(host: string): boolean {
  const labels = host.split('.');
  if (labels.length === 2) return true;
  if (labels.length !== 3) return false;
  const second = labels[1] ?? '';
  const countryCode = labels[2] ?? '';
  return countryCode.length === 2 && COUNTRY_SECOND_LEVELS.has(second);
}

/**
 * Strips protocol prefix and port from a domain/URL string.
 * Handles both http:// and https:// prefixes and port numbers.
 */
function stripProtocol(input: string): string {
  return input.replace(/^https?:\/\//, '');
}

/**
 * Extracts hostname without port from a domain string.
 * E.g., "localhost:5000" -> "localhost"
 */
function stripPort(domain: string): string {
  return domain.replace(/:\d+$/, '');
}

/**
 * Normalized hostname for DNS, Caddy and visitor matching: lower case, no scheme, path, port or
 * trailing dot. `Site.com/` and `site.com` must compare equal or the visitor lands on the default site.
 */
export function normalizeSiteHostname(domainOrUrl: string): string {
  const withoutScheme = stripProtocol(domainOrUrl.trim().toLowerCase());
  const hostAndPort = withoutScheme.split(/[/?#]/)[0] ?? '';
  return stripPort(hostAndPort).replace(/\.$/, '');
}

/**
 * True when host is a plain IPv4 address (no TLS from Caddy ACME for this site shape).
 */
export function isIpv4Host(host: string): boolean {
  return IPV4_REGEX.test(stripPort(host));
}

/**
 * Every host a site answers on, main host first: the Caddy site line and visitor matching both use
 * this list. Top-level domains add their `www.` twin; subdomains, localhost and IPs stay single.
 */
export function getCaddyTlsHostnames(domainOrUrl: string): string[] {
  const host = normalizeSiteHostname(domainOrUrl);
  if (!host) return [];
  if (shouldSkipValidation(host)) return [host];
  if (host.startsWith('www.')) {
    const apex = host.slice(4);
    return apex ? [host, apex] : [host];
  }
  return isTopLevelDomain(host) ? [host, `www.${host}`] : [host];
}

/**
 * True when public DNS / ACME checks are skipped (localhost variants or plain IPv4).
 */
export function shouldSkipPublicDnsCheck(domainOrUrl: string): boolean {
  const host = normalizeSiteHostname(domainOrUrl);
  if (!host) return false;
  return shouldSkipValidation(host);
}

/**
 * Validates that a domain has DNS A records configured.
 * 
 * Returns a result object indicating whether the domain resolves.
 * Skips validation entirely for localhost and IP addresses since
 * self-hosting users often configure via IP before DNS is ready.
 * 
 * @param domainOrUrl - Domain name or full URL to validate
 * @returns Validation result with status and message
 */
export async function validateDomain(domainOrUrl: string): Promise<{ valid: boolean; message: string }> {
  const domain = normalizeSiteHostname(domainOrUrl);

  if (!domain) {
    return { valid: false, message: 'Domain is required' };
  }

  if (shouldSkipValidation(domain)) {
    return { valid: true, message: 'Skipped DNS check (localhost or IP address)' };
  }

  try {
    const addresses = await dns.resolve4(domain);

    if (addresses.length > 0) {
      return { valid: true, message: `Domain resolves to ${addresses[0]}` };
    }

    return { valid: false, message: `Domain "${domain}" has no A records. Point your DNS A record to this server first.` };
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;

    // ENOTFOUND = domain doesn't exist, ENODATA = no A records
    if (code === 'ENOTFOUND' || code === 'ENODATA') {
      return {
        valid: false,
        message: `Domain "${domain}" does not resolve. Please point your DNS A record to this server before configuring.`,
      };
    }

    // ETIMEOUT, ESERVFAIL etc. - DNS infrastructure issue, not the user's fault
    return {
      valid: false,
      message: `Could not verify domain "${domain}" (DNS lookup failed: ${code}). Check your DNS configuration and try again.`,
    };
  }
}
