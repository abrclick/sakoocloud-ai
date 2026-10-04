import Conf from "conf";
import { SakooCloudClient } from "@sakoocloud/sdk";

/**
 * Credential resolution — the same store the CLI writes, so `sakoocloud login` once is all it
 * takes. No env-var dance, no restart-with-env, no plaintext key in your shell profile.
 *
 * Priority:
 *   1. SAKOOCLOUD_API_KEY / SAKOOCLOUD_TOKEN env  → an `sakoo_sk_…` key (CI/headless). Never expires.
 *   2. The CLI login store (`sakoocloud login`)  → a JWT + refresh token. Auto-refreshed and
 *      persisted back to the store, so a long-lived server never goes stale mid-session.
 *   3. Neither → a clear error telling the user to run `sakoocloud login`.
 *
 * The store is the exact `conf` project the CLI uses (projectName "sakoocloud"), so its path is
 * resolved per-OS by conf/env-paths (macOS ~/Library/Preferences, Linux ~/.config,
 * Windows %APPDATA%) — identical on every machine, no hardcoded paths.
 */

interface CliConfigSchema {
  token: string;
  refreshToken: string;
  apiUrl: string;
  accountUrl: string;
  region: string;
}

// Must match sakoocloud-cli/src/lib/config.ts (projectName + these keys) so we read the same file.
const store = new Conf<CliConfigSchema>({
  projectName: "sakoocloud",
  defaults: {
    token: "",
    refreshToken: "",
    apiUrl: "https://api.sakoocloud.ir",
    accountUrl: "https://account.sakoocloud.ir",
    region: "",
  },
});

// The CLI stores bare origins (no /v1); the SDK expects the /v1 base. Normalize.
const withV1 = (url: string): string => `${url.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`;

export function createClient(): SakooCloudClient {
  // Bases: explicit env override, else whatever region the CLI is pointed at.
  const apiUrl = withV1(process.env.SAKOOCLOUD_API_URL ?? store.get("apiUrl"));
  const accountUrl = withV1(process.env.SAKOOCLOUD_ACCOUNT_URL ?? store.get("accountUrl"));

  // env wins — an explicit API key is the deliberate CI/headless override.
  const envKey = process.env.SAKOOCLOUD_API_KEY ?? process.env.SAKOOCLOUD_TOKEN;
  if (envKey) {
    // API-key path: no refresh token, no interceptor — the SDK sets the header once.
    return new SakooCloudClient({ apiUrl, accountUrl, token: envKey });
  }

  const token = store.get("token");
  if (!token) {
    throw new Error(
      "Not authenticated. Run `sakoocloud login` — this MCP server reads the same credentials.\n" +
        "For CI/headless, set SAKOOCLOUD_API_KEY=sakoo_sk_… instead.\n" +
        "Get the CLI: npm i -g @sakoocloud/cli",
    );
  }

  const refreshToken = store.get("refreshToken");
  return new SakooCloudClient({
    apiUrl,
    accountUrl,
    token,
    refreshToken: refreshToken || undefined,
    // Persist rotated tokens back to the shared store so CLI and MCP stay in lockstep.
    onTokenRefresh: ({ access_token, refresh_token }) => {
      store.set("token", access_token);
      store.set("refreshToken", refresh_token);
    },
  });
}
