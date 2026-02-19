# hogman

> PostHog CLI bridge designed for LLM consumption

hogman wraps the PostHog REST API as a shell CLI with structured `--json` output, making it easy for LLMs and automation scripts to query analytics, inspect feature flags, run HogQL, and more. It mirrors the read capabilities of the official PostHog MCP server but works anywhere you can run a shell command.

**Read-only** — hogman never creates, updates, or deletes PostHog resources.

---

## Install

### Download a binary (recommended)

Grab the latest release for your platform from the [releases page](https://github.com/mike-grant/hogman/releases):

```bash
# macOS Apple Silicon
curl -L https://github.com/mike-grant/hogman/releases/latest/download/hogman-darwin-arm64 -o /usr/local/bin/hogman
chmod +x /usr/local/bin/hogman

# macOS Intel
curl -L https://github.com/mike-grant/hogman/releases/latest/download/hogman-darwin-x64 -o /usr/local/bin/hogman
chmod +x /usr/local/bin/hogman

# Linux x64
curl -L https://github.com/mike-grant/hogman/releases/latest/download/hogman-linux-x64 -o /usr/local/bin/hogman
chmod +x /usr/local/bin/hogman
```

### Build from source

Requires [Bun](https://bun.sh) v1.0+.

```bash
git clone https://github.com/mike-grant/hogman.git
cd hogman
bun install
bun run build        # produces ./hogman binary
# or for development (no build step needed):
bun link             # makes `hogman` available in PATH via bun
```

---

## Setup

### 1. Get a PostHog Personal API Key

1. Go to **PostHog → Settings → Personal API keys**
2. Create a new key — enable at minimum:
   - **Query** — required for `hogman query` and `hogman llm costs`
   - **Read** (project-level) — required for `flags`, `insights`, `dashboards`, `persons`, etc.
3. Copy the key (starts with `phx_`)

> **Note:** PostHog has two hosting regions. Use `https://app.posthog.com` for US Cloud and `https://eu.posthog.com` for EU Cloud. The event ingestion host (`eu.i.posthog.com`) won't work here.

### 2. Add an account

```bash
hogman accounts add default --api-key phx_your_key_here
# EU Cloud:
hogman accounts add default --api-key phx_your_key_here --host https://eu.posthog.com
```

### 3. Set your default project

```bash
hogman projects list          # find your project ID
hogman projects use 12345     # saves it to config
```

You're ready. Config is stored at `~/.config/hogman/config.json`.

---

## Commands

### Accounts

```bash
hogman accounts list
hogman accounts add <name> --api-key <key> [--host <url>]
hogman accounts remove <name>
hogman accounts default <name>
```

### Projects & Orgs

```bash
hogman orgs list
hogman projects list
hogman projects use <id>        # saves default project for this account
```

### HogQL Query

The most powerful command — run any HogQL query against your project:

```bash
hogman query "SELECT event, count() FROM events GROUP BY event ORDER BY count() DESC LIMIT 20"
hogman query --file analysis.sql
hogman query --refresh "SELECT ..."     # bypass cache
```

Not sure what syntax to use? Run `hogman hogql help` first.

### Feature Flags

```bash
hogman flags list
hogman flags get <key>          # e.g. hogman flags get my-feature
hogman flags get <id>           # e.g. hogman flags get 42
```

### Insights & Dashboards

```bash
hogman insights list [--favorited]
hogman insights get <id>

hogman dashboards list
hogman dashboards get <id>
```

### Persons

```bash
hogman persons list [--search <query>] [--limit <n>]
hogman persons get <distinct-id>
```

### Properties

```bash
hogman properties list
hogman properties list --type event
hogman properties list --type person
hogman properties list --type group
```

### Error Tracking

```bash
hogman errors list
hogman errors list --status active
hogman errors list --status resolved
hogman errors get <id>
```

### LLM Costs

Queries `$ai_generation` events — works if you use PostHog's LLM observability SDK:

```bash
hogman llm costs
hogman llm costs --from 2026-01-01 --to 2026-01-31
```

### HogQL Reference

Built-in cheat sheet so LLMs know the correct syntax before writing queries:

```bash
hogman hogql help             # full reference (tables, functions, gotchas, examples)
hogman hogql patterns         # just the common query patterns
```

---

## Global Flags

These can be placed anywhere in the command:

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON — clean, structured, LLM-friendly |
| `--account <name>` | Use a specific account profile |
| `--project <id>` | Override the default project ID |

---

## Output Contract

LLMs and scripts can rely on this behaviour:

| Scenario | stdout | stderr | Exit code |
|----------|--------|--------|-----------|
| Success (human) | Formatted table | — | 0 |
| Success (`--json`) | `[{...}]` or `{...}` | — | 0 |
| Error (human) | — | `[CODE] message` | 1 |
| Error (`--json`) | `{"error":"...","code":"..."}` | `[CODE] message` | 1 |

**Error codes:** `NO_ACCOUNT` `NO_PROJECT` `UNAUTHORIZED` `FORBIDDEN` `NOT_FOUND` `RATE_LIMITED` `SERVER_ERROR` `API_ERROR` `CONFIG_ERROR` `UNKNOWN_ERROR`

---

## Multi-Account Config

`~/.config/hogman/config.json` supports named profiles:

```json
{
  "defaultAccount": "personal",
  "accounts": {
    "personal": {
      "apiKey": "phx_...",
      "host": "https://app.posthog.com",
      "defaultProject": 12345
    },
    "work-eu": {
      "apiKey": "phx_...",
      "host": "https://eu.posthog.com",
      "defaultProject": 67890
    }
  }
}
```

**Resolution order** (highest → lowest priority):

1. Env vars: `POSTHOG_API_KEY`, `POSTHOG_HOST`, `POSTHOG_PROJECT_ID`
2. CLI flags: `--account <name>`, `--project <id>`
3. Config defaults

---

## LLM Usage

The recommended workflow for an LLM agent:

```bash
# 1. Learn the HogQL dialect before writing queries
hogman hogql help --json

# 2. Discover what events exist in the project
hogman query --json "SELECT event, count() FROM events WHERE timestamp >= now() - interval 7 day GROUP BY event ORDER BY count() DESC LIMIT 30"

# 3. Discover what custom properties exist
hogman properties list --json --type event

# 4. Run analysis
hogman query --json "SELECT toDate(timestamp) AS day, uniq(distinct_id) AS users FROM events WHERE timestamp >= now() - interval 30 day GROUP BY day ORDER BY day"
```

---

## Development

```bash
bun install
bun run dev                  # watch mode, no build step
bun run typecheck            # type-check without compiling
bun run build                # compile to ./hogman binary
bun run build:binaries       # compile for all platforms → dist-binaries/
```

### Project structure

```
src/
├── index.ts          # Entry point, Commander program, global flags
├── types.ts          # PostHog API types + config types
├── config.ts         # Load/save config, account resolution
├── client.ts         # PostHogClient — all API calls + pagination
├── output.ts         # print() / printTable() / printError() — human vs JSON
└── commands/
    ├── accounts.ts   # accounts list/add/remove/default
    ├── orgs.ts       # orgs list
    ├── projects.ts   # projects list/use
    ├── flags.ts      # flags list/get
    ├── insights.ts   # insights list/get
    ├── dashboards.ts # dashboards list/get
    ├── query.ts      # query "<hogql>" / --file
    ├── errors.ts     # errors list/get
    ├── persons.ts    # persons list/get
    ├── properties.ts # properties list
    ├── llm.ts        # llm costs
    └── hogql.ts      # hogql help / patterns (HogQL reference)
```

### Releasing

1. Bump version in `package.json`
2. Push a tag: `git tag v0.2.0 && git push origin v0.2.0`
3. GitHub Actions builds all 4 platform binaries and publishes the release automatically

---

## License

MIT — see [LICENSE](LICENSE)
