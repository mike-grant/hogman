#!/usr/bin/env bun
import { Command } from 'commander';
import { setJsonMode } from './output.ts';
import { printError } from './output.ts';
import { HogmanError } from './types.ts';
import { registerAccountCommands } from './commands/accounts.ts';
import { registerOrgCommands } from './commands/orgs.ts';
import { registerProjectCommands } from './commands/projects.ts';
import { registerFlagCommands } from './commands/flags.ts';
import { registerInsightCommands } from './commands/insights.ts';
import { registerDashboardCommands } from './commands/dashboards.ts';
import { registerQueryCommands } from './commands/query.ts';
import { registerErrorCommands } from './commands/errors.ts';
import { registerPersonCommands } from './commands/persons.ts';
import { registerPropertyCommands } from './commands/properties.ts';
import { registerLLMCommands } from './commands/llm.ts';
import { registerHogQLCommands } from './commands/hogql.ts';

const program = new Command();

program
  .name('hogman')
  .description('PostHog API CLI bridge for LLM consumption')
  .version('0.1.0')
  .option('--json', 'Output as JSON (structured, LLM-friendly)')
  .option('--account <name>', 'Use a specific account profile')
  .option('--project <id>', 'Override the project ID')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    setJsonMode(!!opts.json);
  });

registerAccountCommands(program);
registerOrgCommands(program);
registerProjectCommands(program);
registerFlagCommands(program);
registerInsightCommands(program);
registerDashboardCommands(program);
registerQueryCommands(program);
registerErrorCommands(program);
registerPersonCommands(program);
registerPropertyCommands(program);
registerLLMCommands(program);
registerHogQLCommands(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  if (err instanceof HogmanError) {
    printError(err.code, err.message, err.status);
  } else if (err instanceof Error) {
    printError('UNKNOWN_ERROR', err.message);
  } else {
    printError('UNKNOWN_ERROR', String(err));
  }
  process.exit(1);
});
