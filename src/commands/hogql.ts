import type { Command } from 'commander';
import { print } from '../output.ts';
import { isJsonMode } from '../output.ts';

const REFERENCE = {
  tables: [
    { name: 'events', description: 'One row per tracked event. Main table for all analytics.' },
    { name: 'persons', description: 'One row per person (latest state). Use for person-level aggregations.' },
    { name: 'sessions', description: 'One row per session. Includes session duration, entry/exit pages.' },
  ],

  events_columns: [
    { column: 'event',            type: 'String',   note: "Event name e.g. '$pageview', 'user_signed_up'" },
    { column: 'distinct_id',      type: 'String',   note: 'User identifier (anonymous or identified)' },
    { column: 'timestamp',        type: 'DateTime', note: 'Event time — project timezone applied automatically' },
    { column: 'properties',       type: 'Object',   note: 'Event properties — access as properties.key or properties.$posthog_key' },
    { column: 'person.properties',type: 'Object',   note: 'Person props at event time — triggers join, use sparingly' },
    { column: 'uuid',             type: 'String',   note: 'Unique event ID' },
    { column: 'elements_chain',   type: 'String',   note: 'DOM elements for autocapture events' },
  ],

  property_access: [
    { example: "properties.$current_url",        note: 'Built-in PostHog URL property' },
    { example: "properties.$pathname",           note: 'URL path without domain' },
    { example: "properties.$browser",            note: 'Browser name' },
    { example: "properties.$os",                 note: 'Operating system' },
    { example: "properties.$device_type",        note: "Device type: 'Desktop', 'Mobile', 'Tablet'" },
    { example: "properties.$referrer",           note: 'Referrer URL' },
    { example: "properties.my_custom_prop",      note: 'Any custom event property you track' },
    { example: "person.properties.email",        note: 'Person property — triggers expensive join, use sparingly' },
    { example: "person.properties.plan",         note: 'Any person property' },
  ],

  aggregate_functions: {
    use: [
      { fn: 'count()',              sql_equiv: 'COUNT(*)',              note: 'Total row count' },
      { fn: 'uniq(col)',            sql_equiv: 'COUNT(DISTINCT col)',   note: 'Approximate distinct count — prefer this' },
      { fn: 'uniqExact(col)',       sql_equiv: 'COUNT(DISTINCT col)',   note: 'Exact distinct count — slower, more memory' },
      { fn: 'countIf(condition)',   sql_equiv: 'COUNT(*) FILTER WHERE', note: 'Conditional count' },
      { fn: 'sum(col)',             sql_equiv: 'SUM(col)',              note: '' },
      { fn: 'avg(col)',             sql_equiv: 'AVG(col)',              note: '' },
      { fn: 'min(col)',             sql_equiv: 'MIN(col)',              note: '' },
      { fn: 'max(col)',             sql_equiv: 'MAX(col)',              note: '' },
      { fn: 'argMax(val, ts)',      sql_equiv: 'LAST_VALUE(val)',       note: 'Get val at the latest timestamp — use for "current" state' },
      { fn: 'argMin(val, ts)',      sql_equiv: 'FIRST_VALUE(val)',      note: 'Get val at the earliest timestamp' },
    ],
    do_not_use: [
      { fn: 'countDistinct(col)',   use_instead: 'uniq(col)',                note: 'Not supported in HogQL' },
      { fn: 'COUNT(DISTINCT col)',  use_instead: 'uniq(col)',                note: 'Not supported in HogQL' },
    ],
  },

  type_conversion: {
    use: [
      { fn: 'toFloat(x)',                  note: 'Convert to float' },
      { fn: "toFloatOrDefault(x, 0)",      note: 'Convert to float or fallback — use for string→number from properties' },
      { fn: 'toInt64(x)',                  note: 'Convert to int' },
      { fn: "toInt64OrDefault(x, 0)",      note: 'Convert to int or fallback' },
      { fn: 'toString(x)',                 note: 'Convert to string' },
      { fn: 'toDate(x)',                   note: 'Convert to Date' },
      { fn: 'toDateTime(x)',               note: 'Convert to DateTime' },
    ],
    do_not_use: [
      { fn: 'toFloat64OrDefault()',  use_instead: 'toFloatOrDefault()',  note: 'Not supported' },
      { fn: 'toFloat32OrDefault()',  use_instead: 'toFloatOrDefault()',  note: 'Not supported' },
      { fn: 'toFloat64()',           use_instead: 'toFloat()',           note: 'Not supported' },
    ],
  },

  date_functions: [
    { fn: 'now()',                             note: 'Current datetime' },
    { fn: 'today()',                           note: 'Current date' },
    { fn: 'toDate(timestamp)',                 note: 'Extract date part from datetime' },
    { fn: 'toStartOfDay(timestamp)',           note: 'Truncate to start of day' },
    { fn: 'toStartOfWeek(timestamp)',          note: 'Truncate to start of week' },
    { fn: 'toStartOfMonth(timestamp)',         note: 'Truncate to start of month' },
    { fn: "dateDiff('day', a, b)",             note: 'Difference between two dates in given unit' },
    { fn: 'timestamp >= now() - interval 7 day', note: 'Last 7 days (also: 30 day, 1 hour, 3 month, etc.)' },
    { fn: "timestamp >= '2026-01-01'",         note: 'Absolute date filter (ISO string)' },
  ],

  limits_and_gotchas: [
    'PostHog adds LIMIT 100 automatically if you omit LIMIT — add explicit LIMIT to get more',
    'Max query execution time is 10 seconds — break complex queries into simpler ones',
    'HogQL rate limit: 120 queries/hour per project',
    'team_id is always filtered automatically — do not add it yourself',
    'Properties are stored as JSON — all values come back as strings unless cast',
    'person.properties triggers a JOIN — avoid in high-cardinality GROUP BY queries',
    'Timestamps are auto-converted to project timezone',
    'NULL properties: use ifNull(properties.key, default) to handle missing values',
    "Use equals(event, 'name') or event = 'name' — both work",
  ],

  common_patterns: [
    {
      name: 'Daily active users (last 30 days)',
      sql: `SELECT toDate(timestamp) AS day, uniq(distinct_id) AS dau
FROM events
WHERE timestamp >= now() - interval 30 day
GROUP BY day ORDER BY day`,
    },
    {
      name: 'Top events by volume',
      sql: `SELECT event, count() AS total, uniq(distinct_id) AS users
FROM events
WHERE timestamp >= now() - interval 7 day
GROUP BY event ORDER BY total DESC LIMIT 20`,
    },
    {
      name: 'Funnel: count users who did step A then step B',
      sql: `SELECT
  uniqIf(distinct_id, event = 'signup_page_viewed') AS step1_users,
  uniqIf(distinct_id, event = 'user_signed_up') AS step2_users
FROM events
WHERE timestamp >= now() - interval 30 day
  AND event IN ('signup_page_viewed', 'user_signed_up')`,
    },
    {
      name: 'Top pages (pageview URL)',
      sql: `SELECT properties.$pathname AS path, count() AS views
FROM events
WHERE event = '$pageview'
  AND timestamp >= now() - interval 7 day
GROUP BY path ORDER BY views DESC LIMIT 20`,
    },
    {
      name: 'Events with person email (use sparingly)',
      sql: `SELECT person.properties.email AS email, count() AS events
FROM events
WHERE event = 'user_signed_up'
  AND timestamp >= now() - interval 30 day
GROUP BY email ORDER BY events DESC`,
    },
    {
      name: 'Property value from string (cast numbers)',
      sql: `SELECT
  properties.$ai_model AS model,
  sum(toFloatOrDefault(toString(properties.$ai_total_cost_usd), 0)) AS total_cost
FROM events
WHERE event = '$ai_generation'
GROUP BY model ORDER BY total_cost DESC`,
    },
    {
      name: 'Week-over-week comparison',
      sql: `SELECT
  toStartOfWeek(timestamp) AS week,
  uniq(distinct_id) AS wau
FROM events
WHERE timestamp >= now() - interval 12 week
GROUP BY week ORDER BY week`,
    },
    {
      name: 'Error rate by page',
      sql: `SELECT
  properties.$current_url AS url,
  countIf(event = '$exception') AS errors,
  countIf(event = '$pageview') AS pageviews,
  round(errors / pageviews * 100, 2) AS error_rate_pct
FROM events
WHERE timestamp >= now() - interval 7 day
  AND event IN ('$pageview', '$exception')
GROUP BY url
HAVING pageviews > 5
ORDER BY error_rate_pct DESC`,
    },
  ],
};

