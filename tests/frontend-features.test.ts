import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useParams: () => ({ id: '12' }),
}));

import { AppSidebar } from '../apps/web/components/layout/AppSidebar';
import { AppHeader } from '../apps/web/components/layout/AppHeader';
import { Shell } from '../apps/web/components/layout/Shell';
import { ApiStatusBadge } from '../apps/web/components/layout/ApiStatusBadge';
import {
  Badge,
  StatusBadge,
  VerificationBadge,
  HealthBadge,
  LinkKindBadge,
} from '../apps/web/components/ui/Badge';
import { Card } from '../apps/web/components/ui/Card';
import { EmptyState } from '../apps/web/components/ui/EmptyState';
import { ErrorAlert } from '../apps/web/components/ui/ErrorAlert';
import { Spinner } from '../apps/web/components/ui/Spinner';
import { DecisionCard } from '../apps/web/components/decisions/DecisionCard';
import { EvidenceLedger } from '../apps/web/components/decisions/EvidenceLedger';
import { AlternativesList } from '../apps/web/components/decisions/AlternativesList';
import { CodeConnections } from '../apps/web/components/decisions/CodeConnections';
import { TimelineTrail } from '../apps/web/components/decisions/TimelineTrail';
import { ConfidenceMeter } from '../apps/web/components/decisions/ConfidenceMeter';
import { PriorArtWarningCard } from '../apps/web/components/sandbox/PriorArtWarningCard';
import { parseRepoTarget, formatDate, formatPercent } from '../apps/web/lib/formatters';
import type {
  DecisionCard as DecisionCardType,
  Evidence,
  Alternative,
  PriorArtItem,
} from '@decisionvault/shared/api';

describe('Frontend Shell & Layout Components', () => {
  it('renders AppSidebar with required navigation links', () => {
    const html = renderToStaticMarkup(
      React.createElement(AppSidebar, { isOpen: false, onClose: () => {} }),
    );
    expect(html).toContain('Overview');
    expect(html).toContain('Decision Explorer');
    expect(html).toContain('Import Repository');
    expect(html).toContain('Prior-Decision Warning');
    expect(html).toContain('gemma4:e4b');
  });

  it('renders AppHeader with repository selector', () => {
    const html = renderToStaticMarkup(
      React.createElement(AppHeader, { onToggleSidebar: () => {} }),
    );
    expect(html).toContain('Repository:');
    expect(html).toContain('All Repositories');
  });

  it('renders Shell wrapping child content', () => {
    const html = renderToStaticMarkup(
      React.createElement(Shell, {
        children: React.createElement('div', null, 'Shell Test Body'),
      }),
    );
    expect(html).toContain('Shell Test Body');
    expect(html).toContain('DecisionVault');
  });

  it('renders ApiStatusBadge in initial checking state', () => {
    const html = renderToStaticMarkup(React.createElement(ApiStatusBadge));
    expect(html).toContain('Checking API...');
  });
});

