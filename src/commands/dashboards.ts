import type { Command } from 'commander';
import { requireProjectId } from '../config.ts';
import { PostHogClient } from '../client.ts';
import { print, printTable } from '../output.ts';

export function registerDashboardCommands(program: Command): void {
  const dashboards = program
    .command('dashboards')
    .description('Browse PostHog dashboards (read-only)');

  dashboards
    .command('list')
    .description('List all dashboards')
    .action(async () => {
      const globalOpts = program.opts();
      const { apiKey, host, projectId } = requireProjectId({
        account: globalOpts.account as string | undefined,
        project: globalOpts.project as string | undefined,
      });
      const client = new PostHogClient(apiKey, host);
      const list = await client.listDashboards(projectId);

      const rows = list.map(d => ({
        id: d.id,
        name: d.name ?? '(untitled)',
        pinned: d.pinned ? '📌' : '',
        tiles: Array.isArray(d.tiles) ? d.tiles.length : 0,
        created_at: d.created_at?.split('T')[0] ?? '',
      }));
      printTable(rows, ['id', 'name', 'pinned', 'tiles', 'created_at']);
    });

  dashboards
    .command('get <id>')
    .description('Get a specific dashboard by numeric ID')
    .action(async (id: string) => {
      const globalOpts = program.opts();
      const { apiKey, host, projectId } = requireProjectId({
        account: globalOpts.account as string | undefined,
        project: globalOpts.project as string | undefined,
      });
      const client = new PostHogClient(apiKey, host);
      const dashboard = await client.getDashboard(projectId, parseInt(id, 10));
      print(dashboard);
    });
}
