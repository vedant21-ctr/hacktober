/**
 * DecisionVault Fictional Demonstration Repository
 * Repository: acme-inc/payment-service
 *
 * Explicitly labeled fictional engineering discussions, decisions, and evidence
 * for offline demonstration and hackathon evaluation.
 */

export interface DemoCommentData {
  externalId: string;
  idx: number;
  author: string;
  authorRole: 'owner' | 'member' | 'collaborator' | 'contributor';
  createdAt: string;
  body: string;
  url: string;
}

export interface DemoEvidenceData {
  quote: string;
  claimType: 'decision_statement' | 'rejection_reason' | 'proposal' | 'condition';
  commentExternalId: string;
}

export interface DemoAlternativeData {
  name: string;
  description: string;
  outcome: 'chosen' | 'rejected' | 'open';
  reason: string;
  reasonCategory:
    | 'compatibility'
    | 'performance'
    | 'security'
    | 'maintenance'
    | 'complexity'
    | 'policy'
    | 'infrastructure'
    | 'other';
  evidenceQuote?: string;
}

export interface DemoFileLinkData {
  path: string;
  currentPath: string;
  linkKind: 'mentioned' | 'pr_diff' | 'symbol' | 'rename_tracked';
  basis: string;
}

export interface DemoDecisionData {
  title: string;
  status: 'accepted' | 'rejected' | 'superseded' | 'proposed';
  lifecycle: 'active' | 'superseded' | 'deprecated';
  summary: string;
  confidence: number;
  confidenceParts: {
    coverage: number;
    statement: number;
    reasonCoverage: number;
  };
  createdAt: string;
  alternatives: DemoAlternativeData[];
  evidence: DemoEvidenceData[];
  files: DemoFileLinkData[];
  conditions?: Array<{
    type: 'assumption' | 'runtime' | 'scale';
    statement: string;
    probe: 'none' | 'python_requires' | 'node_engines' | 'dependency_present' | 'ci_python_matrix';
    probeValue: string | null;
  }>;
}

export interface DemoSourceData {
  kind: 'github_issue' | 'github_pr';
  externalId: string;
  url: string;
  title: string;
  state: 'open' | 'closed';
  author: string;
  createdAt: string;
  closedAt: string | null;
  comments: DemoCommentData[];
  decision: DemoDecisionData;
}

export interface DemoRepositoryData {
  fullName: string;
  defaultBranch: string;
  headCommitSha: string;
  importedAt: string;
  sources: DemoSourceData[];
}

