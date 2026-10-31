import { describe, expect, it } from 'vitest';
import React from 'react';
import RootLayout from '../apps/web/app/layout';
import HomePage from '../apps/web/app/page';
import NotFound from '../apps/web/app/not-found';

describe('Frontend Component State & Scaffold Verification', () => {
  it('renders HomePage without fabricated metrics or fake decision counts', () => {
    const pageElement = HomePage();
    expect(React.isValidElement(pageElement)).toBe(true);
    // Convert to JSON or inspect props
    const serialized = JSON.stringify(pageElement);
    expect(serialized).toContain('DecisionVault');
    expect(serialized).toContain('Contract Freeze Active');
    expect(serialized).toContain('gemma4:e4b');
    // Ensure no fake claims that pipeline extraction is finished
    expect(serialized).toContain('Pipeline ingestion & extraction (Phase 2)');
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
});
