import type { Command } from 'commander';
import { loadConfig, saveConfig } from '../config.ts';
import { print, printTable } from '../output.ts';
import { HogmanError } from '../types.ts';

export function registerAccountCommands(program: Command): void {
  const accounts = program
    .command('accounts')
    .description('Manage PostHog account profiles');

  accounts
    .command('list')
    .description('List configured accounts')
    .action(() => {
      const config = loadConfig();
      const rows = Object.entries(config.accounts).map(([name, acc]) => ({
        name,
        host: acc.host ?? 'https://app.posthog.com',
        default_project: acc.defaultProject ?? '',
        default: name === config.defaultAccount ? '✓' : '',
      }));
      printTable(rows, ['name', 'host', 'default_project', 'default']);
    });

  accounts
    .command('add <name>')
    .description('Add or update an account profile')
    .requiredOption('--api-key <key>', 'PostHog personal API key (phx_...)')
    .option('--host <url>', 'PostHog host URL', 'https://app.posthog.com')
    .action((name: string, opts: { apiKey: string; host: string }) => {
      const config = loadConfig();
      config.accounts[name] = {
        apiKey: opts.apiKey,
        host: opts.host,
        ...(config.accounts[name]?.defaultProject !== undefined
          ? { defaultProject: config.accounts[name].defaultProject }
          : {}),
      };
      if (!config.defaultAccount) {
        config.defaultAccount = name;
      }
      saveConfig(config);
      print(`Account "${name}" saved${!config.defaultAccount || config.defaultAccount === name ? ' (set as default)' : ''}.`);
    });

  accounts
    .command('remove <name>')
    .description('Remove an account profile')
    .action((name: string) => {
      const config = loadConfig();
      if (!config.accounts[name]) {
        throw new HogmanError('CONFIG_ERROR', `Account not found: "${name}"`);
      }
      delete config.accounts[name];
      if (config.defaultAccount === name) {
        const remaining = Object.keys(config.accounts);
        config.defaultAccount = remaining[0];
      }
      saveConfig(config);
      print(`Account "${name}" removed.`);
    });

  accounts
    .command('default <name>')
    .description('Set the default account')
    .action((name: string) => {
      const config = loadConfig();
      if (!config.accounts[name]) {
        throw new HogmanError('CONFIG_ERROR', `Account not found: "${name}"`);
      }
      config.defaultAccount = name;
      saveConfig(config);
      print(`Default account set to "${name}".`);
    });
}
