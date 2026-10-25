import { describe, expect, it } from 'vitest';
import {
  buildDocsAddress,
  findSiteUsingHost,
  siteBaseDomain,
  validateAddressPart,
  validateFullHost,
  validateSubdomain,
} from '@/lib/docs/docs-address';

describe('siteBaseDomain', () => {
  it('keeps just the address people type: no scheme, no www, no path', () => {
    expect(siteBaseDomain('https://www.Acme.com/about')).toBe('acme.com');
    expect(siteBaseDomain('acme.com')).toBe('acme.com');
  });

  it('keeps a port, so a local site still builds a working address', () => {
    expect(siteBaseDomain('http://localhost:5055')).toBe('localhost:5055');
  });

  it('is empty for a site with no address', () => {
    expect(siteBaseDomain(null)).toBe('');
    expect(siteBaseDomain('   ')).toBe('');
  });
});

describe('validateAddressPart (on this site)', () => {
  it('accepts letters, numbers and dashes, in any case', () => {
    expect(validateAddressPart('docs')).toBeNull();
    expect(validateAddressPart('Help-Center-2')).toBeNull();
  });

  it('asks for something when empty', () => {
    expect(validateAddressPart('  ')).toBe('Type an address, like docs.');
  });

  it('refuses anything but letters, numbers and dashes, or a dash at either end', () => {
    const message = "Use letters, numbers and dashes only, and don't start or end with a dash.";
    expect(validateAddressPart('my docs')).toBe(message);
    expect(validateAddressPart('docs/api')).toBe(message);
    expect(validateAddressPart('docs.v2')).toBe(message);
    expect(validateAddressPart('-docs')).toBe(message);
    expect(validateAddressPart('docs-')).toBe(message);
    expect(validateAddressPart('do--cs')).toBe(message);
  });

  it('refuses words NextPress already uses at the top of every site', () => {
    expect(validateAddressPart('admin')).toBe('"admin" is used by NextPress itself. Try docs or help.');
    expect(validateAddressPart('API')).toBe('"api" is used by NextPress itself. Try docs or help.');
  });
});

describe('validateSubdomain (an address of its own)', () => {
  it('accepts a first part made of letters, numbers and dashes', () => {
    expect(validateSubdomain('docs')).toBeNull();
    expect(validateSubdomain('help-2')).toBeNull();
  });

  it('refuses an empty part or one with dots or spaces', () => {
    expect(validateSubdomain('')).toBe('Type the first part of the address, like docs.');
    expect(validateSubdomain('docs.acme')).toContain('letters, numbers and dashes');
    expect(validateSubdomain('my docs')).toContain('letters, numbers and dashes');
  });
});

describe('validateFullHost (a site with no address to build on)', () => {
  it('accepts a full address and a local one', () => {
    expect(validateFullHost('docs.example.com')).toBeNull();
    expect(validateFullHost('docs.localhost:5055')).toBeNull();
  });

  it('asks for the whole address', () => {
    expect(validateFullHost('')).toBe('Type the full address, like docs.example.com.');
    expect(validateFullHost('docs')).toBe('Type a full address, like docs.example.com.');
    expect(validateFullHost('docs example')).toBe('Type a full address, like docs.example.com.');
  });
});

describe('buildDocsAddress', () => {
  it('puts docs under the site: the address part is the home page address', () => {
    expect(buildDocsAddress({ place: 'this-site', path: ' Docs ', subdomain: 'ignored', base: 'acme.com' })).toEqual({
      slug: 'docs',
      host: 'acme.com',
      display: 'acme.com/docs',
    });
  });

  it('gives docs of their own the typed first part plus the site address', () => {
    expect(buildDocsAddress({ place: 'own-address', path: 'ignored', subdomain: 'Docs', base: 'acme.com' })).toEqual({
      slug: 'docs',
      host: 'docs.acme.com',
      display: 'docs.acme.com',
    });
  });

  it('takes a whole typed address when the site has none to build on', () => {
    expect(buildDocsAddress({ place: 'own-address', path: '', subdomain: 'docs.example.com', base: '' }).host).toBe('docs.example.com');
    expect(buildDocsAddress({ place: 'this-site', path: 'docs', subdomain: '', base: '' }).display).toBe('/docs');
  });
});

describe('findSiteUsingHost', () => {
  const sites = [
    { id: 'a', name: 'Acme', siteUrl: 'https://acme.com', isDefault: true },
    { id: 'b', name: 'Help', siteUrl: 'https://www.help.acme.com', isDefault: false },
    { id: 'c', name: 'Draft', siteUrl: null, isDefault: false },
  ];

  it('finds the site that already answers on the address, ignoring www and case', () => {
    expect(findSiteUsingHost({ sites, host: 'HELP.acme.com' })?.id).toBe('b');
  });

  it('finds nothing for a free address', () => {
    expect(findSiteUsingHost({ sites, host: 'docs.acme.com' })).toBeUndefined();
  });
});
