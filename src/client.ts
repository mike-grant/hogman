import type {
  Organization,
  Project,
  FeatureFlag,
  Insight,
  Dashboard,
  HogQLQueryResult,
  ErrorGroup,
  Person,
  PropertyDefinition,
  PaginatedResponse,
} from './types.ts';
import { HogmanError } from './types.ts';

export class PostHogClient {
  constructor(
    private apiKey: string,
    private host: string
  ) {}

  // ─── Core request helpers ──────────────────────────────────────────────────

  private async requestRaw<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (res.status === 401) {
      throw new HogmanError('UNAUTHORIZED', 'Invalid API key — use a personal API key (phx_...)', 401);
    }
    if (res.status === 403) {
      throw new HogmanError('FORBIDDEN', 'Access denied to this resource', 403);
    }
    if (res.status === 404) {
      throw new HogmanError('NOT_FOUND', `Resource not found: ${url}`, 404);
    }
    if (res.status === 429) {
      throw new HogmanError('RATE_LIMITED', 'Rate limit exceeded (HogQL: 120/hr) — try again later', 429);
    }
    if (res.status >= 500) {
      throw new HogmanError('SERVER_ERROR', `PostHog server error: ${res.status}`, res.status);
    }
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json() as Record<string, unknown>;
        detail = String(body.detail ?? body.error ?? body.message ?? res.statusText);
      } catch { /* ignore parse errors */ }
      throw new HogmanError('API_ERROR', detail, res.status);
    }

    return res.json() as Promise<T>;
  }

  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean>
  ): string {
    let url = `${this.host}${path}`;
    if (params && Object.keys(params).length > 0) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        qs.set(k, String(v));
      }
      url += `?${qs.toString()}`;
    }
    return url;
  }

  private async paginate<T>(
    path: string,
    params?: Record<string, string | number | boolean>
  ): Promise<T[]> {
    const results: T[] = [];
    let url: string | null = this.buildUrl(path, params);

    while (url) {
      const page: PaginatedResponse<T> = await this.requestRaw<PaginatedResponse<T>>(url);
      results.push(...page.results);
      url = page.next ?? null;
    }

    return results;
  }

  private async requestSingle<T>(
    path: string,
    params?: Record<string, string | number | boolean>
  ): Promise<T> {
    return this.requestRaw<T>(this.buildUrl(path, params));
  }

  // ─── Organizations ─────────────────────────────────────────────────────────

  async listOrganizations(): Promise<Organization[]> {
    return this.paginate<Organization>('/api/organizations/');
  }

  // ─── Projects ──────────────────────────────────────────────────────────────

  async listProjects(): Promise<Project[]> {
    return this.paginate<Project>('/api/projects/');
  }

  // ─── Feature Flags ─────────────────────────────────────────────────────────

  async listFeatureFlags(projectId: number): Promise<FeatureFlag[]> {
    return this.paginate<FeatureFlag>(`/api/projects/${projectId}/feature_flags/`);
  }

  async getFeatureFlagById(projectId: number, id: number): Promise<FeatureFlag> {
    return this.requestSingle<FeatureFlag>(`/api/projects/${projectId}/feature_flags/${id}/`);
  }

  async getFeatureFlagByKey(projectId: number, key: string): Promise<FeatureFlag> {
    const flags = await this.listFeatureFlags(projectId);
    const flag = flags.find(f => f.key === key);
    if (!flag) {
      throw new HogmanError('NOT_FOUND', `Feature flag not found with key: "${key}"`);
    }
    return flag;
  }

  // ─── Insights ──────────────────────────────────────────────────────────────

  async listInsights(projectId: number, favorited?: boolean): Promise<Insight[]> {
    const params: Record<string, string | number | boolean> = { saved: true };
    if (favorited) params.favorited = true;
    return this.paginate<Insight>(`/api/projects/${projectId}/insights/`, params);
  }

  async getInsight(projectId: number, id: number): Promise<Insight> {
    return this.requestSingle<Insight>(`/api/projects/${projectId}/insights/${id}/`);
  }

  // ─── Dashboards ────────────────────────────────────────────────────────────

  async listDashboards(projectId: number): Promise<Dashboard[]> {
    return this.paginate<Dashboard>(`/api/projects/${projectId}/dashboards/`);
  }

  async getDashboard(projectId: number, id: number): Promise<Dashboard> {
    return this.requestSingle<Dashboard>(`/api/projects/${projectId}/dashboards/${id}/`);
  }

  // ─── HogQL Query ───────────────────────────────────────────────────────────

  async query(projectId: number, sql: string, refresh?: boolean): Promise<HogQLQueryResult> {
    const body: Record<string, unknown> = {
      query: { kind: 'HogQLQuery', query: sql },
    };
    if (refresh) body.refresh = true;

    return this.requestRaw<HogQLQueryResult>(
      this.buildUrl(`/api/projects/${projectId}/query/`),
      { method: 'POST', body: JSON.stringify(body) }
    );
  }

  // ─── Error Tracking ────────────────────────────────────────────────────────

  async listErrorGroups(
    projectId: number,
    status?: 'active' | 'resolved' | 'suppressed'
  ): Promise<ErrorGroup[]> {
    const params: Record<string, string | number | boolean> = {};
    if (status) params.status = status;
    return this.paginate<ErrorGroup>(`/api/projects/${projectId}/error_tracking/groups/`, params);
  }

  async getErrorGroup(projectId: number, id: string): Promise<ErrorGroup> {
    return this.requestSingle<ErrorGroup>(
      `/api/projects/${projectId}/error_tracking/groups/${id}/`
    );
  }

  // ─── Persons ───────────────────────────────────────────────────────────────

  async listPersons(
    projectId: number,
    search?: string,
    limit?: number
  ): Promise<Person[]> {
    const params: Record<string, string | number | boolean> = {};
    if (search) params.search = search;

    if (limit) {
      // Single page request when limit is specified
      params.limit = limit;
      const page = await this.requestRaw<PaginatedResponse<Person>>(
        this.buildUrl(`/api/projects/${projectId}/persons/`, params)
      );
      return page.results;
    }

    return this.paginate<Person>(`/api/projects/${projectId}/persons/`, params);
  }

  async getPersonByDistinctId(projectId: number, distinctId: string): Promise<Person | null> {
    const page = await this.requestRaw<PaginatedResponse<Person>>(
      this.buildUrl(`/api/projects/${projectId}/persons/`, { distinct_id: distinctId })
    );
    return page.results[0] ?? null;
  }

  // ─── Property Definitions ──────────────────────────────────────────────────

  async listPropertyDefinitions(
    projectId: number,
    type?: 'event' | 'person' | 'group'
  ): Promise<PropertyDefinition[]> {
    // PostHog type values: 1=event, 2=person, 3=group
    const typeMap: Record<string, number> = { event: 1, person: 2, group: 3 };
    const params: Record<string, string | number | boolean> = {};
    if (type) params.type = typeMap[type];
    return this.paginate<PropertyDefinition>(
      `/api/projects/${projectId}/property_definitions/`,
      params
    );
  }

  // ─── LLM Costs ─────────────────────────────────────────────────────────────

  async getLLMCosts(projectId: number, from?: string, to?: string): Promise<HogQLQueryResult> {
    const fromDate =
      from ??
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const toDate = to ?? new Date().toISOString().split('T')[0];

    const sql = [
      'SELECT',
      "  properties.$ai_model AS model,",
      "  round(sum(toFloatOrDefault(toString(properties.$ai_input_tokens), 0))) AS input_tokens,",
      "  round(sum(toFloatOrDefault(toString(properties.$ai_output_tokens), 0))) AS output_tokens,",
      "  round(sum(toFloatOrDefault(toString(properties.$ai_total_cost_usd), 0)), 4) AS total_cost_usd,",
      '  count() AS events',
      'FROM events',
      "WHERE event = '$ai_generation'",
      `  AND timestamp >= '${fromDate}'`,
      `  AND timestamp <= '${toDate}'`,
      'GROUP BY model',
      'ORDER BY total_cost_usd DESC',
    ].join('\n');

    return this.query(projectId, sql);
  }
}
