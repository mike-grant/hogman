import { readFileSync } from 'fs';
import type { Command } from 'commander';
import { requireProjectId } from '../config.ts';
import { PostHogClient } from '../client.ts';
import { print, printTable, isJsonMode } from '../output.ts';
import { HogmanError } from '../types.ts';

export function registerQueryCommands(program: Command): void {
  program
    .command('query [sql]')
    .description('Execute a HogQL query against PostHog')
    .option('--file <path>', 'Read query from a .sql file instead of argument')
    .option('--refresh', 'Force refresh cached results')
    .action(async (sql: string | undefined, opts: { file?: string; refresh?: boolean }) => {
      const globalOpts = program.opts();
      const { apiKey, host, projectId } = requireProjectId({
        account: globalOpts.account as string | undefined,
        project: globalOpts.project as string | undefined,
      });

      let query = sql;

      if (opts.file) {
        try {
          query = readFileSync(opts.file, 'utf-8').trim();
        } catch (err) {
          throw new HogmanError(
            'CONFIG_ERROR',
            `Could not read file: ${opts.file} — ${(err as Error).message}`
          );
        }
      }

      if (!query) {
        throw new HogmanError(
          'CONFIG_ERROR',
          'Provide a query string or use --file <path.sql>'
        );
      }

      const client = new PostHogClient(apiKey, host);
      const result = await client.query(projectId, query, opts.refresh);

      if (isJsonMode()) {
        print({ columns: result.columns, results: result.results, types: result.types });
        return;
      }

      // Human-readable: render as table using column names
      if (!result.results || result.results.length === 0) {
        console.log('(no results)');
        return;
      }

      const columns = result.columns ?? [];
      const rows = result.results.map(row =>
        Object.fromEntries(columns.map((col, i) => [col, row[i]]))
      );
      printTable(rows as Record<string, unknown>[], columns);
    });
}
