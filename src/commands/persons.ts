import type { Command } from 'commander';
import { requireProjectId } from '../config.ts';
import { PostHogClient } from '../client.ts';
import { print, printTable } from '../output.ts';
import { HogmanError } from '../types.ts';

export function registerPersonCommands(program: Command): void {
  const persons = program
    .command('persons')
    .description('Browse PostHog persons (read-only)');

  persons
    .command('list')
    .description('List persons')
    .option('--search <query>', 'Search by name, email, or distinct ID')
    .option('--limit <n>', 'Maximum number of results to return', '100')
    .action(async (opts: { search?: string; limit?: string }) => {
      const globalOpts = program.opts();
      const { apiKey, host, projectId } = requireProjectId({
        account: globalOpts.account as string | undefined,
        project: globalOpts.project as string | undefined,
      });
      const client = new PostHogClient(apiKey, host);
      const limit = opts.limit ? parseInt(opts.limit, 10) : 100;
      const persons = await client.listPersons(projectId, opts.search, limit);

      const rows = persons.map(p => ({
        id: p.id,
        name: p.name ?? '',
        distinct_id: p.distinct_ids?.[0] ?? '',
        created_at: p.created_at?.split('T')[0] ?? '',
      }));
      printTable(rows, ['id', 'name', 'distinct_id', 'created_at']);
    });

  persons
    .command('get <distinct-id>')
    .description('Get a person by their distinct ID')
    .action(async (distinctId: string) => {
      const globalOpts = program.opts();
      const { apiKey, host, projectId } = requireProjectId({
        account: globalOpts.account as string | undefined,
        project: globalOpts.project as string | undefined,
      });
      const client = new PostHogClient(apiKey, host);
      const person = await client.getPersonByDistinctId(projectId, distinctId);

      if (!person) {
        throw new HogmanError('NOT_FOUND', `No person found with distinct ID: "${distinctId}"`);
      }

      print(person);
    });
}
