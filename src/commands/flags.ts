import type { Command } from 'commander';
import { requireProjectId } from '../config.ts';
import { PostHogClient } from '../client.ts';
import { print, printTable } from '../output.ts';

export function registerFlagCommands(program: Command): void {
  const flags = program
    .command('flags')
    .description('Manage PostHog feature flags (read-only)');

  flags
    .command('list')
    .description('List all feature flags')
    .action(async () => {
      const globalOpts = program.opts();
      const { apiKey, host, projectId } = requireProjectId({
        account: globalOpts.account as string | undefined,
        project: globalOpts.project as string | undefined,
      });
      const client = new PostHogClient(apiKey, host);
      const flagList = await client.listFeatureFlags(projectId);

      const rows = flagList.map(f => ({
        id: f.id,
        key: f.key,
        name: f.name ?? '',
        active: f.active ? 'yes' : 'no',
        rollout: f.rollout_percentage != null ? `${f.rollout_percentage}%` : 'custom',
      }));
      printTable(rows, ['id', 'key', 'name', 'active', 'rollout']);
    });

  flags
    .command('get <key-or-id>')
    .description('Get a feature flag by key or numeric ID')
    .action(async (keyOrId: string) => {
      const globalOpts = program.opts();
      const { apiKey, host, projectId } = requireProjectId({
        account: globalOpts.account as string | undefined,
        project: globalOpts.project as string | undefined,
      });
      const client = new PostHogClient(apiKey, host);

      const flag = /^\d+$/.test(keyOrId)
        ? await client.getFeatureFlagById(projectId, parseInt(keyOrId, 10))
        : await client.getFeatureFlagByKey(projectId, keyOrId);

      print(flag);
    });
}
