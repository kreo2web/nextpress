import { describe, expect, it } from 'vitest';
import type { DocsTree } from '@shared/docs';
import type { DomainReadinessData } from '@/hooks/use-domain-verify';
import {
  DEFAULT_DOCS_SETUP_VALUES,
  buildDocsSetupPlan,
  findFirstInvalidStep,
  suggestDocsPath,
  summarizeDocsSetupStep,
  validateDocsSetupStep,
  type DocsSetupContext,
  type DocsSetupValues,
} from '@/components/new-content/docs-setup/docs-setup-form';
import { describeAddressChecks, flattenDetail } from '@/components/new-content/docs-setup/describe-address-checks';
import { describeSetupOutcome } from '@/components/new-content/docs-setup/describe-setup-outcome';
import { buildPutUnderOptions, indentOptionLabel } from '@/components/new-content/docs-tree-options';

const context: DocsSetupContext = {
  base: 'acme.com',
  sites: [
    { id: 'site-a', name: 'Acme', siteUrl: 'https://acme.com', isDefault: true },
    { id: 'site-b', name: 'Help center', siteUrl: 'https://help.acme.com', isDefault: false },
  ],
  takenPaths: [],
};

const values = (changes: Partial<DocsSetupValues> = {}): DocsSetupValues => ({ ...DEFAULT_DOCS_SETUP_VALUES, name: 'Acme Docs', ...changes });

describe('docs setup checks, step by step', () => {
  it('step 1 needs a name', () => {
    expect(validateDocsSetupStep({ step: 1, values: values({ name: '   ' }), context })).toEqual({ name: 'Give your docs a name.' });
    expect(validateDocsSetupStep({ step: 1, values: values(), context })).toEqual({});
    expect(validateDocsSetupStep({ step: 1, values: values({ name: 'x'.repeat(201) }), context }).name).toContain('under 200');
  });

  it('step 2 checks the address part on this site', () => {
    expect(validateDocsSetupStep({ step: 2, values: values({ path: 'my docs' }), context }).address).toContain('letters, numbers and dashes');
    expect(validateDocsSetupStep({ step: 2, values: values({ path: 'docs' }), context })).toEqual({});
  });

  it('step 2 says so when other docs on this site already use the address, instead of quietly moving it', () => {
    const withDocs = { ...context, takenPaths: ['docs'] };
    expect(validateDocsSetupStep({ step: 2, values: values({ path: 'Docs' }), context: withDocs }).address).toBe('Other docs on this site already use /docs. Pick another address.');
    expect(validateDocsSetupStep({ step: 2, values: values({ path: 'reference' }), context: withDocs })).toEqual({});
  });

  it('starts the address at docs, or makes a free one from the name when docs is taken', () => {
    expect(suggestDocsPath({ name: 'API Reference', takenPaths: [] })).toBe('docs');
    expect(suggestDocsPath({ name: 'API Reference', takenPaths: ['docs'] })).toBe('api-reference');
    expect(suggestDocsPath({ name: 'API Reference', takenPaths: ['docs', 'api-reference', 'api-reference-2'] })).toBe('api-reference-3');
    expect(suggestDocsPath({ name: '!!!', takenPaths: ['docs'] })).toBe('docs-2');
  });

  it('step 2 checks the first part of an address of its own, and that no site has it yet', () => {
    const own = { place: 'own-address' as const };
    expect(validateDocsSetupStep({ step: 2, values: values({ ...own, subdomain: '' }), context }).address).toContain('first part');
    expect(validateDocsSetupStep({ step: 2, values: values({ ...own, subdomain: 'help' }), context }).address).toBe('Help center already uses this address.');
    expect(validateDocsSetupStep({ step: 2, values: values({ ...own, subdomain: 'docs' }), context })).toEqual({});
  });

  it('step 3 is only switches, so it cannot be wrong', () => {
    expect(validateDocsSetupStep({ step: 3, values: values({ search: false }), context })).toEqual({});
  });

  it('finish goes back to the first step with a problem', () => {
    expect(findFirstInvalidStep({ values: values({ name: '', path: '!!' }), context })?.step).toBe(1);
    expect(findFirstInvalidStep({ values: values({ path: '!!' }), context })?.step).toBe(2);
    expect(findFirstInvalidStep({ values: values(), context })).toBeNull();
  });
});

