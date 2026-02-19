import type { Command } from 'commander';
import { requireProjectId } from '../config.ts';
import { PostHogClient } from '../client.ts';
import { printTable } from '../output.ts';
import { HogmanError } from '../types.ts';

type PropType = 'event' | 'person' | 'group';

export function registerPropertyCommands(program: Command): void {
  const properties = program
    .command('properties')
    .description('Browse PostHog property definitions (read-only)');

  properties
    .command('list')
    .description('List property definitions')
    .option(
      '--type <type>',
      'Filter by type: event | person | group'
    )
    .action(async (opts: { type?: string }) => {
      const globalOpts = program.opts();
      const { apiKey, host, projectId } = requireProjectId({
        account: globalOpts.account as string | undefined,
        project: globalOpts.project as string | undefined,
      });

      const validTypes = ['event', 'person', 'group'];
      if (opts.type && !validTypes.includes(opts.type)) {
        throw new HogmanError(
          'API_ERROR',
          `Invalid type "${opts.type}". Use: ${validTypes.join(' | ')}`
        );
      }

      const client = new PostHogClient(apiKey, host);
      const props = await client.listPropertyDefinitions(
        projectId,
        opts.type as PropType | undefined
      );

      const rows = props.map(p => ({
        name: p.name,
        property_type: p.property_type ?? '',
        is_numerical: p.is_numerical ? 'yes' : 'no',
      }));
      printTable(rows, ['name', 'property_type', 'is_numerical']);
    });
}
