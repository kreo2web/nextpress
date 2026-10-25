import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { CreateDocsInput, CreateDocsResult } from '@shared/docs';
import type { DocsSetupPlan } from '@/components/new-content/docs-setup/docs-setup-form';
import { createDocsSetupRunner, type DocsSetupApi } from '@/components/new-content/docs-setup/docs-setup-run';

const failure = (message: string, status?: number): Error => Object.assign(new Error(message), status === undefined ? {} : { status });

const docsResult = ({ siteId, path = '/docs' }: { siteId: string; path?: string }): CreateDocsResult => ({
  homeId: 'home-1',
  docs: { homeId: 'home-1', siteId, name: 'Acme Docs', path, pageCount: 1, searchOn: true, status: 'draft' },
});

const makeApi = (overrides: Partial<DocsSetupApi> = {}): DocsSetupApi => ({
  createSite: vi.fn(async () => ({ site: { id: 'site-new', name: 'Acme Docs', siteUrl: null, isDefault: false }, notice: null })),
  createDocs: vi.fn(async (input: CreateDocsInput) => docsResult({ siteId: input.siteId })),
  setHomepage: vi.fn(async () => undefined),
  attachAddress: vi.fn(async ({ host }) => ({ site: { id: 'site-new', name: 'Acme Docs', siteUrl: `https://${host}`, isDefault: false }, notice: null })),
  ...overrides,
});

const plan = (changes: Partial<DocsSetupPlan> = {}): DocsSetupPlan => ({
  place: 'own-address',
  activeSiteId: 'site-a',
  host: 'docs.acme.com',
  docs: {
    name: 'Acme Docs',
    slug: 'docs',
    search: true,
    features: { sidebar: true, toc: true, prevNext: true, copyPage: true },
  },
  ...changes,
});

const run = (runner: ReturnType<typeof createDocsSetupRunner>, forPlan = plan()) => runner.run({ plan: forPlan, onStage: () => undefined });