describe('the plan the last step hands over', () => {
  it('on this site: the name, the address part, the logo, search and the four page features, as chosen', () => {
    const plan = buildDocsSetupPlan({
      values: values({ name: '  Acme Docs ', logoUrl: ' /uploads/logo.png ', path: 'Help', search: false, toc: false, copyPage: false }),
      context,
      activeSiteId: 'site-a',
    });
    expect(plan).toEqual({
      place: 'this-site',
      activeSiteId: 'site-a',
      host: '',
      docs: {
        name: 'Acme Docs',
        slug: 'help',
        logoUrl: '/uploads/logo.png',
        search: false,
        features: { sidebar: true, toc: false, prevNext: true, copyPage: false },
      },
    });
  });

  it('leaves the logo out when none was chosen', () => {
    expect(buildDocsSetupPlan({ values: values(), context, activeSiteId: 'site-a' }).docs).not.toHaveProperty('logoUrl');
  });

  it('on its own address: the whole address to attach, and the home keeps the address part docs', () => {
    const plan = buildDocsSetupPlan({ values: values({ place: 'own-address', subdomain: 'Docs' }), context, activeSiteId: 'site-a' });
    expect(plan.place).toBe('own-address');
    expect(plan.host).toBe('docs.acme.com');
    expect(plan.docs.slug).toBe('docs');
  });
});

describe('what the steps say once they are done', () => {
  it('names the docs, the address and what they have', () => {
    expect(summarizeDocsSetupStep({ step: 1, values: values(), context })).toBe('Acme Docs');
    expect(summarizeDocsSetupStep({ step: 2, values: values(), context })).toBe('acme.com/docs');
    expect(summarizeDocsSetupStep({ step: 2, values: values({ place: 'own-address' }), context })).toBe('docs.acme.com');
    expect(summarizeDocsSetupStep({ step: 3, values: values(), context })).toBe('Search, Sidebar and 3 more');
    expect(summarizeDocsSetupStep({ step: 3, values: values({ search: false, sidebar: false, toc: false, prevNext: false, copyPage: false }), context })).toBe('Nothing extra');
  });
});

const readiness = (changes: Partial<DomainReadinessData> = {}): DomainReadinessData => ({
  normalizedInput: 'docs.acme.com',
  checkedHostnames: ['docs.acme.com'],
  dns: { 'docs.acme.com': { ok: true, addresses: ['203.0.113.10'] } },
  ipMatch: { ok: true, skipped: false, expectedIp: '203.0.113.10', message: 'ok' },
  caddy: { ok: true, message: 'ok' },
  ...changes,
});

describe('address check, in plain words', () => {
  it('says an address that does not resolve yet needs an A record, with the value to use', () => {
    const checks = describeAddressChecks({
      data: readiness({
        dns: { 'docs.acme.com': { ok: false, addresses: [], message: 'Domain does not resolve (no A record yet)' } },
        ipMatch: { ok: false, skipped: false, expectedIp: '203.0.113.10', message: 'Cannot verify' },
        caddy: { ok: false, message: 'nope' },
      }),
      recordName: 'docs',
    });
    expect(checks.pointsHere.state).toBe('waiting');
    expect(checks.pointsHere.title).toBe("docs.acme.com doesn't point here yet");
    expect(flattenDetail(checks.pointsHere.detail)).toBe('At your domain provider, add an A record named docs with the value 203.0.113.10.');
    expect(checks.certificate).toMatchObject({ state: 'waiting', title: 'Certificate' });
    expect(flattenDetail(checks.certificate.detail)).toBe('Set up by itself once the address points here.');
  });

  it('says an address that points elsewhere must be changed', () => {
    const checks = describeAddressChecks({
      data: readiness({
        dns: { 'docs.acme.com': { ok: true, addresses: ['198.51.100.7'] } },
        ipMatch: { ok: false, skipped: false, expectedIp: '203.0.113.10', message: 'Expected' },
      }),
      recordName: 'docs',
    });
    expect(checks.pointsHere.title).toBe('docs.acme.com points somewhere else');
    expect(flattenDetail(checks.pointsHere.detail)).toBe('It points to 198.51.100.7. Change its A record to 203.0.113.10.');
  });

  it('is ready when it points here and the web server answers for it', () => {
    const checks = describeAddressChecks({ data: readiness(), recordName: 'docs' });
    expect(checks.pointsHere).toMatchObject({ state: 'ok', title: 'docs.acme.com points here' });
    expect(checks.certificate).toMatchObject({ state: 'ok', title: 'Certificate is ready' });
  });

  it('does not claim to know when the server could not say which address is its own', () => {
    const checks = describeAddressChecks({
      data: readiness({ ipMatch: { ok: true, skipped: true, expectedIp: null, message: 'Set it' }, caddy: { ok: true, skipped: true, message: 'skipped' } }),
      recordName: 'docs',
    });
    expect(checks.pointsHere.state).toBe('unsure');
    expect(flattenDetail(checks.pointsHere.detail)).toContain("We can't tell if that is this server.");
    expect(checks.certificate.state).toBe('unsure');
  });

  it('needs nothing for a local address', () => {
    const checks = describeAddressChecks({
      data: readiness({
        normalizedInput: 'docs.localhost',
        checkedHostnames: ['docs.localhost'],
        dns: { 'docs.localhost': { ok: true, addresses: [], skipped: true } },
        ipMatch: { ok: true, skipped: true, expectedIp: null, message: '' },
        caddy: { ok: true, skipped: true, message: '' },
      }),
      recordName: 'docs',
    });
    expect(checks.pointsHere).toMatchObject({ state: 'ok', title: 'docs.localhost is a local address' });
    expect(checks.certificate).toMatchObject({ state: 'ok', title: 'No certificate needed' });
  });
});

