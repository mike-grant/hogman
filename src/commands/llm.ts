import type { Command } from 'commander';
import { requireProjectId } from '../config.ts';
import { PostHogClient } from '../client.ts';
import { print, printTable, isJsonMode } from '../output.ts';

export function registerLLMCommands(program: Command): void {
  const llm = program
    .command('llm')
    .description('LLM observability data from PostHog');

  llm
    .command('costs')
    .description('Show LLM usage costs (default: last 30 days)')
    .option('--from <YYYY-MM-DD>', 'Start date (inclusive)')
    .option('--to <YYYY-MM-DD>', 'End date (inclusive)')
    .action(async (opts: { from?: string; to?: string }) => {
      const globalOpts = program.opts();
      const { apiKey, host, projectId } = requireProjectId({
        account: globalOpts.account as string | undefined,
        project: globalOpts.project as string | undefined,
      });

      const client = new PostHogClient(apiKey, host);
      const result = await client.getLLMCosts(projectId, opts.from, opts.to);

      if (isJsonMode()) {
        print({ columns: result.columns, results: result.results, types: result.types });
        return;
      }

      if (!result.results || result.results.length === 0) {
        console.log('No LLM cost data found for the specified period.');
        return;
      }

      const columns = result.columns ?? ['model', 'input_tokens', 'output_tokens', 'total_cost_usd', 'events'];
      const rows = result.results.map(row =>
        Object.fromEntries(columns.map((col, i) => [col, row[i]]))
      );
      printTable(rows as Record<string, unknown>[], columns);
    });
}