export const DEMO_REPOSITORY: DemoRepositoryData = {
  fullName: 'acme-inc/payment-service',
  defaultBranch: 'main',
  headCommitSha: 'c0ffee1428579acme7840134',
  importedAt: '2026-10-31T00:00:00.000Z',
  sources: [
    {
      kind: 'github_issue',
      externalId: 'acme-inc/payment-service#101',
      url: 'https://github.com/acme-inc/payment-service/issues/101',
      title:
        '[Fictional Demo] Architecture: Primary datastore selection for payment ledger and charges',
      state: 'closed',
      author: 'alice-lead',
      createdAt: '2026-03-10T14:22:00.000Z',
      closedAt: '2026-03-15T09:15:00.000Z',
      comments: [
        {
          externalId: 'comment-101-1',
          idx: 1,
          author: 'alice-lead',
          authorRole: 'owner',
          createdAt: '2026-03-10T14:25:00.000Z',
          body: 'We must finalize our primary datastore for the core payment ledger and account balances. Candidates on the table are PostgreSQL and MongoDB. We cannot tolerate double-spends or lost updates during checkout surges.',
          url: 'https://github.com/acme-inc/payment-service/issues/101#issuecomment-101-1',
        },
        {
          externalId: 'comment-101-2',
          idx: 2,
          author: 'bob-backend',
          authorRole: 'member',
          createdAt: '2026-03-12T10:11:00.000Z',
          body: 'MongoDB has convenient flexible document schemas, but MongoDB lacks multi-document cross-collection ACID guarantees at our scale, risking phantom double-spend writes during high-concurrency race conditions.',
          url: 'https://github.com/acme-inc/payment-service/issues/101#issuecomment-101-2',
        },
        {
          externalId: 'comment-101-3',
          idx: 3,
          author: 'alice-lead',
          authorRole: 'owner',
          createdAt: '2026-03-15T09:00:00.000Z',
          body: 'Agreed with Bob. We will adopt PostgreSQL with strict SERIALIZABLE isolation to guarantee absolute financial consistency across ledger journals.',
          url: 'https://github.com/acme-inc/payment-service/issues/101#issuecomment-101-3',
        },
      ],
      decision: {
        title: 'PostgreSQL for ACID Transaction Isolation',
        status: 'accepted',
        lifecycle: 'active',
        summary:
          'Adopted PostgreSQL with SERIALIZABLE transaction isolation for all balance and ledger state to prevent phantom writes and duplicate charges.',
        confidence: 0.95,
        confidenceParts: {
          coverage: 1.0,
          statement: 1.0,
          reasonCoverage: 0.9,
        },
        createdAt: '2026-03-15T09:15:00.000Z',
        alternatives: [
          {
            name: 'PostgreSQL with strict SERIALIZABLE isolation',
            description:
              'Relational database engine with strict serializability and row-level locking.',
            outcome: 'chosen',
            reason:
              'Guarantees strict linear consistency and multi-table atomic updates for financial records.',
            reasonCategory: 'security',
          },
          {
            name: 'MongoDB document store',
            description: 'NoSQL document database with sharded horizontal scaling.',
            outcome: 'rejected',
            reason:
              'MongoDB lacks multi-document cross-collection ACID guarantees at our scale, risking phantom double-spend writes during high-concurrency race conditions.',
            reasonCategory: 'maintenance',
            evidenceQuote:
              'MongoDB lacks multi-document cross-collection ACID guarantees at our scale, risking phantom double-spend writes during high-concurrency race conditions.',
          },
        ],
        evidence: [
          {
            quote:
              'MongoDB lacks multi-document cross-collection ACID guarantees at our scale, risking phantom double-spend writes during high-concurrency race conditions.',
            claimType: 'rejection_reason',
            commentExternalId: 'comment-101-2',
          },
        ],
        files: [
          {
            path: 'src/db/schema.sql',
            currentPath: 'src/db/schema.sql',
            linkKind: 'mentioned',
            basis: 'Primary schema definition file mentioned in datastore RFC',
          },
          {
            path: 'src/db/connection.ts',
            currentPath: 'src/db/connection.ts',
            linkKind: 'mentioned',
            basis: 'Database pool connection configuration',
          },
        ],
      },
    },
    {
      kind: 'github_issue',
      externalId: 'acme-inc/payment-service#142',
      url: 'https://github.com/acme-inc/payment-service/issues/142',
      title: '[Fictional Demo] RFC: Payment execution pipeline and gateway timeouts',
      state: 'closed',
      author: 'bob-backend',
      createdAt: '2026-04-02T11:00:00.000Z',
      closedAt: '2026-04-06T16:30:00.000Z',
      comments: [
        {
          externalId: 'comment-142-1',
          idx: 1,
          author: 'bob-backend',
          authorRole: 'member',
          createdAt: '2026-04-02T11:05:00.000Z',
          body: 'Evaluating synchronous vs asynchronous payment processing pipelines when invoking third-party gateways like Stripe and Adyen. Should we synchronously block the web worker thread during card authorization?',
          url: 'https://github.com/acme-inc/payment-service/issues/142#issuecomment-142-1',
        },
        {
          externalId: 'comment-142-2',
          idx: 2,
          author: 'carol-infra',
          authorRole: 'collaborator',
          createdAt: '2026-04-04T15:20:00.000Z',
          body: 'Synchronous payment gateway calls cause thread exhaustion during upstream bank latency spikes, increasing checkout failure rates by 34%.',
          url: 'https://github.com/acme-inc/payment-service/issues/142#issuecomment-142-2',
        },
        {
          externalId: 'comment-142-3',
          idx: 3,
          author: 'alice-lead',
          authorRole: 'owner',
          createdAt: '2026-04-06T16:00:00.000Z',
          body: 'We decide on an asynchronous queue-backed pipeline with event webhooks. Requests are acknowledged immediately with a pending state while background workers handle gateway handshakes.',
          url: 'https://github.com/acme-inc/payment-service/issues/142#issuecomment-142-3',
        },
      ],
      decision: {
        title: 'Asynchronous Queue-Backed Payment Processing',
        status: 'accepted',
        lifecycle: 'active',
        summary:
          'Decoupled payment gateway execution into asynchronous job queues with webhook confirmation to prevent worker thread starvation during banking outages.',
        confidence: 0.96,
        confidenceParts: {
          coverage: 1.0,
          statement: 1.0,
          reasonCoverage: 0.95,
        },
        createdAt: '2026-04-06T16:30:00.000Z',
        alternatives: [
          {
            name: 'Asynchronous queue-backed payment processing with event webhooks',
            description:
              'Enqueue charge requests to background workers and notify clients via webhooks.',
            outcome: 'chosen',
            reason:
              'Decouples inbound checkout requests from unpredictable third-party bank latencies.',
            reasonCategory: 'performance',
          },
          {
            name: 'Synchronous HTTP gateway processing',
            description:
              'Direct synchronous HTTP call to payment processor while holding open customer connection.',
            outcome: 'rejected',
            reason:
              'Synchronous payment gateway calls cause thread exhaustion during upstream bank latency spikes, increasing checkout failure rates by 34%.',
            reasonCategory: 'performance',
            evidenceQuote:
              'Synchronous payment gateway calls cause thread exhaustion during upstream bank latency spikes, increasing checkout failure rates by 34%.',
          },
        ],
        evidence: [
          {
            quote:
              'Synchronous payment gateway calls cause thread exhaustion during upstream bank latency spikes, increasing checkout failure rates by 34%.',
            claimType: 'rejection_reason',
            commentExternalId: 'comment-142-2',
          },
        ],
        files: [
          {
            path: 'src/services/payment.ts',
            currentPath: 'src/services/payment.ts',
            linkKind: 'mentioned',
            basis: 'Core payment processing orchestration service',
          },
          {
            path: 'src/gateways/stripe.ts',
            currentPath: 'src/gateways/stripe.ts',
            linkKind: 'mentioned',
            basis: 'Third-party payment gateway client wrapper',
          },
        ],
        conditions: [
          {
            type: 'runtime',
            statement: 'Requires Redis connection for background message queue',
            probe: 'dependency_present',
            probeValue: 'ioredis',
          },
        ],
      },
    },
    {
      kind: 'github_pr',
      externalId: 'acme-inc/payment-service#189',
      url: 'https://github.com/acme-inc/payment-service/pull/189',
      title: '[Fictional Demo] Security: Zero raw card data storage via Vault tokenization',
      state: 'closed',
      author: 'dave-sec',
      createdAt: '2026-05-14T08:15:00.000Z',
      closedAt: '2026-05-18T10:00:00.000Z',
      comments: [
        {
          externalId: 'comment-189-1',
          idx: 1,
          author: 'dave-sec',
          authorRole: 'member',
          createdAt: '2026-05-14T08:20:00.000Z',
          body: 'Storing raw card numbers locally dramatically expands PCI-DSS audit scope to Level 1 compliance and introduces catastrophic breach liability.',
          url: 'https://github.com/acme-inc/payment-service/pull/189#issuecomment-189-1',
        },
        {
          externalId: 'comment-189-2',
          idx: 2,
          author: 'alice-lead',
          authorRole: 'owner',
          createdAt: '2026-05-18T09:45:00.000Z',
          body: 'Completely agree. This PR refactors our models so that raw PANs and CVVs never touch our application memory or disk. All card data is tokenized directly via the payment vault.',
          url: 'https://github.com/acme-inc/payment-service/pull/189#issuecomment-189-2',
        },
      ],
      decision: {
        title: 'Zero Raw Card Data Storage (Tokenization via Vault)',
        status: 'accepted',
        lifecycle: 'active',
        summary:
          'Prohibited storing raw credit card PANs or CVVs in application databases, delegating tokenization directly to a PCI-certified vault.',
        confidence: 0.98,
        confidenceParts: {
          coverage: 1.0,
          statement: 1.0,
          reasonCoverage: 1.0,
        },
        createdAt: '2026-05-18T10:00:00.000Z',
        alternatives: [
          {
            name: 'Delegated tokenization via Payment Vault API',
            description:
              'Tokenize card details on the client side using verified PCI-DSS compliant vault tokens.',
            outcome: 'chosen',
            reason:
              'Eliminates raw card handling and shrinks PCI compliance scope to SAQ-A assessment.',
            reasonCategory: 'security',
          },
          {
            name: 'Storing encrypted Primary Account Numbers (PAN) in local database',
            description: 'Encrypt card numbers with AES-256 in local PostgreSQL database.',
            outcome: 'rejected',
            reason:
              'Storing raw card numbers locally dramatically expands PCI-DSS audit scope to Level 1 compliance and introduces catastrophic breach liability.',
            reasonCategory: 'security',
            evidenceQuote:
              'Storing raw card numbers locally dramatically expands PCI-DSS audit scope to Level 1 compliance and introduces catastrophic breach liability.',
          },
        ],
        evidence: [
          {
            quote:
              'Storing raw card numbers locally dramatically expands PCI-DSS audit scope to Level 1 compliance and introduces catastrophic breach liability.',
            claimType: 'rejection_reason',
            commentExternalId: 'comment-189-1',
          },
        ],
        files: [
          {
            path: 'src/models/card.ts',
            currentPath: 'src/models/card.ts',
            linkKind: 'pr_diff',
            basis: 'Modified card entity model removing PAN columns',
          },
          {
            path: 'src/services/vault.ts',
            currentPath: 'src/services/vault.ts',
            linkKind: 'pr_diff',
            basis: 'Introduced vault tokenization client wrapper',
          },
        ],
      },
    },
    {
      kind: 'github_issue',
      externalId: 'acme-inc/payment-service#215',
      url: 'https://github.com/acme-inc/payment-service/issues/215',
      title: '[Fictional Demo] Reliability: Handling duplicate webhook events and requests',
      state: 'closed',
      author: 'bob-backend',
      createdAt: '2026-06-20T13:45:00.000Z',
      closedAt: '2026-06-22T17:00:00.000Z',
      comments: [
        {
          externalId: 'comment-215-1',
          idx: 1,
          author: 'bob-backend',
          authorRole: 'member',
          createdAt: '2026-06-20T13:50:00.000Z',
          body: 'Network retries without server-enforced idempotency keys generated duplicate customer charges during the last upstream gateway timeout.',
          url: 'https://github.com/acme-inc/payment-service/issues/215#issuecomment-215-1',
        },
        {
          externalId: 'comment-215-2',
          idx: 2,
          author: 'alice-lead',
          authorRole: 'owner',
          createdAt: '2026-06-22T16:30:00.000Z',
          body: 'We are making the Idempotency-Key header mandatory on all POST /charges mutations, verified against a 24-hour Redis key lock.',
          url: 'https://github.com/acme-inc/payment-service/issues/215#issuecomment-215-2',
        },
      ],
      decision: {
        title: 'Mandatory Idempotency-Key Header on Charge Mutations',
        status: 'accepted',
        lifecycle: 'active',
        summary:
          'Enforced mandatory Idempotency-Key HTTP headers with a 24-hour Redis TTL to prevent duplicate customer charges on network reconnects.',
        confidence: 0.95,
        confidenceParts: {
          coverage: 1.0,
          statement: 1.0,
          reasonCoverage: 0.9,
        },
        createdAt: '2026-06-22T17:00:00.000Z',
        alternatives: [
          {
            name: 'Redis-backed idempotency lock with 24h TTL',
            description:
              'Atomic check-and-set using Redis key cache for all inbound payment mutation requests.',
            outcome: 'chosen',
            reason: 'Guarantees strictly once execution for all payment requests.',
            reasonCategory: 'security',
          },
          {
            name: 'Client-side de-duplication',
            description: 'Disable checkout button in browser after first click.',
            outcome: 'rejected',
            reason:
              'Client-side deduplication fails on app reload or network reconnect, causing customer double-charging.',
            reasonCategory: 'security',
          },
        ],
        evidence: [
          {
            quote:
              'Network retries without server-enforced idempotency keys generated duplicate customer charges during the last upstream gateway timeout.',
            claimType: 'rejection_reason',
            commentExternalId: 'comment-215-1',
          },
        ],
        files: [
          {
            path: 'src/middleware/idempotency.ts',
            currentPath: 'src/middleware/idempotency.ts',
            linkKind: 'mentioned',
            basis: 'Express middleware enforcing idempotency header validations',
          },
        ],
      },
    },
    {
      kind: 'github_issue',
      externalId: 'acme-inc/payment-service#260',
      url: 'https://github.com/acme-inc/payment-service/issues/260',
      title: '[Fictional Demo] Resilience: Gateway failure backoff and jitter strategy',
      state: 'closed',
      author: 'carol-infra',
      createdAt: '2026-07-08T10:30:00.000Z',
      closedAt: '2026-07-11T12:00:00.000Z',
      comments: [
        {
          externalId: 'comment-260-1',
          idx: 1,
          author: 'carol-infra',
          authorRole: 'collaborator',
          createdAt: '2026-07-08T10:35:00.000Z',
          body: 'Immediate fixed-interval retries create a thundering herd that overwhelms the payment gateway during upstream recovery periods.',
          url: 'https://github.com/acme-inc/payment-service/issues/260#issuecomment-260-1',
        },
        {
          externalId: 'comment-260-2',
          idx: 2,
          author: 'bob-backend',
          authorRole: 'member',
          createdAt: '2026-07-11T11:45:00.000Z',
          body: 'Switching all gateway call retries to exponential backoff with full jitter and a circuit breaker that trips after 5 consecutive failures.',
          url: 'https://github.com/acme-inc/payment-service/issues/260#issuecomment-260-2',
        },
      ],
      decision: {
        title: 'Exponential Backoff with Full Jitter and Circuit Breaker',
        status: 'accepted',
        lifecycle: 'active',
        summary:
          'Replaced naive retry loops with decorrelated exponential backoff and circuit breaking to prevent self-inflicted DDoS on payment partners.',
        confidence: 0.94,
        confidenceParts: {
          coverage: 1.0,
          statement: 1.0,
          reasonCoverage: 0.9,
        },
        createdAt: '2026-07-11T12:00:00.000Z',
        alternatives: [
          {
            name: 'Exponential backoff with full jitter and circuit breaker',
            description:
              'Decorrelated randomized backoff interval with circuit tripping after 5 errors.',
            outcome: 'chosen',
            reason:
              'Smooths traffic spikes and allows recovering partner payment gateways to breathe.',
            reasonCategory: 'performance',
          },
          {
            name: 'Immediate fixed-interval 3x retry loop',
            description: 'Retry gateway calls 3 times with a static 500ms delay.',
            outcome: 'rejected',
            reason:
              'Immediate fixed-interval retries create a thundering herd that overwhelms the payment gateway during upstream recovery periods.',
            reasonCategory: 'maintenance',
            evidenceQuote:
              'Immediate fixed-interval retries create a thundering herd that overwhelms the payment gateway during upstream recovery periods.',
          },
        ],
        evidence: [
          {
            quote:
              'Immediate fixed-interval retries create a thundering herd that overwhelms the payment gateway during upstream recovery periods.',
            claimType: 'rejection_reason',
            commentExternalId: 'comment-260-1',
          },
        ],
        files: [
          {
            path: 'src/services/retry.ts',
            currentPath: 'src/services/retry.ts',
            linkKind: 'mentioned',
            basis: 'Jittered exponential backoff and circuit breaker implementation',
          },
        ],
      },
    },
  ],
};
