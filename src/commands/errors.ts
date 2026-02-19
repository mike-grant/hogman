import type { Command } from 'commander';
import { requireProjectId } from '../config.ts';
import { PostHogClient } from '../client.ts';
import { print, printTable } from '../output.ts';
import { HogmanError } from '../types.ts';

type ErrorStatus = 'active' | 'resolved' | 'suppressed';

export function registerErrorCommands(program: Command): void {
  const errors = program
    .command('errors')
    .description('Browse PostHog error tracking (read-only)');

  errors
    .command('list')
    .description('List error groups')
    .option(
      '--status <status>',
      'Filter by status: active | resolved | suppressed'
    )
    .action(async (opts: { status?: string }) => {
      const globalOpts = program.opts();
      const { apiKey, host, projectId } = requireProjectId({
        account: globalOpts.account as string | undefined,
        project: globalOpts.project as string | undefined,
      });

      const validStatuses = ['active', 'resolved', 'suppressed'];
      if (opts.status && !validStatuses.includes(opts.status)) {
        throw new HogmanError(
          'API_ERROR',
          `Invalid status "${opts.status}". Use: ${validStatuses.join(' | ')}`
        );
      }

      const client = new PostHogClient(apiKey, host);
      const groups = await client.listErrorGroups(
        projectId,
        opts.status as ErrorStatus | undefined
      );

      const rows = groups.map(g => ({
        id: g.id,
        title: g.title ?? '',
        status: g.status,
        occurrences: g.occurrences ?? '',
        last_seen: g.last_seen?.split('T')[0] ?? '',
      }));
      printTable(rows, ['id', 'title', 'status', 'occurrences', 'last_seen']);
    });

  errors
    .command('get <id>')
    .description('Get a specific error group by ID')
    .action(async (id: string) => {
      const globalOpts = program.opts();
      const { apiKey, host, projectId } = requireProjectId({
        account: globalOpts.account as string | undefined,
        project: globalOpts.project as string | undefined,
      });
      const client = new PostHogClient(apiKey, host);
      const group = await client.getErrorGroup(projectId, id);
      print(group);
    });
}
