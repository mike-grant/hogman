import type { Command } from 'commander';
import { resolveAccount } from '../config.ts';
import { PostHogClient } from '../client.ts';
import { printTable } from '../output.ts';

export function registerOrgCommands(program: Command): void {
  const orgs = program
    .command('orgs')
    .description('List PostHog organizations');

  orgs
    .command('list')
    .description('List all organizations')
    .action(async () => {
      const globalOpts = program.opts();
      const resolved = resolveAccount({
        account: globalOpts.account as string | undefined,
        project: globalOpts.project as string | undefined,
      });
      const client = new PostHogClient(resolved.apiKey, resolved.host);
      const orgs = await client.listOrganizations();

      const rows = orgs.map(o => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        created_at: o.created_at?.split('T')[0] ?? '',
      }));
      printTable(rows, ['id', 'name', 'slug', 'created_at']);
    });
}