describe('UI Primitives and State Components', () => {
  it('renders StatusBadge for accepted, rejected, and unresolved', () => {
    const accepted = renderToStaticMarkup(React.createElement(StatusBadge, { status: 'accepted' }));
    expect(accepted).toContain('Accepted');

    const rejected = renderToStaticMarkup(React.createElement(StatusBadge, { status: 'rejected' }));
    expect(rejected).toContain('Rejected');

    const unresolved = renderToStaticMarkup(
      React.createElement(StatusBadge, { status: 'unresolved' }),
    );
    expect(unresolved).toContain('Unresolved');
  });

  it('renders VerificationBadge for exact, fuzzy, and unverified claims', () => {
    const exact = renderToStaticMarkup(
      React.createElement(VerificationBadge, {
        verified: true,
        method: 'normalized_exact',
        score: 1.0,
      }),
    );
    expect(exact).toContain('Evidence Locked (Exact)');

    const fuzzy = renderToStaticMarkup(
      React.createElement(VerificationBadge, {
        verified: true,
        method: 'fuzzy',
        score: 0.92,
      }),
    );
    expect(fuzzy).toContain('Approximate (92%)');

    const unverified = renderToStaticMarkup(
      React.createElement(VerificationBadge, {
        verified: false,
        method: 'none',
        score: 0,
      }),
    );
    expect(unverified).toContain('Unverified Claim');
  });

  it('renders HealthBadge for holds, may_not_hold, and unknown states', () => {
    const holds = renderToStaticMarkup(React.createElement(HealthBadge, { state: 'holds' }));
    expect(holds).toContain('Constraint Holds');

    const mayNotHold = renderToStaticMarkup(
      React.createElement(HealthBadge, { state: 'may_not_hold' }),
    );
    expect(mayNotHold).toContain('May Not Hold (Reopen Radar)');

    const unknown = renderToStaticMarkup(React.createElement(HealthBadge, { state: 'unknown' }));
    expect(unknown).toContain('State Unknown');
  });

  it('renders EmptyState with title, description, and optional action', () => {
    const html = renderToStaticMarkup(
      React.createElement(EmptyState, {
        title: 'No Data Available',
        description: 'Please adjust your filter parameters.',
        action: { label: 'Reset Filters', onClick: () => {} },
      }),
    );
    expect(html).toContain('No Data Available');
    expect(html).toContain('Please adjust your filter parameters.');
    expect(html).toContain('Reset Filters');
  });

  it('renders ErrorAlert with 501 Not Implemented state and fixture preview button', () => {
    const html = renderToStaticMarkup(
      React.createElement(ErrorAlert, {
        error: 'Endpoint is not yet operational',
        isNotImplemented: true,
        onPreviewFixture: () => {},
      }),
    );
    expect(html).toContain('501');
    expect(html).toContain('Backend Endpoint In Development (Phase 2)');
    expect(html).toContain('Preview Frozen Contract Fixture');
  });

  it('renders ErrorAlert with standard retryable error', () => {
    const html = renderToStaticMarkup(
      React.createElement(ErrorAlert, {
        error: 'Network timeout',
        isNotImplemented: false,
        onRetry: () => {},
      }),
    );
    expect(html).toContain('Request Failed');
    expect(html).toContain('Network timeout');
    expect(html).toContain('Retry Request');
  });

  it('renders Spinner with accessible label', () => {
    const html = renderToStaticMarkup(React.createElement(Spinner, { size: 'md' }));
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Loading"');
  });
});

describe('Repository Target Validation', () => {
  it('correctly parses valid owner/repo targets and GitHub URLs', () => {
    expect(parseRepoTarget('python/cpython')).toEqual({ owner: 'python', repo: 'cpython' });
    expect(parseRepoTarget('https://github.com/pallets/flask')).toEqual({
      owner: 'pallets',
      repo: 'flask',
    });
    expect(parseRepoTarget('https://github.com/torvalds/linux.git')).toEqual({
      owner: 'torvalds',
      repo: 'linux',
    });
  });

  it('rejects invalid repository targets', () => {
    expect(parseRepoTarget('')).toBeNull();
    expect(parseRepoTarget('singleword')).toBeNull();
    expect(parseRepoTarget('too/many/nested/parts')).toBeNull();
    expect(parseRepoTarget('https://gitlab.com/other/repo')).toBeNull();
  });
});

