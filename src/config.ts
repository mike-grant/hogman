import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { HogmanConfig, ResolvedAccount } from './types.ts';
import { HogmanError } from './types.ts';

const CONFIG_DIR = join(homedir(), '.config', 'hogman');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export function loadConfig(): HogmanConfig {
  if (!existsSync(CONFIG_FILE)) {
    return { accounts: {} };
  }
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as HogmanConfig;
  } catch {
    throw new HogmanError('CONFIG_ERROR', `Failed to parse config file: ${CONFIG_FILE}`);
  }
}

export function saveConfig(config: HogmanConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
}

export function resolveAccount(opts: {
  account?: string;
  project?: string;
}): ResolvedAccount {
  // Priority 1: Environment variables
  const envKey = process.env.POSTHOG_API_KEY;
  const envHost = process.env.POSTHOG_HOST;
  const envProject = process.env.POSTHOG_PROJECT_ID;

  if (envKey) {
    return {
      apiKey: envKey,
      host: envHost ?? 'https://app.posthog.com',
      projectId: envProject ? parseInt(envProject, 10) : undefined,
    };
  }

  // Priority 2 & 3: CLI flags / config defaults
  const config = loadConfig();
  const accountName = opts.account ?? config.defaultAccount;

  if (!accountName) {
    throw new HogmanError(
      'NO_ACCOUNT',
      'No account configured. Run: hogman accounts add <name> --api-key <key>'
    );
  }

  const account = config.accounts[accountName];
  if (!account) {
    throw new HogmanError('NO_ACCOUNT', `Account not found: "${accountName}"`);
  }

  const projectId = opts.project
    ? parseInt(opts.project, 10)
    : account.defaultProject;

  return {
    apiKey: account.apiKey,
    host: account.host ?? 'https://app.posthog.com',
    projectId,
  };
}

export function requireProjectId(opts: { account?: string; project?: string }): {
  apiKey: string;
  host: string;
  projectId: number;
} {
  const resolved = resolveAccount(opts);
  if (!resolved.projectId) {
    throw new HogmanError(
      'NO_PROJECT',
      'No project configured. Run: hogman projects use <id>'
    );
  }
  return { ...resolved, projectId: resolved.projectId };
}