describe('the message after setup', () => {
  const finished = (changes: Partial<Extract<Parameters<typeof describeSetupOutcome>[0]['outcome'], { ok: true }>> = {}) => ({
    ok: true as const,
    siteId: 'site-a',
    homeId: 'home-1',
    path: '/docs',
    ownSite: false,
    address: { state: 'none' as const },
    ...changes,
  });

  it('just says the docs are ready when nothing changed', () => {
    expect(describeSetupOutcome({ outcome: finished(), asked: 'docs' })).toEqual({ title: 'Your docs are ready', description: null });
  });

  it('says where the docs really are when the address part was taken', () => {
    expect(describeSetupOutcome({ outcome: finished({ path: '/docs-2' }), asked: 'docs' }).description).toBe('They are at /docs-2 because /docs was taken.');
  });

  it('says a connected address is connected, and that the docs site is now the one being worked on', () => {
    const outcome = finished({ ownSite: true, address: { state: 'attached', host: 'docs.acme.com', notice: null } });
    expect(describeSetupOutcome({ outcome, asked: 'docs' }).description).toBe('docs.acme.com is connected. You are now working on that site.');
  });

  it('says an address that is not ready yet is waiting, and where to finish it', () => {
    const outcome = finished({ ownSite: true, address: { state: 'waiting', host: 'docs.acme.com', reason: 'It does not resolve yet.' } });
    const { description } = describeSetupOutcome({ outcome, asked: 'docs' });
    expect(description).toContain("docs.acme.com isn't connected yet. It does not resolve yet.");
    expect(description).toContain('the docs open from the admin preview');
    expect(description).toContain('Add the address in Sites');
  });
});

describe('where a new docs page can go', () => {
  const tree: DocsTree = {
    home: {
      id: 'home',
      title: 'Acme Docs',
      slug: 'docs',
      path: '/docs',
      parentId: null,
      menuOrder: 0,
      status: 'publish',
      kind: 'page',
      hidden: false,
      children: [
        {
          id: 'start',
          title: 'Getting started',
          slug: 'getting-started',
          path: '/docs/getting-started',
          parentId: 'home',
          menuOrder: 0,
          status: 'publish',
          kind: 'group',
          hidden: false,
          children: [
            { id: 'install', title: 'Install', slug: 'install', path: '/docs/getting-started/install', parentId: 'start', menuOrder: 0, status: 'publish', kind: 'page', hidden: false, children: [] },
          ],
        },
        { id: 'secret', title: 'Internal', slug: 'internal', path: '/docs/internal', parentId: 'home', menuOrder: 1, status: 'draft', kind: 'page', hidden: true, children: [] },
      ],
    },
    settings: {
      title: 'Acme Docs',
      logoUrl: '',
      logoDarkUrl: '',
      links: [],
      button: { label: '', url: '' },
      search: { show: true, label: 'Search', placeholder: 'Search the docs' },
      features: { sidebar: true, toc: true, prevNext: true, copyPage: true },
    },
  };

  it('lists the top of the docs, then every group and page in sidebar order, marking groups and hidden pages', () => {
    const options = buildPutUnderOptions({ tree });
    expect(options.map((option) => [option.value, option.label, option.depth])).toEqual([
      ['home', 'Top level of the docs', 0],
      ['start', 'Getting started (group)', 1],
      ['install', 'Install', 2],
      ['secret', 'Internal (hidden)', 1],
    ]);
  });

  it('indents deeper levels so a plain select still shows what sits in what', () => {
    const [, group, page] = buildPutUnderOptions({ tree });
    expect(indentOptionLabel(group)).toBe('Getting started (group)');
    expect(indentOptionLabel(page)).toBe('   Install');
  });
});