describe('Decision Components & Evidence Presentation', () => {
  const mockDecisionCard: DecisionCardType = {
    id: 12,
    title: 'Remove CGI and related dead-battery modules (PEP 594)',
    status: 'accepted',
    lifecycle: 'active',
    summary: 'Deprecate and remove cgi and other unmaintained standard library modules.',
    confidence: 0.94,
    sourceUrl: 'https://discuss.python.org/t/pep-594-removing-dead-batteries/1932',
    sourceTitle: 'PEP 594: Removing dead batteries',
    verifiedRatio: 0.92,
  };

  it('renders DecisionCard with title, summary, confidence, and source link', () => {
    const html = renderToStaticMarkup(
      React.createElement(DecisionCard, { decision: mockDecisionCard }),
    );
    expect(html).toContain('Remove CGI and related dead-battery modules');
    expect(html).toContain('Accepted');
    expect(html).toContain('94%');
    expect(html).toContain('92%');
    expect(html).toContain('https://discuss.python.org/t/pep-594-removing-dead-batteries/1932');
  });

  it('clearly tags DecisionCard as sample fixture when isSampleData is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(DecisionCard, { decision: mockDecisionCard, isSampleData: true }),
    );
    expect(html).toContain('Sample Fixture');
  });

  it('renders EvidenceLedger with exact quotes, author role, and source comment link', () => {
    const mockEvidence: Evidence[] = [
      {
        id: 501,
        quote:
          'The cgi module has security liabilities and modern web frameworks have replaced it.',
        claimType: 'rejection_reason',
        verified: true,
        method: 'normalized_exact',
        score: 1.0,
        author: 'brettcannon',
        role: 'owner',
        at: '2019-05-20T14:32:00.000Z',
        url: 'https://discuss.python.org/t/pep-594/1932/4',
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(EvidenceLedger, { evidenceList: mockEvidence }),
    );
    expect(html).toContain('The cgi module has security liabilities');
    expect(html).toContain('@brettcannon');
    expect(html).toContain('owner');
    expect(html).toContain('Evidence Locked (Exact)');
    expect(html).toContain('https://discuss.python.org/t/pep-594/1932/4');
  });

  it('clearly labels EvidenceLedger quotes as sample data when isSampleData is true', () => {
    const mockEvidence: Evidence[] = [
      {
        id: 501,
        quote:
          'The cgi module has security liabilities and modern web frameworks have replaced it.',
        claimType: 'rejection_reason',
        verified: true,
        method: 'normalized_exact',
        score: 1.0,
        author: 'brettcannon',
        role: 'owner',
        at: '2019-05-20T14:32:00.000Z',
        url: 'https://discuss.python.org/t/pep-594/1932/4',
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(EvidenceLedger, { evidenceList: mockEvidence, isSampleData: true }),
    );
    expect(html).toContain('Sample Data');
    expect(html).toContain('(Sample Demonstration)');
  });

  it('renders AlternativesList separating accepted vs rejected alternatives with reasons', () => {
    const mockAlternatives: Alternative[] = [
      {
        id: 101,
        name: 'Retain cgi with community maintainers',
        description: 'Keep cgi in standard library.',
        outcome: 'rejected',
        reason: 'Security vulnerabilities in multipart parsing.',
        reasonCategory: 'security',
        evidence: [],
        conditions: [
          {
            id: 201,
            text: 'Requires modern multipart parsing outside standard library',
            kind: 'dependency',
            probe: 'none',
            probeValue: null,
            health: {
              state: 'may_not_hold',
              signalType: 'package',
              signalPath: 'pyproject.toml',
              signalValue: 'multipart>=0.0.5',
              details: 'Package widely available',
              interpretation: 'Constraint may not hold as ecosystem evolved.',
              checkedAt: '2026-10-31T21:00:00.000Z',
            },
          },
        ],
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(AlternativesList, { alternatives: mockAlternatives }),
    );
    expect(html).toContain('Retain cgi with community maintainers');
    expect(html).toContain('Security vulnerabilities in multipart parsing.');
    expect(html).toContain('Category: security');
    expect(html).toContain('May Not Hold (Reopen Radar)');
    expect(html).toContain('This historical rejection may deserve reconsideration');
  });

  it('renders CodeConnections with rename tracking and link basis', () => {
    const mockFiles = [
      {
        path: 'Lib/cgi.py',
        currentPath: null,
        linkKind: 'mentioned' as const,
        basis: 'Explicit file mention in deprecation discussion quote',
        commitSha: 'b3e218204b73cb439bb7bb6293910c6abfbff191',
      },
    ];

    const html = renderToStaticMarkup(React.createElement(CodeConnections, { files: mockFiles }));
    expect(html).toContain('Lib/cgi.py');
    expect(html).toContain('Removed at HEAD');
    expect(html).toContain('Explicit file mention in deprecation discussion quote');
    expect(html).toContain('b3e2182');
  });

  it('renders ConfidenceMeter with formula breakdown parts', () => {
    const html = renderToStaticMarkup(
      React.createElement(ConfidenceMeter, {
        confidence: 0.94,
        parts: {
          coverage: 1.0,
          statement: 1.0,
          reasonCoverage: 1.0,
        },
      }),
    );
    expect(html).toContain('94%');
    expect(html).toContain('Quote Coverage (40%)');
    expect(html).toContain('Statement Author (40%)');
    expect(html).toContain('Reason Coverage (20%)');
  });

  it('renders TimelineTrail with sorted events and dates', () => {
    const mockEvents = [
      {
        type: 'proposed' as const,
        at: '2019-05-18T10:00:00.000Z',
        url: 'https://discuss.python.org/t/pep-594/1',
      },
      {
        type: 'decided' as const,
        at: '2021-03-12T16:00:00.000Z',
        url: 'https://discuss.python.org/t/pep-594/25',
      },
    ];

    const html = renderToStaticMarkup(React.createElement(TimelineTrail, { events: mockEvents }));
    expect(html).toContain('Proposed');
    expect(html).toContain('Decided');
    expect(html).toContain('https://discuss.python.org/t/pep-594/1');
  });
});

describe('Prior-Decision Warning Presentation Component', () => {
  const mockPriorArtItem: PriorArtItem = {
    decision: {
      id: 12,
      title: 'Remove CGI and related dead-battery modules (PEP 594)',
      status: 'accepted',
      lifecycle: 'active',
      summary: 'Deprecate and remove cgi from standard library.',
      confidence: 0.94,
      sourceUrl: 'https://discuss.python.org/t/pep-594/1932',
      sourceTitle: 'PEP 594 discussion',
      verifiedRatio: 0.92,
    },
    relation: 'conflicts',
    reason: 'Proposal re-introduces cgi module which was explicitly removed in Python 3.13.',
    evidence: [
      {
        id: 501,
        quote:
          'The cgi module has security liabilities and modern web frameworks have replaced it.',
        claimType: 'rejection_reason',
        verified: true,
        method: 'normalized_exact',
        score: 1.0,
        author: 'brettcannon',
        role: 'owner',
        at: '2019-05-20T14:32:00.000Z',
        url: 'https://discuss.python.org/t/pep-594/1932/4',
      },
    ],
    rejectedBecause: 'Security vulnerabilities in multipart parsing and lack of maintainers.',
    conditions: [],
    reconsiderIf: 'Reconsider only if a sandboxed, zero-dependency parser is contributed.',
  };

  it('renders PriorArtWarningCard with relation, reason, rejected-because, and reconsider-if', () => {
    const html = renderToStaticMarkup(
      React.createElement(PriorArtWarningCard, {
        item: mockPriorArtItem,
        affectedFiles: ['Lib/cgi.py'],
      }),
    );
    expect(html).toContain('Relation: conflicts');
    expect(html).toContain('Remove CGI and related dead-battery modules');
    expect(html).toContain('Proposal re-introduces cgi module');
    expect(html).toContain('Historically Rejected Because:');
    expect(html).toContain('Security vulnerabilities in multipart parsing');
    expect(html).toContain('Reconsideration Conditions (Reopen Radar):');
    expect(html).toContain('Lib/cgi.py');
    expect(html).toContain('The cgi module has security liabilities');
  });

  it('clearly marks PriorArtWarningCard as sample precedent when isSampleData is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(PriorArtWarningCard, {
        item: mockPriorArtItem,
        affectedFiles: ['Lib/cgi.py'],
        isSampleData: true,
      }),
    );
    expect(html).toContain('Sample Precedent');
  });
});
