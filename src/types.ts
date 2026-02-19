// ─── Config types ─────────────────────────────────────────────────────────────

export interface AccountConfig {
  apiKey: string;
  host: string;
  defaultProject?: number;
}

export interface HogmanConfig {
  defaultAccount?: string;
  accounts: Record<string, AccountConfig>;
}

export interface ResolvedAccount {
  apiKey: string;
  host: string;
  projectId?: number;
}

// ─── PostHog API types ─────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  membership_level: number;
}

export interface Project {
  id: number;
  name: string;
  slug: string;
  timezone: string;
  created_at: string;
  organization: string;
}

export interface FeatureFlag {
  id: number;
  key: string;
  name: string;
  active: boolean;
  rollout_percentage: number | null;
  created_at: string;
  is_simple_flag: boolean;
  filters: Record<string, unknown>;
}

export interface Insight {
  id: number;
  short_id: string;
  name: string;
  favorited: boolean;
  last_refresh: string | null;
  created_at: string;
  description: string;
}

export interface Dashboard {
  id: number;
  name: string;
  pinned: boolean;
  tiles: unknown[];
  created_at: string;
  description: string;
}

export interface HogQLQueryResult {
  results: unknown[][];
  columns: string[];
  types: string[];
  timings?: Record<string, number>;
}

export interface ErrorGroup {
  id: string;
  title: string;
  description?: string;
  status: 'active' | 'resolved' | 'suppressed';
  occurrences?: number;
  first_seen?: string;
  last_seen?: string;
}

export interface Person {
  id: string;
  name: string;
  distinct_ids: string[];
  created_at: string;
  properties: Record<string, unknown>;
}

export interface PropertyDefinition {
  id: string;
  name: string;
  is_numerical: boolean;
  type: number;
  property_type: string | null;
  created_at?: string;
}

// ─── Error types ───────────────────────────────────────────────────────────────

export type ErrorCode =
  | 'NO_ACCOUNT'
  | 'NO_PROJECT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'API_ERROR'
  | 'CONFIG_ERROR'
  | 'UNKNOWN_ERROR';

export class HogmanError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'HogmanError';
  }
}
