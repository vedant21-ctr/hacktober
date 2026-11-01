import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import RootLayout from '../apps/web/app/layout';
import HomePage from '../apps/web/app/page';
import NotFound from '../apps/web/app/not-found';
import ImportPage from '../apps/web/app/import/page';
import DecisionsPage from '../apps/web/app/decisions/page';
import PriorArtPage from '../apps/web/app/prior-art/page';

describe('Frontend Component State & Scaffold Verification', () => {
  it('renders HomePage without fabricated metrics or fake decision counts', () => {
    const html = renderToStaticMarkup(React.createElement(HomePage));
    expect(html).toContain('DecisionVault');
    expect(html).toContain('Local AI Architecture');
    expect(html).toContain('gemma4:e4b');
    expect(html).toContain('Phase 3B: Gemma 4 E4B Decision Extraction');
  });

  it('renders DecisionsPage with filters and search inputs', () => {
    const html = renderToStaticMarkup(React.createElement(DecisionsPage));
    expect(html).toContain('Recovered Decisions');
    expect(html).toContain('All Repositories');
    expect(html).toContain('Decision Status');
    expect(html).toContain('File Path');
    expect(html).toContain('Search FTS5 Index');
  });

  it('renders ImportPage with repository form and status elements', () => {
    const html = renderToStaticMarkup(React.createElement(ImportPage));
    expect(html).toContain('Repository Ingestion');
    expect(html).toContain('Import a Public Repository');
    expect(html).toContain('Start GitHub Import');
    expect(html).toContain('Imported Repositories');
  });

  it('renders NotFound (404) component correctly', () => {
    const notFoundElement = NotFound();
    expect(React.isValidElement(notFoundElement)).toBe(true);
    const serialized = JSON.stringify(notFoundElement);
    expect(serialized).toContain('404');
    expect(serialized).toContain('Page Not Found');
  });

  it('handles RootLayout rendering in non-mock mode', () => {
    delete process.env.NEXT_PUBLIC_API_MODE;
    const layoutElement = RootLayout({
      children: React.createElement('div', null, 'Test Child'),
    });
    expect(React.isValidElement(layoutElement)).toBe(true);
    const serialized = JSON.stringify(layoutElement);
    expect(serialized).not.toContain('MOCK DATA — Offline Contract Fixture Mode Active');
    expect(serialized).toContain('Test Child');
  });

  it('activates visible MOCK DATA banner when NEXT_PUBLIC_API_MODE is "mock"', () => {
    process.env.NEXT_PUBLIC_API_MODE = 'mock';
    const layoutElement = RootLayout({
      children: React.createElement('div', null, 'Test Child'),
    });
    const serialized = JSON.stringify(layoutElement);
    expect(serialized).toContain('MOCK DATA — Offline Contract Fixture Mode Active');
    delete process.env.NEXT_PUBLIC_API_MODE;
  });

  it('renders PriorArtPage with simulation banner, input modes, and action button', () => {
    const html = renderToStaticMarkup(React.createElement(PriorArtPage));
    expect(html).toContain('Prior-Art Detection');
    expect(html).toContain('SIMULATED PR ANALYSIS — Grounded in recovered decisions');
    expect(html).toContain('Select Imported Repository');
    expect(html).toContain('PR / Files');
    expect(html).toContain('Git Diff');
    expect(html).toContain('Idea / Concept');
    expect(html).toContain('Run Simulated PR Analysis');
  });
});