describe('docs setup runner', () => {
  let logged: MockInstance<typeof console.error>;

  beforeEach(() => {
    logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => logged.mockRestore());

  it('on this site makes only the docs, on the site being worked on', async () => {
    const api = makeApi();
    const outcome = await run(createDocsSetupRunner({ api }), plan({ place: 'this-site', host: '' }));

    expect(outcome).toEqual({ ok: true, siteId: 'site-a', homeId: 'home-1', path: '/docs', ownSite: false, address: { state: 'none' } });
    expect(api.createDocs).toHaveBeenCalledWith({ ...plan().docs, siteId: 'site-a' });
    expect(api.createSite).not.toHaveBeenCalled();
    expect(api.setHomepage).not.toHaveBeenCalled();
    expect(api.attachAddress).not.toHaveBeenCalled();
  });

  it('on its own address makes the site, the docs on it, the homepage, then connects the address, in that order', async () => {
    const order: string[] = [];
    const api = makeApi({
      createSite: vi.fn(async () => {
        order.push('site');
        return { site: { id: 'site-new', name: 'Acme Docs', siteUrl: null, isDefault: false }, notice: null };
      }),
      createDocs: vi.fn(async (input: CreateDocsInput) => {
        order.push(`docs on ${input.siteId}`);
        return docsResult({ siteId: input.siteId });
      }),
      setHomepage: vi.fn(async ({ siteId, slug }) => void order.push(`homepage ${slug} of ${siteId}`)),
      attachAddress: vi.fn(async ({ siteId, host }) => {
        order.push(`address ${host} on ${siteId}`);
        return { site: { id: siteId, name: 'Acme Docs', siteUrl: `https://${host}`, isDefault: false }, notice: 'Saved.' };
      }),
    });

    const outcome = await run(createDocsSetupRunner({ api }));

    expect(order).toEqual(['site', 'docs on site-new', 'homepage docs of site-new', 'address docs.acme.com on site-new']);
    expect(api.createSite).toHaveBeenCalledWith({ name: 'Acme Docs' });
    expect(outcome).toEqual({
      ok: true,
      siteId: 'site-new',
      homeId: 'home-1',
      path: '/docs',
      ownSite: true,
      address: { state: 'attached', host: 'docs.acme.com', notice: 'Saved.' },
    });
  });

  it('makes the docs the homepage by the address the docs really got', async () => {
    const api = makeApi({ createDocs: vi.fn(async (input: CreateDocsInput) => docsResult({ siteId: input.siteId, path: '/docs-2' })) });
    const outcome = await run(createDocsSetupRunner({ api }));

    expect(api.setHomepage).toHaveBeenCalledWith({ siteId: 'site-new', slug: 'docs-2' });
    expect(outcome).toMatchObject({ ok: true, path: '/docs-2' });
  });

  it('still finishes when the address is not ready yet, and keeps the server reason', async () => {
    const reason = 'Domain "docs.acme.com" does not resolve. Please point your DNS A record to this server before configuring.';
    const api = makeApi({ attachAddress: vi.fn(async () => Promise.reject(failure(reason, 400))) });

    const outcome = await run(createDocsSetupRunner({ api }));

    expect(outcome).toMatchObject({ ok: true, ownSite: true, address: { state: 'waiting', host: 'docs.acme.com', reason } });
    expect(logged).toHaveBeenCalledWith(expect.objectContaining({ atFunction: 'docsSetup.attachAddress', data: expect.objectContaining({ siteId: 'site-new', host: 'docs.acme.com' }) }));
  });

  it('says why the site could not be made, in the server words when it sent some', async () => {
    const api = makeApi({ createSite: vi.fn(async () => Promise.reject(failure("Only the main site's admins can add sites.", 403))) });
    const outcome = await run(createDocsSetupRunner({ api }));

    expect(outcome).toEqual({ ok: false, at: 'site', message: "Only the main site's admins can add sites." });
    expect(api.createDocs).not.toHaveBeenCalled();
  });

  it('uses its own words when the call never reached the server', async () => {
    const api = makeApi({ createSite: vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))) });
    const outcome = await run(createDocsSetupRunner({ api }));

    expect(outcome).toEqual({ ok: false, at: 'site', message: "We couldn't create the new address. Check your connection and try again." });
  });

  it('does not make a second site when "Try again" follows a docs failure', async () => {
    const createDocs = vi
      .fn<DocsSetupApi['createDocs']>()
      .mockRejectedValueOnce(failure("Couldn't finish that. Please try again.", 500))
      .mockImplementation(async (input) => docsResult({ siteId: input.siteId }));
    const api = makeApi({ createDocs });
    const runner = createDocsSetupRunner({ api });

    const first = await run(runner);
    expect(first).toEqual({
      ok: false,
      at: 'docs',
      message: "The new site was made, but your docs couldn't be set up in it. Couldn't finish that. Please try again.",
    });

    const second = await run(runner);
    expect(second).toMatchObject({ ok: true, siteId: 'site-new' });
    expect(api.createSite).toHaveBeenCalledTimes(1);
    expect(createDocs).toHaveBeenCalledTimes(2);
    expect(createDocs).toHaveBeenLastCalledWith(expect.objectContaining({ siteId: 'site-new' }));
  });

  it('carries on from the homepage when "Try again" follows a homepage failure, without making the docs twice', async () => {
    const setHomepage = vi
      .fn<DocsSetupApi['setHomepage']>()
      .mockRejectedValueOnce(failure('Failed to set option', 500))
      .mockResolvedValue(undefined);
    const api = makeApi({ setHomepage });
    const runner = createDocsSetupRunner({ api });

    const first = await run(runner);
    expect(first).toEqual({
      ok: false,
      at: 'homepage',
      message: "Your docs are created, but we couldn't make them the front page of docs.acme.com. Try again.",
    });

    const second = await run(runner);
    expect(second).toMatchObject({ ok: true, homeId: 'home-1' });
    expect(api.createSite).toHaveBeenCalledTimes(1);
    expect(api.createDocs).toHaveBeenCalledTimes(1);
    expect(setHomepage).toHaveBeenCalledTimes(2);
  });

  it('logs the ids that explain a failure, never only a bare message', async () => {
    const api = makeApi({ createDocs: vi.fn(async () => Promise.reject(failure('Boom', 500))) });
    await run(createDocsSetupRunner({ api }));

    expect(logged).toHaveBeenCalledWith(
      expect.objectContaining({
        atFunction: 'docsSetup.createDocs',
        data: expect.objectContaining({ siteId: 'site-new', error: expect.any(Error) }),
      }),
    );
  });
});
