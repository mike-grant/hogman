import type { Command } from 'commander';
import { requireProjectId } from '../config.ts';
import { PostHogClient } from '../client.ts';
import { print, printTable } from '../output.ts';

export function registerInsightCommands(program: Command): void {
  const insights = program
    .command('insights')
    .description('Browse PostHog insights (read-only)');

  insights
    .command('list')
    .description('List saved insights')
    .option('--favorited', 'Show only favorited insights')
    .action(async (opts: { favorited?: boolean }) => {
      const globalOpts = program.opts();
      const { apiKey, host, projectId } = requireProjectId({
        account: globalOpts.account as string | undefined,
        project: globalOpts.project as string | undefined,
      });
      const client = new PostHogClient(apiKey, host);
      const list = await client.listInsights(projectId, opts.favorited);

      const rows = list.map(i => ({
        id: i.id,
        short_id: i.short_id,
        name: i.name ?? '(untitled)',
        favorited: i.favorited ? '★' : '',
        last_refresh: i.last_refresh?.split('T')[0] ?? 'never',
      }));
      printTable(rows, ['id', 'short_id', 'name', 'favorited', 'last_refresh']);
    });

  insights
    .command('get <id>')
    .description('Get a specific insight by numeric ID')
    .action(async (id: string) => {
      const globalOpts = program.opts();
      const { apiKey, host, projectId } = requireProjectId({
        account: globalOpts.account as string | undefined,
        project: globalOpts.project as string | undefined,
      });
      const client = new PostHogClient(apiKey, host);
      const insight = await client.getInsight(projectId, parseInt(id, 10));
      print(insight);
    });
}
