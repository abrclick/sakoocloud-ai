# @sakoocloud/ai

**Give your AI coding tool full control of [SakooCloud](https://sakoocloud.ir)** — the
Farsi-first **PaaS + DBaaS** for Iran. Point any MCP-capable AI (Claude Code, Cursor,
Codex, Windsurf, Copilot, Cline, …) at this package and it can create projects, deploy
apps, provision databases and object storage, push to container registries, run serverless
functions, schedule cron jobs, attach persistent disks, manage secrets, env vars, custom
domains, DNS, backups, metrics, alerts, and team members — all on your SakooCloud account,
straight from chat.

It is a thin, safe wrapper over [`@sakoocloud/sdk`](https://www.npmjs.com/package/@sakoocloud/sdk)
and speaks the **Model Context Protocol (MCP)** over **stdio**, so it plugs into every MCP
client the same way.

> **What is this, exactly?** A local program your AI tool launches. Your AI never talks
> to SakooCloud directly — it calls the `sakoocloud_*` tools this package exposes, which call
> the SakooCloud API as you. No plugin store, no browser extension. One `npx` line.

## Products

- [استقرار اپلیکیشن (PaaS)](https://sakoocloud.ir/paas) — deploy Node.js, Python, Go, PHP & Docker apps
- [دیتابیس مدیریت‌شده (DBaaS)](https://sakoocloud.ir/databases) — managed PostgreSQL, Redis, MongoDB, MySQL
- [فضای ذخیره‌سازی ابری (Object Storage)](https://sakoocloud.ir/object-storage) — S3-compatible buckets
- [توابع بدون سرور (Serverless)](https://sakoocloud.ir/serverless) — run functions without managing servers
- [همه‌ی محصولات](https://sakoocloud.ir/products)

## Why

You describe what you want — "deploy this Next.js repo and give it a Postgres" — and your
AI does it end to end: creates the project, the app, wires the git repo, provisions the
database, links them, kicks off the build, tails the logs, and hands you the live URL.
**166 tools** cover the whole platform.

## Prerequisites

- Node.js **>= 18**
- The SakooCloud CLI, logged in once:

  ```bash
  npm i -g @sakoocloud/cli
  sakoo login
  ```

That's the whole setup. The MCP server reads the **same credentials `sakoo login`
saves** — you don't paste a key anywhere, and there's no env var to keep in sync.

## Quick start

```bash
# 1. log in once (opens your browser)
sakoo login

# 2. add the MCP server — no key, no env
claude mcp add sakoocloud -- npx -y @sakoocloud/ai
```

Ask Claude: *"list my SakooCloud projects"* — if it answers, you're wired up.

## Authentication

The server resolves your credentials in this order:

1. **`sakoo login` (recommended).** The CLI stores a session (a short-lived access
   token + a refresh token) in your OS config dir. The MCP server reads it, and **refreshes
   it automatically** in the background — a long-running editor session never goes stale,
   and you never restart anything. This is why there's no env var and no "reload your
   shell" dance.
2. **`SAKOOCLOUD_API_KEY` env var (CI / headless).** Set an `sakoo_sk_…` key when there's no
   interactive login — e.g. a cron job or a remote box. It takes precedence over the login
   store when present. Create one with `sakoo keys create "ci"` or from **Settings →
   API Keys** in the dashboard. API keys don't expire (no refresh needed).

> **Why not just an API key in the config?** A full-access key sitting in a shell profile
> or an `.mcp.json` is a long-lived, plaintext, all-powerful credential — anyone who reads
> that file owns your account. The login session is short-lived and auto-rotated, and it
> lives in a `0600` file in your OS config dir, not in a project file you might commit.
> Keys remain the right tool for CI, where there's no human to log in.

### Configuration (optional overrides)

| Variable               | Purpose                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `SAKOOCLOUD_API_KEY`     | An `sakoo_sk_…` key. Use for CI/headless; overrides the login store when set.           |
| `SAKOOCLOUD_TOKEN`       | Alias for `SAKOOCLOUD_API_KEY` (matches the CLI's CI variable).                         |
| `SAKOOCLOUD_API_URL`     | Regional resource plane base URL. Override for self-host / dev.                       |
| `SAKOOCLOUD_ACCOUNT_URL` | Global identity plane (auth, regions, billing reads).                                 |
| `SAKOOCLOUD_REGION`      | A region's `api_url` to pin the resource plane to a specific region.                  |

> **Two planes.** SakooCloud separates a *global account plane* (who you are, regions,
> billing) from *regional resource planes* (where your apps and databases actually run).
> The package handles the split for you; `sakoo region use <slug>` (or `SAKOOCLOUD_REGION`)
> picks the region, and the MCP server follows it.

## Wiring it into an AI tool

First run `sakoo login` once. Then add the server — **no `--env`, no key in the file**:

### Claude Code

```bash
claude mcp add sakoocloud -- npx -y @sakoocloud/ai
```

Or add it to `.mcp.json` in your project (safe to commit — no secret in it):

```json
{
  "mcpServers": {
    "sakoocloud": {
      "command": "npx",
      "args": ["-y", "@sakoocloud/ai"]
    }
  }
}
```

### Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.sakoocloud]
command = "npx"
args = ["-y", "@sakoocloud/ai"]
```

### Cursor

Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "sakoocloud": {
      "command": "npx",
      "args": ["-y", "@sakoocloud/ai"]
    }
  }
}
```

### Windsurf / Cline / Continue / any other MCP client

Launch `npx -y @sakoocloud/ai` as a **stdio** MCP server. It picks up your `sakoo login`
session automatically. The config blocks above are the same shape every client uses — copy
one and change the file it goes in.

### CI / headless

No interactive login available? Set an API key in the server's environment instead:

```json
{
  "mcpServers": {
    "sakoocloud": {
      "command": "npx",
      "args": ["-y", "@sakoocloud/ai"],
      "env": { "SAKOOCLOUD_API_KEY": "sakoo_sk_xxx" }
    }
  }
}
```

## Tools

**166 tools**, all `sakoocloud_`-prefixed, grouped by resource:

### Identity & regions

`whoami`, `list_regions`

### Projects & team

`list_projects`, `create_project`, `get_project`, `update_project`, `delete_project`,
`list_members`, `invite_member`, `remove_member`, `update_member_role`, `list_invites`,
`cancel_invite`, `get_activity`

### Apps

`list_apps`, `create_app`, `get_app`, `update_app`, `delete_app`, `start_app`, `stop_app`,
`restart_app`, `deploy_app`, `redeploy_app`, `get_source_upload_url`,
`get_source_download_url`

### Environments (staging / development / promote)

`list_environments`, `create_environment`, `promote_app`

### Deployments & logs

`list_deployments`, `rollback_deployment`, `retry_deployment`, `get_build_logs`,
`get_runtime_logs`

### Env vars

`get_env`, `set_env`, `delete_env_var`

### App ↔ DB links

`get_app_links`, `link_db`, `unlink_db`

### Domains & TLS

`list_domains`, `add_domain`, `verify_domain`, `remove_domain`, `upload_cert`

### GitHub integration

`get_github_install_url`, `list_github_repos`, `github_disconnect`

### Databases

`list_databases`, `get_database_versions`, `create_database`, `get_database`,
`update_database`, `delete_database`,
`enable_db_public_access`, `disable_db_public_access`, `get_database_logs`

### Backups

`list_backups`, `create_backup`, `restore_backup`, `clone_backup`, `set_backup_schedule`,
`delete_backup`

### DNS

`list_dns_zones`, `create_dns_zone`, `verify_dns_zone`, `delete_dns_zone`,
`list_dns_records`, `upsert_dns_record`, `delete_dns_record`

### One-click templates

`list_templates`, `get_template`, `deploy_template`, `get_template_deployment`

### Metrics & tiers

`get_app_metrics`, `get_database_metrics`, `get_tiers`

### Billing (read-only)

`get_usage`, `get_plans`, `get_invoices`, `get_addons`, `get_my_addons`, `get_wallet`,
`get_wallet_transactions`, `get_agent_usage`

### Alerts

`list_alert_rules`, `create_alert_rule`, `toggle_alert_rule`, `delete_alert_rule`

### Notifications

`get_notifications`, `get_unread_count`, `mark_notification_read`,
`mark_all_notifications_read`

### Tasks (per-project kanban)

`list_tasks`, `create_task`, `update_task`, `delete_task`

### Object storage (S3 buckets)

`list_all_buckets`, `list_buckets`, `create_bucket`, `get_bucket`, `update_bucket`,
`delete_bucket`,
`list_bucket_objects`, `get_bucket_object_download_url`, `delete_bucket_object`,
`create_bucket_folder`, `get_bucket_cors`, `put_bucket_cors`, `delete_bucket_cors`,
`get_bucket_versioning`, `put_bucket_versioning`, `get_bucket_lifecycle`,
`put_bucket_lifecycle`, `delete_bucket_lifecycle`

### Container registry

`list_all_registries`, `list_registries`, `create_registry`, `get_registry`,
`update_registry`, `list_registry_repositories`, `delete_registry`

### Serverless functions

`list_functions`, `create_function`, `get_function`, `update_function`, `delete_function`,
`get_function_source`, `redeploy_function`, `get_function_metrics`,
`list_function_triggers`, `create_function_trigger`, `delete_function_trigger`

### Cron jobs

`list_crons`, `create_cron`, `get_cron`, `update_cron`, `delete_cron`, `run_cron`,
`get_cron_runs`, `get_cron_run_logs`

### Persistent disks

`list_disks`, `create_disk`, `get_disk`, `update_disk`, `attach_disk`, `detach_disk`,
`delete_disk`

### Disk backups

`list_disk_backups`, `create_disk_backup`, `get_disk_backup_download_url`,
`presign_disk_backup_restore`, `restore_disk_backup`, `delete_disk_backup`

### Secret manager

`list_project_secrets`, `create_secret`, `update_secret`, `delete_secret`,
`list_app_secrets`, `assign_secret_to_app`, `unassign_secret_from_app`

### Project-wide env vars

`get_project_env`, `set_project_env`, `delete_project_env_var`

### API keys

`list_api_keys`, `revoke_api_key`

## Bundled skill

This package ships an **SakooCloud skill** (`skills/sakoocloud/SKILL.md`) that teaches your AI
how to actually use these tools well — the project→app→database model, the deploy flow,
how to poll build logs, how to link a database, and which calls are destructive. MCP
clients that support skills load it automatically; others can read it for the same
guidance.

## Scope & safety

Designed so a well-meaning-but-fallible AI can drive real infrastructure without
foot-guns:

- **Billing is read-only.** `get_*` for usage, plans, invoices, wallet, and add-ons are
  exposed. Plan upgrades/downgrades, add-on **purchases**, and wallet **top-ups** are
  intentionally **not** — money moves are a human decision in the dashboard.
- **Sign-in is not exposed.** No login, register, password change, or device-code flow —
  your `sakoo login` session (or an API key) already establishes identity. GitHub
  **repo access** (for deploys) is exposed; GitHub/Google **sign-in** is not.
- **API-key metadata and revocation are exposed.** `list_api_keys` and `revoke_api_key`
  require an `admin`-scoped key or a full login session. Creating a key returns a plaintext
  credential, so it is intentionally unavailable through MCP; use the Console or CLI.
- **Mutating and unreviewed calls require confirmation.** The server asks through MCP form
  elicitation before executing them. If the client does not support form elicitation, the
  call fails closed without invoking the SakooCloud API. Tool descriptions also flag
  DESTRUCTIVE operations
  (`delete_project`, `delete_app`, `delete_database`, `delete_bucket`, `delete_registry`,
  `delete_function`, `delete_disk`, `delete_backup`, `delete_dns_zone`, `delete_dns_record`,
  `restore_backup`, `restore_disk_backup`, `disable_db_public_access`, `revoke_api_key`, …).
  Low-risk reviewed reads run without this extra prompt; client approval settings may add
  another confirmation layer.
- **Tarball / interactive ops need the CLI.** `deploy_app` supports `git` and `image`
  fully; `source_type: "upload"` deploys a tarball your AI can't stream — run
  `sakoo deploy` for local-folder deploys. Likewise an **interactive shell / one-off
  exec** into a running container is a streaming WebSocket, not a request/response tool —
  use `sakoo shell` / `sakoo run`.
- **Credentials stay out of MCP.** Retrieving or rotating database, bucket, and registry
  credentials and creating API keys are intentionally unavailable; use the Console or CLI.
  Environment secret values never return; rotate them by replacing values with `set_env`
  (write-only).

## Development

```bash
npm install        # pulls @sakoocloud/sdk from the registry
npm run type-check # tsc --noEmit
npm run build      # tsc → dist/
npm test           # build + security regression tests
npm start          # runs dist/index.js (uses your `sakoo login` session)
```

The tool surface tracks `@sakoocloud/sdk`. When the SDK gains a capability, add a matching
`ToolDefinition` in `src/tools.ts` and list it in the `tools` array — one wrapper per SDK
method.

## License

Proprietary. See [LICENSE](./LICENSE).
