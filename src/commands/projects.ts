import type { Command } from 'commander';
import { resolveAccount, loadConfig, saveConfig } from '../config.ts';
import { PostHogClient } from '../client.ts';
import { print, printTable } from '../output.ts';
import { HogmanError } from '../types.ts';

export function registerProjectCommands(program: Command): void {
  const projects = program
    .command('projects')
    .description('Manage PostHog projects');

  projects
    .command('list')
    .description('List all accessible projects')
    .action(async () => {
      const globalOpts = program.opts();
      const resolved = resolveAccount({
        account: globalOpts.account as string | undefined,
        project: globalOpts.project as string | undefined,
      });
      const client = new PostHogClient(resolved.apiKey, resolved.host);
      const projects = await client.listProjects();

      const rows = projects.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        timezone: p.timezone,
      }));
      printTable(rows, ['id', 'name', 'slug', 'timezone']);
    });

  projects
    .command('use <id>')
    .description('Set the default project for the current account')
    .action((id: string) => {
      const globalOpts = program.opts();
      const config = loadConfig();

      // Determine which account to update
      const accountName =
        (globalOpts.account as string | undefined) ?? config.defaultAccount;

      if (!accountName) {
        throw new HogmanError(
          'NO_ACCOUNT',
          'No account configured. Run: hogman accounts add <name> --api-key <key>'
        );
      }
      if (!config.accounts[accountName]) {
        throw new HogmanError('NO_ACCOUNT', `Account not found: "${accountName}"`);
      }

      config.accounts[accountName].defaultProject = parseInt(id, 10);
      saveConfig(config);
      print(`Default project for "${accountName}" set to ${id}.`);
    });
}