export function registerHogQLCommands(program: Command): void {
  const hogql = program
    .command('hogql')
    .description('HogQL reference for writing queries (LLM-friendly)');

  hogql
    .command('help')
    .description('Full HogQL syntax reference and cheat sheet')
    .action(() => {
      if (isJsonMode()) {
        print(REFERENCE);
        return;
      }

      // Human-readable formatted output
      const lines: string[] = [];

      lines.push('╔═══════════════════════════════╗');
      lines.push('║      HogQL Quick Reference    ║');
      lines.push('╚═══════════════════════════════╝');

      lines.push('\n── TABLES ──');
      for (const t of REFERENCE.tables) {
        lines.push(`  ${t.name.padEnd(12)} ${t.description}`);
      }

      lines.push('\n── EVENTS TABLE COLUMNS ──');
      for (const c of REFERENCE.events_columns) {
        lines.push(`  ${c.column.padEnd(22)} ${c.type.padEnd(10)} ${c.note}`);
      }

      lines.push('\n── PROPERTY ACCESS ──');
      for (const p of REFERENCE.property_access) {
        lines.push(`  ${p.example.padEnd(36)} — ${p.note}`);
      }

      lines.push('\n── AGGREGATE FUNCTIONS ──');
      lines.push('  ✓ USE:');
      for (const f of REFERENCE.aggregate_functions.use) {
        const equiv = f.sql_equiv ? ` (SQL: ${f.sql_equiv})` : '';
        lines.push(`    ${f.fn.padEnd(26)}${equiv}`);
      }
      lines.push('  ✗ DO NOT USE:');
      for (const f of REFERENCE.aggregate_functions.do_not_use) {
        lines.push(`    ${f.fn.padEnd(26)} → use ${f.use_instead}`);
      }

      lines.push('\n── TYPE CONVERSION ──');
      lines.push('  ✓ USE:');
      for (const f of REFERENCE.type_conversion.use) {
        lines.push(`    ${f.fn.padEnd(30)} — ${f.note}`);
      }
      lines.push('  ✗ DO NOT USE:');
      for (const f of REFERENCE.type_conversion.do_not_use) {
        lines.push(`    ${f.fn.padEnd(30)} → use ${f.use_instead}`);
      }

      lines.push('\n── DATE FUNCTIONS ──');
      for (const f of REFERENCE.date_functions) {
        lines.push(`  ${f.fn.padEnd(42)} — ${f.note}`);
      }

      lines.push('\n── GOTCHAS ──');
      for (const g of REFERENCE.limits_and_gotchas) {
        lines.push(`  • ${g}`);
      }

      lines.push('\n── COMMON PATTERNS ──');
      for (const p of REFERENCE.common_patterns) {
        lines.push(`\n  ${p.name}:`);
        for (const line of p.sql.split('\n')) {
          lines.push(`    ${line}`);
        }
      }

      console.log(lines.join('\n'));
    });

  hogql
    .command('patterns')
    .description('Common HogQL query patterns only')
    .action(() => {
      if (isJsonMode()) {
        print(REFERENCE.common_patterns);
        return;
      }
      for (const p of REFERENCE.common_patterns) {
        console.log(`\n── ${p.name} ──`);
        console.log(p.sql);
      }
    });
}
