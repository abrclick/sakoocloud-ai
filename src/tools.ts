import { z, ZodRawShape } from "zod";
import type { SakooCloudClient, EnvVar } from "@sakoocloud/sdk";

type Json = Record<string, unknown>;

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ZodRawShape;
  handler: (client: SakooCloudClient, args: Record<string, unknown>) => Promise<unknown>;
}

// Identity/regions
const whoami: ToolDefinition = {
  name: "sakoocloud_whoami",
  description: "Get current authenticated SakooCloud user information",
  inputSchema: {},
  handler: async (client) => client.getMe(),
};

const listRegions: ToolDefinition = {
  name: "sakoocloud_list_regions",
  description: "List available SakooCloud regions for deployment",
  inputSchema: {},
  handler: async (client) => client.listRegions(),
};

// Projects
const listProjects: ToolDefinition = {
  name: "sakoocloud_list_projects",
  description: "List all SakooCloud projects for the authenticated user",
  inputSchema: {},
  handler: async (client) => client.getProjects(),
};

const createProject: ToolDefinition = {
  name: "sakoocloud_create_project",
  description: "Create a new SakooCloud project",
  inputSchema: {
    name: z.string(),
    description: z.string().optional(),
  },
  handler: async (client, args) => client.createProject(args as { name: string; description?: string }),
};

const getProject: ToolDefinition = {
  name: "sakoocloud_get_project",
  description: "Get SakooCloud project details by ID",
  inputSchema: {
    project_id: z.string(),
  },
  handler: async (client, args) => client.getProject(args.project_id as string),
};

const updateProject: ToolDefinition = {
  name: "sakoocloud_update_project",
  description: "Update an SakooCloud project",
  inputSchema: {
    project_id: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
  },
  handler: async (client, args) => {
    const { project_id, ...input } = args;
    return client.updateProject(project_id as string, input);
  },
};

const deleteProject: ToolDefinition = {
  name: "sakoocloud_delete_project",
  description: "Delete an SakooCloud project (DESTRUCTIVE — removes the project and its resources)",
  inputSchema: {
    project_id: z.string(),
  },
  handler: async (client, args) => {
    await client.deleteProject(args.project_id as string);
    return { success: true };
  },
};

// Project members / invites / activity
const listMembers: ToolDefinition = {
  name: "sakoocloud_list_members",
  description: "List members of an SakooCloud project (with their roles)",
  inputSchema: {
    project_id: z.string(),
  },
  handler: async (client, args) => {
    const members = await client.getMembers(args.project_id as string);
    return { members };
  },
};

const inviteMember: ToolDefinition = {
  name: "sakoocloud_invite_member",
  description: "Invite a user to an SakooCloud project by email with a role",
  inputSchema: {
    project_id: z.string(),
    email: z.string(),
    role: z.enum(["admin", "developer", "viewer"]),
  },
  handler: async (client, args) =>
    client.inviteMember(args.project_id as string, {
      email: args.email as string,
      role: args.role as "admin" | "developer" | "viewer",
    }),
};

const removeMember: ToolDefinition = {
  name: "sakoocloud_remove_member",
  description: "Remove a member from an SakooCloud project",
  inputSchema: {
    project_id: z.string(),
    user_id: z.string(),
  },
  handler: async (client, args) => {
    await client.removeMember(args.project_id as string, args.user_id as string);
    return { success: true };
  },
};

const updateMemberRole: ToolDefinition = {
  name: "sakoocloud_update_member_role",
  description: "Change a project member's role",
  inputSchema: {
    project_id: z.string(),
    user_id: z.string(),
    role: z.enum(["admin", "developer", "viewer"]),
  },
  handler: async (client, args) =>
    client.updateMemberRole(
      args.project_id as string,
      args.user_id as string,
      args.role as "admin" | "developer" | "viewer",
    ),
};

const listInvites: ToolDefinition = {
  name: "sakoocloud_list_invites",
  description: "List pending member invites for an SakooCloud project",
  inputSchema: {
    project_id: z.string(),
  },
  handler: async (client, args) => {
    const invites = await client.getInvites(args.project_id as string);
    return { invites };
  },
};

const cancelInvite: ToolDefinition = {
  name: "sakoocloud_cancel_invite",
  description: "Cancel a pending project invite by its token",
  inputSchema: {
    token: z.string(),
  },
  handler: async (client, args) => {
    await client.cancelInvite(args.token as string);
    return { success: true };
  },
};

const getActivity: ToolDefinition = {
  name: "sakoocloud_get_activity",
  description: "Get the recent activity/audit log for an SakooCloud project",
  inputSchema: {
    project_id: z.string(),
  },
  handler: async (client, args) => {
    const activity = await client.getActivity(args.project_id as string);
    return { activity };
  },
};

// Apps
const listApps: ToolDefinition = {
  name: "sakoocloud_list_apps",
  description: "List SakooCloud apps (optionally filtered by project)",
  inputSchema: {
    project_id: z.string().optional(),
    page: z.number().optional(),
    limit: z.number().optional(),
  },
  handler: async (client, args) => {
    if (args.project_id) {
      return client.getApps(args.project_id as string, args.page as number, args.limit as number);
    }
    return client.getAllApps(args.page as number, args.limit as number);
  },
};

const createApp: ToolDefinition = {
  name: "sakoocloud_create_app",
  description:
    "Create a new SakooCloud app. cpu_limit/memory_limit MUST be a matching pair from a defined instance tier — call sakoocloud_get_tiers with type='app' and use one tier's exact cpu/mem. Never invent custom values (e.g. 1400m / 2560Mi); off-tier sizes are rejected. Omit both to get the smallest tier default.",
  inputSchema: {
    project_id: z.string(),
    name: z.string(),
    runtime: z.string(),
    port: z.number().optional(),
    cpu_limit: z
      .string()
      .optional()
      .describe("Must equal a tier's cpu from sakoocloud_get_tiers(type='app'). Pair with the SAME tier's memory_limit."),
    memory_limit: z
      .string()
      .optional()
      .describe("Must equal the SAME tier's mem from sakoocloud_get_tiers(type='app'). Pair with that tier's cpu_limit."),
    root_dir: z.string().optional(),
  },
  handler: async (client, args) => {
    const { project_id, ...input } = args as {
      project_id: string;
      name: string;
      runtime: string;
      port?: number;
      cpu_limit?: string;
      memory_limit?: string;
      root_dir?: string;
    };
    return client.createApp(project_id, input);
  },
};

const getApp: ToolDefinition = {
  name: "sakoocloud_get_app",
  description: "Get SakooCloud app details by ID",
  inputSchema: {
    app_id: z.string(),
  },
  handler: async (client, args) => client.getApp(args.app_id as string),
};

const updateApp: ToolDefinition = {
  name: "sakoocloud_update_app",
  description: "Update an SakooCloud app configuration",
  inputSchema: {
    app_id: z.string(),
    cpu_limit: z.string().optional(),
    memory_limit: z.string().optional(),
    replicas: z.number().optional(),
    git_repo_url: z.string().optional(),
    git_branch: z.string().optional(),
    git_auto_deploy: z.boolean().optional(),
    port: z.number().optional(),
    autoscale_enabled: z.boolean().optional(),
    autoscale_min: z.number().optional(),
    autoscale_max: z.number().optional(),
    health_check_path: z.string().nullable().optional(),
    root_dir: z.string().nullable().optional(),
  },
  handler: async (client, args) => {
    const { app_id, ...input } = args;
    return client.updateApp(app_id as string, input);
  },
};

const deleteApp: ToolDefinition = {
  name: "sakoocloud_delete_app",
  description: "Delete an SakooCloud app",
  inputSchema: {
    app_id: z.string(),
  },
  handler: async (client, args) => {
    await client.deleteApp(args.app_id as string);
    return { success: true };
  },
};

const startApp: ToolDefinition = {
  name: "sakoocloud_start_app",
  description: "Start an SakooCloud app",
  inputSchema: {
    app_id: z.string(),
  },
  handler: async (client, args) => {
    await client.startApp(args.app_id as string);
    return { success: true };
  },
};

const stopApp: ToolDefinition = {
  name: "sakoocloud_stop_app",
  description: "Stop an SakooCloud app",
  inputSchema: {
    app_id: z.string(),
  },
  handler: async (client, args) => {
    await client.stopApp(args.app_id as string);
    return { success: true };
  },
};

const restartApp: ToolDefinition = {
  name: "sakoocloud_restart_app",
  description: "Restart an SakooCloud app",
  inputSchema: {
    app_id: z.string(),
  },
  handler: async (client, args) => {
    await client.restartApp(args.app_id as string);
    return { success: true };
  },
};

const deployApp: ToolDefinition = {
  name: "sakoocloud_deploy_app",
  description:
    "Deploy an SakooCloud app. source_type 'git' builds from the app's configured repo (optionally pin git_commit_sha); 'image' deploys a prebuilt image (image_tag); 'upload' deploys a source tarball previously uploaded via sakoocloud_get_source_upload_url (source_key). NOTE: uploading the tarball bytes is a file transfer this tool can't perform — the human must run `sakoo deploy` locally for tarball uploads.",
  inputSchema: {
    app_id: z.string(),
    source_type: z.enum(["git", "image", "upload"]),
    image_tag: z.string().optional(),
    git_commit_sha: z.string().optional(),
    source_key: z.string().optional(),
  },
  handler: async (client, args) => {
    const { app_id, ...input } = args as {
      app_id: string;
      source_type: "git" | "image" | "upload";
      image_tag?: string;
      git_commit_sha?: string;
      source_key?: string;
    };
    return client.deployApp(app_id, input);
  },
};

const getSourceUploadUrl: ToolDefinition = {
  name: "sakoocloud_get_source_upload_url",
  description:
    "Get a presigned URL to upload an app source tarball (returns source_key + upload URL). The actual byte upload must be done by the human via `sakoo deploy`; this only mints the URL.",
  inputSchema: {
    app_id: z.string(),
  },
  handler: async (client, args) => client.getSourceUploadUrl(args.app_id as string),
};

const getSourceDownloadUrl: ToolDefinition = {
  name: "sakoocloud_get_source_download_url",
  description: "Get a presigned URL to download the current source tarball of an SakooCloud app",
  inputSchema: {
    app_id: z.string(),
  },
  handler: async (client, args) => client.getSourceDownloadUrl(args.app_id as string),
};

// Environments (staging/development clones) + promote
const listEnvironments: ToolDefinition = {
  name: "sakoocloud_list_environments",
  description: "List an SakooCloud app's environment slots (production/staging/development)",
  inputSchema: {
    app_id: z.string(),
  },
  handler: async (client, args) => {
    const environments = await client.listEnvironments(args.app_id as string);
    return { environments };
  },
};

const createEnvironment: ToolDefinition = {
  name: "sakoocloud_create_environment",
  description: "Create a staging or development environment clone for an SakooCloud app",
  inputSchema: {
    app_id: z.string(),
    environment: z.enum(["staging", "development"]),
  },
  handler: async (client, args) =>
    client.createEnvironment(args.app_id as string, args.environment as "staging" | "development"),
};

const promoteApp: ToolDefinition = {
  name: "sakoocloud_promote_app",
  description:
    "Promote an SakooCloud app's build to another environment without rebuilding. Promoting TO production requires confirm_production: true.",
  inputSchema: {
    app_id: z.string(),
    to: z.enum(["production", "staging", "development"]),
    confirm_production: z.boolean().optional(),
  },
  handler: async (client, args) =>
    client.promoteApp(
      args.app_id as string,
      args.to as "production" | "staging" | "development",
      args.confirm_production as boolean | undefined,
    ),
};

const redeployApp: ToolDefinition = {
  name: "sakoocloud_redeploy_app",
  description: "Redeploy an SakooCloud app with the last deployment configuration",
  inputSchema: {
    app_id: z.string(),
  },
  handler: async (client, args) => client.redeployApp(args.app_id as string),
};

const listDeployments: ToolDefinition = {
  name: "sakoocloud_list_deployments",
  description: "List SakooCloud app deployment history",
  inputSchema: {
    app_id: z.string(),
    page: z.number().optional(),
    limit: z.number().optional(),
  },
  handler: async (client, args) => {
    return client.getDeployments(args.app_id as string, args.page as number, args.limit as number);
  },
};

const rollbackDeployment: ToolDefinition = {
  name: "sakoocloud_rollback_deployment",
  description: "Rollback an SakooCloud app to a previous deployment",
  inputSchema: {
    app_id: z.string(),
    deploy_id: z.string(),
  },
  handler: async (client, args) => {
    return client.rollbackDeployment(args.app_id as string, args.deploy_id as string);
  },
};

const retryDeployment: ToolDefinition = {
  name: "sakoocloud_retry_deployment",
  description: "Retry a failed SakooCloud deployment",
  inputSchema: {
    app_id: z.string(),
    deploy_id: z.string(),
  },
  handler: async (client, args) => {
    return client.retryDeployment(args.app_id as string, args.deploy_id as string);
  },
};

const getBuildLogs: ToolDefinition = {
  name: "sakoocloud_get_build_logs",
  description: "Get SakooCloud app build logs for a deployment",
  inputSchema: {
    app_id: z.string(),
    deploy_id: z.string(),
    cursor: z.number().optional(),
  },
  handler: async (client, args) => {
    return client.getBuildLogs(args.app_id as string, args.deploy_id as string, args.cursor as number);
  },
};

const getRuntimeLogs: ToolDefinition = {
  name: "sakoocloud_get_runtime_logs",
  description: "Get SakooCloud app runtime logs",
  inputSchema: {
    app_id: z.string(),
    lines: z.number().optional(),
  },
  handler: async (client, args) => {
    const lines = await client.getRuntimeLogs(args.app_id as string, args.lines as number);
    return { lines };
  },
};

// Env
const getEnv: ToolDefinition = {
  name: "sakoocloud_get_env",
  description: "Get SakooCloud app environment variables with secret values masked-only",
  inputSchema: {
    app_id: z.string(),
  },
  handler: async (client, args) => {
    const vars = await client.getEnv(args.app_id as string);
    return { vars };
  },
};

const setEnv: ToolDefinition = {
  name: "sakoocloud_set_env",
  description: "Set SakooCloud app environment variables",
  inputSchema: {
    app_id: z.string(),
    vars: z.array(z.object({
      key: z.string(),
      value: z.string().optional(),
      is_secret: z.boolean().optional(),
      is_build_time: z.boolean().optional(),
    })),
  },
  handler: async (client, args) => {
    await client.setEnv(args.app_id as string, args.vars as Array<{
      key: string;
      value?: string;
      is_secret?: boolean;
      is_build_time?: boolean;
    }>);
    return { success: true };
  },
};

const deleteEnvVar: ToolDefinition = {
  name: "sakoocloud_delete_env_var",
  description: "Delete an SakooCloud app environment variable",
  inputSchema: {
    app_id: z.string(),
    key: z.string(),
  },
  handler: async (client, args) => {
    await client.deleteEnvVar(args.app_id as string, args.key as string);
    return { success: true };
  },
};

// DB links
const getAppLinks: ToolDefinition = {
  name: "sakoocloud_get_app_links",
  description: "Get SakooCloud app database links",
  inputSchema: {
    app_id: z.string(),
  },
  handler: async (client, args) => {
    const links = await client.getLinks(args.app_id as string);
    return { links };
  },
};

const linkDb: ToolDefinition = {
  name: "sakoocloud_link_db",
  description: "Link an SakooCloud database to an app",
  inputSchema: {
    app_id: z.string(),
    database_id: z.string(),
    env_prefix: z.string().optional(),
  },
  handler: async (client, args) => {
    return client.linkDb(args.app_id as string, args.database_id as string, args.env_prefix as string);
  },
};

const unlinkDb: ToolDefinition = {
  name: "sakoocloud_unlink_db",
  description: "Unlink an SakooCloud database from an app",
  inputSchema: {
    app_id: z.string(),
    link_id: z.string(),
  },
  handler: async (client, args) => {
    await client.unlinkDb(args.app_id as string, args.link_id as string);
    return { success: true };
  },
};

// Domains
const listDomains: ToolDefinition = {
  name: "sakoocloud_list_domains",
  description: "List SakooCloud app custom domains",
  inputSchema: {
    app_id: z.string(),
  },
  handler: async (client, args) => {
    const domains = await client.getDomains(args.app_id as string);
    return { domains };
  },
};

const addDomain: ToolDefinition = {
  name: "sakoocloud_add_domain",
  description: "Add a custom domain to an SakooCloud app",
  inputSchema: {
    app_id: z.string(),
    domain: z.string(),
  },
  handler: async (client, args) => {
    return client.addDomain(args.app_id as string, args.domain as string);
  },
};

const verifyDomain: ToolDefinition = {
  name: "sakoocloud_verify_domain",
  description: "Verify a custom domain for an SakooCloud app",
  inputSchema: {
    app_id: z.string(),
    domain_id: z.string(),
  },
  handler: async (client, args) => {
    return client.verifyDomain(args.app_id as string, args.domain_id as string);
  },
};

const removeDomain: ToolDefinition = {
  name: "sakoocloud_remove_domain",
  description: "Remove a custom domain from an SakooCloud app",
  inputSchema: {
    app_id: z.string(),
    domain_id: z.string(),
  },
  handler: async (client, args) => {
    await client.removeDomain(args.app_id as string, args.domain_id as string);
    return { success: true };
  },
};

const uploadCert: ToolDefinition = {
  name: "sakoocloud_upload_cert",
  description:
    "Upload a custom TLS certificate (PEM cert + private key) for a domain, instead of using auto-issued Let's Encrypt. Treat the key as a secret.",
  inputSchema: {
    app_id: z.string(),
    domain_id: z.string(),
    cert: z.string(),
    key: z.string(),
  },
  handler: async (client, args) =>
    client.uploadCert(
      args.app_id as string,
      args.domain_id as string,
      args.cert as string,
      args.key as string,
    ),
};

// GitHub app (repo access for git deploys — NOT sign-in)
const getGithubInstallUrl: ToolDefinition = {
  name: "sakoocloud_get_github_install_url",
  description:
    "Get the URL to install/authorize the SakooCloud GitHub app (grants repo access for git deploys). The human opens it in a browser.",
  inputSchema: {},
  handler: async (client) => client.getGithubInstallUrl(),
};

const listGithubRepos: ToolDefinition = {
  name: "sakoocloud_list_github_repos",
  description: "List GitHub repositories the SakooCloud GitHub app can access (for git deploys)",
  inputSchema: {},
  handler: async (client) => client.listGithubRepos(),
};

const githubDisconnect: ToolDefinition = {
  name: "sakoocloud_github_disconnect",
  description: "Disconnect the SakooCloud GitHub app integration",
  inputSchema: {},
  handler: async (client) => {
    await client.githubDisconnect();
    return { success: true };
  },
};

// Databases
const listDatabases: ToolDefinition = {
  name: "sakoocloud_list_databases",
  description: "List SakooCloud databases (optionally filtered by project)",
  inputSchema: {
    project_id: z.string().optional(),
    page: z.number().optional(),
    limit: z.number().optional(),
  },
  handler: async (client, args) => {
    if (args.project_id) {
      return client.getDatabases(args.project_id as string, args.page as number, args.limit as number);
    }
    return client.getAllDatabases(args.page as number, args.limit as number);
  },
};

const getDatabaseVersions: ToolDefinition = {
  name: "sakoocloud_get_database_versions",
  description: "Get available SakooCloud database engine versions",
  inputSchema: {},
  handler: async (client) => client.getDatabaseVersions(),
};

const createDatabase: ToolDefinition = {
  name: "sakoocloud_create_database",
  description:
    "Create a new SakooCloud database. cpu_limit/memory_limit MUST be a matching pair from a defined instance tier — call sakoocloud_get_tiers with type='database' and use one tier's exact cpu/mem. Never invent custom values; off-tier sizes are rejected. Omit both to get the smallest tier default.",
  inputSchema: {
    project_id: z.string(),
    name: z.string(),
    type: z.enum(["postgres", "redis", "mongo", "mysql", "mariadb", "valkey", "memcached", "rabbitmq", "kafka"]),
    version: z.string(),
    storage_gb: z.number(),
    cpu_limit: z
      .string()
      .optional()
      .describe("Must equal a tier's cpu from sakoocloud_get_tiers(type='database'). Pair with the SAME tier's memory_limit."),
    memory_limit: z
      .string()
      .optional()
      .describe("Must equal the SAME tier's mem from sakoocloud_get_tiers(type='database'). Pair with that tier's cpu_limit."),
    replica_set: z.boolean().optional(),
  },
  handler: async (client, args) => {
    const { project_id, ...input } = args as {
      project_id: string;
      name: string;
      type: "postgres" | "redis" | "mongo" | "mysql" | "mariadb" | "valkey" | "memcached" | "rabbitmq" | "kafka";
      version: string;
      storage_gb: number;
      cpu_limit?: string;
      memory_limit?: string;
      replica_set?: boolean;
    };
    return client.createDatabase(project_id, input);
  },
};

const getDatabase: ToolDefinition = {
  name: "sakoocloud_get_database",
  description: "Get SakooCloud database details by ID",
  inputSchema: {
    db_id: z.string(),
  },
  handler: async (client, args) => client.getDatabase(args.db_id as string),
};

const updateDatabase: ToolDefinition = {
  name: "sakoocloud_update_database",
  description: "Update an SakooCloud database configuration",
  inputSchema: {
    db_id: z.string(),
    storage_gb: z.number().optional(),
    cpu_limit: z.string().optional(),
    memory_limit: z.string().optional(),
  },
  handler: async (client, args) => {
    const { db_id, ...input } = args;
    return client.updateDatabase(db_id as string, input);
  },
};

const deleteDatabase: ToolDefinition = {
  name: "sakoocloud_delete_database",
  description: "Delete an SakooCloud database",
  inputSchema: {
    db_id: z.string(),
  },
  handler: async (client, args) => {
    await client.deleteDatabase(args.db_id as string);
    return { success: true };
  },
};

const enableDbPublicAccess: ToolDefinition = {
  name: "sakoocloud_enable_db_public_access",
  description: "Enable public internet access for an SakooCloud database",
  inputSchema: {
    db_id: z.string(),
  },
  handler: async (client, args) => client.enablePublicAccess(args.db_id as string),
};

const disableDbPublicAccess: ToolDefinition = {
  name: "sakoocloud_disable_db_public_access",
  description: "Disable public internet access for an SakooCloud database",
  inputSchema: {
    db_id: z.string(),
  },
  handler: async (client, args) => {
    await client.disablePublicAccess(args.db_id as string);
    return { success: true };
  },
};

const getDatabaseLogs: ToolDefinition = {
  name: "sakoocloud_get_database_logs",
  description: "Get SakooCloud database logs",
  inputSchema: {
    db_id: z.string(),
    cursor: z.number().optional(),
  },
  handler: async (client, args) => {
    return client.getDatabaseLogs(args.db_id as string, args.cursor as number);
  },
};

// Backups
const listBackups: ToolDefinition = {
  name: "sakoocloud_list_backups",
  description: "List SakooCloud database backups",
  inputSchema: {
    db_id: z.string(),
  },
  handler: async (client, args) => {
    const backups = await client.getBackups(args.db_id as string);
    return { backups };
  },
};

const createBackup: ToolDefinition = {
  name: "sakoocloud_create_backup",
  description: "Create an SakooCloud database backup",
  inputSchema: {
    db_id: z.string(),
  },
  handler: async (client, args) => client.createBackup(args.db_id as string),
};

const restoreBackup: ToolDefinition = {
  name: "sakoocloud_restore_backup",
  description: "Restore an SakooCloud database from a backup",
  inputSchema: {
    db_id: z.string(),
    backup_id: z.string(),
  },
  handler: async (client, args) => {
    return client.restoreBackup(args.db_id as string, args.backup_id as string);
  },
};

const setBackupSchedule: ToolDefinition = {
  name: "sakoocloud_set_backup_schedule",
  description:
    "Set or clear an SakooCloud database's automatic backup schedule. schedule is a cron expression (e.g. '0 3 * * *'), or null to disable.",
  inputSchema: {
    db_id: z.string(),
    schedule: z.string().nullable(),
  },
  handler: async (client, args) => {
    return client.setBackupSchedule(args.db_id as string, args.schedule as string | null);
  },
};

const cloneBackup: ToolDefinition = {
  name: "sakoocloud_clone_backup",
  description:
    "Clone a backup into a brand-new database (non-destructive — the original is untouched). Useful to spin up a copy for testing.",
  inputSchema: {
    db_id: z.string(),
    backup_id: z.string(),
    name: z.string(),
    cpu_limit: z.string().optional(),
    memory_limit: z.string().optional(),
    storage_gb: z.number().optional(),
  },
  handler: async (client, args) => {
    const { db_id, backup_id, ...input } = args as {
      db_id: string;
      backup_id: string;
      name: string;
      cpu_limit?: string;
      memory_limit?: string;
      storage_gb?: number;
    };
    return client.cloneBackup(db_id, backup_id, input);
  },
};

const deleteBackup: ToolDefinition = {
  name: "sakoocloud_delete_backup",
  description: "Delete an SakooCloud database backup (DESTRUCTIVE — the snapshot is gone)",
  inputSchema: {
    db_id: z.string(),
    backup_id: z.string(),
  },
  handler: async (client, args) => {
    await client.deleteBackup(args.db_id as string, args.backup_id as string);
    return { success: true };
  },
};

// DNS
const listDnsZones: ToolDefinition = {
  name: "sakoocloud_list_dns_zones",
  description: "List SakooCloud DNS zones",
  inputSchema: {},
  handler: async (client) => {
    const zones = await client.getDnsZones();
    return { zones };
  },
};

const createDnsZone: ToolDefinition = {
  name: "sakoocloud_create_dns_zone",
  description: "Create an SakooCloud DNS zone for a domain (returns nameservers to set at the registrar)",
  inputSchema: {
    name: z.string(),
  },
  handler: async (client, args) => client.createDnsZone(args.name as string),
};

const verifyDnsZone: ToolDefinition = {
  name: "sakoocloud_verify_dns_zone",
  description: "Verify an SakooCloud DNS zone's nameserver delegation is live",
  inputSchema: {
    zone_id: z.string(),
  },
  handler: async (client, args) => client.verifyDnsZone(args.zone_id as string),
};

const deleteDnsZone: ToolDefinition = {
  name: "sakoocloud_delete_dns_zone",
  description: "Delete an SakooCloud DNS zone and all its records (DESTRUCTIVE)",
  inputSchema: {
    zone_id: z.string(),
  },
  handler: async (client, args) => {
    await client.deleteDnsZone(args.zone_id as string);
    return { success: true };
  },
};

const listDnsRecords: ToolDefinition = {
  name: "sakoocloud_list_dns_records",
  description: "List SakooCloud DNS records for a zone",
  inputSchema: {
    zone_id: z.string(),
  },
  handler: async (client, args) => {
    const records = await client.getDnsRecords(args.zone_id as string);
    return { records };
  },
};

const upsertDnsRecord: ToolDefinition = {
  name: "sakoocloud_upsert_dns_record",
  description: "Create or update an SakooCloud DNS record",
  inputSchema: {
    zone_id: z.string(),
    name: z.string(),
    type: z.enum(["A", "AAAA", "CNAME", "TXT", "MX", "NS", "CAA", "SRV"]),
    ttl: z.number().optional(),
    records: z.array(z.string()),
  },
  handler: async (client, args) => {
    const { zone_id, ...input } = args as {
      zone_id: string;
      name: string;
      type: "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "NS" | "CAA" | "SRV";
      ttl?: number;
      records: string[];
    };
    return client.upsertDnsRecord(zone_id, input);
  },
};

const deleteDnsRecord: ToolDefinition = {
  name: "sakoocloud_delete_dns_record",
  description: "Delete an SakooCloud DNS record",
  inputSchema: {
    zone_id: z.string(),
    name: z.string(),
    type: z.enum(["A", "AAAA", "CNAME", "TXT", "MX", "NS", "CAA", "SRV"]),
  },
  handler: async (client, args) => {
    const { zone_id, ...input } = args as {
      zone_id: string;
      name: string;
      type: "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "NS" | "CAA" | "SRV";
    };
    await client.deleteDnsRecord(zone_id, input);
    return { success: true };
  },
};

// Templates
const listTemplates: ToolDefinition = {
  name: "sakoocloud_list_templates",
  description: "List SakooCloud one-click app templates (WordPress, n8n, Ghost, etc.)",
  inputSchema: {},
  handler: async (client) => {
    const templates = await client.getTemplates();
    return { templates };
  },
};

const getTemplate: ToolDefinition = {
  name: "sakoocloud_get_template",
  description: "Get an SakooCloud one-click template's details and required variables by slug",
  inputSchema: {
    slug: z.string(),
  },
  handler: async (client, args) => client.getTemplate(args.slug as string),
};

const deployTemplate: ToolDefinition = {
  name: "sakoocloud_deploy_template",
  description:
    "Deploy an SakooCloud one-click app template. If you override sizing, app_cpu/app_memory must be a matching pair from sakoocloud_get_tiers(type='app') and db_cpu/db_memory a pair from sakoocloud_get_tiers(type='database'). Never invent custom values — off-tier overrides are rejected. Omit them to use the template's declared defaults.",
  inputSchema: {
    slug: z.string(),
    project_id: z.string(),
    app_name: z.string(),
    app_cpu: z.string().optional().describe("Override: must equal a tier's cpu from sakoocloud_get_tiers(type='app'), paired with app_memory."),
    app_memory: z.string().optional().describe("Override: must equal the SAME app tier's mem, paired with app_cpu."),
    db_cpu: z.string().optional().describe("Override: must equal a tier's cpu from sakoocloud_get_tiers(type='database'), paired with db_memory."),
    db_memory: z.string().optional().describe("Override: must equal the SAME db tier's mem, paired with db_cpu."),
    variables: z.record(z.string()).optional(),
  },
  handler: async (client, args) => {
    const { slug, ...input } = args as {
      slug: string;
      project_id: string;
      app_name: string;
      app_cpu?: string;
      app_memory?: string;
      db_cpu?: string;
      db_memory?: string;
      variables?: Record<string, string>;
    };
    return client.deployTemplate(slug, input);
  },
};

const getTemplateDeployment: ToolDefinition = {
  name: "sakoocloud_get_template_deployment",
  description: "Get SakooCloud template deployment status by ID",
  inputSchema: {
    id: z.string(),
  },
  handler: async (client, args) => client.getTemplateDeployment(args.id as string),
};

// Metrics
const getAppMetrics: ToolDefinition = {
  name: "sakoocloud_get_app_metrics",
  description: "Get SakooCloud app resource metrics",
  inputSchema: {
    app_id: z.string(),
    range: z.string().optional(),
  },
  handler: async (client, args) => {
    return client.getAppMetrics(args.app_id as string, args.range as string);
  },
};

const getDatabaseMetrics: ToolDefinition = {
  name: "sakoocloud_get_database_metrics",
  description: "Get SakooCloud database resource metrics",
  inputSchema: {
    db_id: z.string(),
    range: z.string().optional(),
  },
  handler: async (client, args) => {
    return client.getDatabaseMetrics(args.db_id as string, args.range as string);
  },
};

// Resource sizing tiers
const getTiers: ToolDefinition = {
  name: "sakoocloud_get_tiers",
  description:
    "Get the available resource sizing tiers (CPU/memory presets) for apps or databases. Use before create/update to pick valid cpu_limit/memory_limit values.",
  inputSchema: {
    type: z.enum(["app", "database"]),
  },
  handler: async (client, args) => client.getTiers(args.type as "app" | "database"),
};

// Billing (READ-ONLY — plan changes, add-on purchases, and wallet top-ups are intentionally
// NOT exposed to AI tools; send the human to the dashboard for those).
const getUsage: ToolDefinition = {
  name: "sakoocloud_get_usage",
  description: "Get SakooCloud resource usage (optionally for a project)",
  inputSchema: {
    project_id: z.string().optional(),
  },
  handler: async (client, args) => client.getUsage(args.project_id as string),
};

const getPlans: ToolDefinition = {
  name: "sakoocloud_get_plans",
  description: "Get available SakooCloud billing plans (planet tiers) and their prices in Toman",
  inputSchema: {},
  handler: async (client) => client.getPlans(),
};

const getInvoices: ToolDefinition = {
  name: "sakoocloud_get_invoices",
  description: "List SakooCloud invoices (read-only)",
  inputSchema: {
    page: z.number().optional(),
    limit: z.number().optional(),
  },
  handler: async (client, args) => client.getInvoices(args.page as number, args.limit as number),
};

const getAddons: ToolDefinition = {
  name: "sakoocloud_get_addons",
  description: "List the SakooCloud add-ons available for purchase (read-only)",
  inputSchema: {},
  handler: async (client) => client.getAddons(),
};

const getMyAddons: ToolDefinition = {
  name: "sakoocloud_get_my_addons",
  description: "List the add-ons the current account has purchased (read-only)",
  inputSchema: {
    page: z.number().optional(),
    limit: z.number().optional(),
  },
  handler: async (client, args) => client.getMyAddons(args.page as number, args.limit as number),
};

const getWallet: ToolDefinition = {
  name: "sakoocloud_get_wallet",
  description: "Get SakooCloud wallet balance and information (read-only)",
  inputSchema: {},
  handler: async (client) => client.getWallet(),
};

const getWalletTransactions: ToolDefinition = {
  name: "sakoocloud_get_wallet_transactions",
  description: "List SakooCloud wallet transactions (read-only)",
  inputSchema: {
    limit: z.number().optional(),
    offset: z.number().optional(),
  },
  handler: async (client, args) =>
    client.getWalletTransactions(args.limit as number, args.offset as number),
};

const getAgentUsage: ToolDefinition = {
  name: "sakoocloud_get_agent_usage",
  description: "Get metered AI-agent token usage for the account (read-only). period: day|week|month.",
  inputSchema: {
    period: z.string().optional(),
  },
  handler: async (client, args) => client.getAgentUsage(args.period as string),
};

// Alert rules (auto-alerts on CPU/memory/disk/connection thresholds)
const listAlertRules: ToolDefinition = {
  name: "sakoocloud_list_alert_rules",
  description: "List SakooCloud alert rules for apps and databases",
  inputSchema: {},
  handler: async (client) => {
    // `/alert-rules` became paginated (`{ data, total, page, limit }`). The pinned SDK still
    // types this as a bare array, so accept either shape until the SDK is republished with the
    // filter-aware signature — an MCP tool must not start returning an envelope where the model
    // was promised a list.
    const result = (await client.getAlertRules()) as unknown as Json[] | { data: Json[] };
    return { rules: Array.isArray(result) ? result : result.data };
  },
};

const createAlertRule: ToolDefinition = {
  name: "sakoocloud_create_alert_rule",
  description:
    "Create an alert rule that notifies you when a metric crosses a threshold (e.g. CPU > 80% for 5 minutes).",
  inputSchema: {
    resource_id: z.string(),
    resource_type: z.enum(["app", "database"]),
    metric: z.enum(["cpu", "memory", "disk", "connections"]),
    operator: z.enum(["gt", "lt", "gte", "lte"]),
    threshold: z.number(),
    duration_minutes: z.number().optional(),
    notify_via: z.enum(["sms", "email", "both"]).optional(),
  },
  handler: async (client, args) =>
    client.createAlertRule({
      resourceId: args.resource_id as string,
      resourceType: args.resource_type as "app" | "database",
      metric: args.metric as "cpu" | "memory" | "disk" | "connections",
      operator: args.operator as "gt" | "lt" | "gte" | "lte",
      threshold: args.threshold as number,
      durationMinutes: args.duration_minutes as number | undefined,
      notifyVia: args.notify_via as "sms" | "email" | "both" | undefined,
    }),
};

const toggleAlertRule: ToolDefinition = {
  name: "sakoocloud_toggle_alert_rule",
  description: "Enable or disable an SakooCloud alert rule",
  inputSchema: {
    rule_id: z.string(),
    enabled: z.boolean(),
  },
  handler: async (client, args) =>
    client.toggleAlertRule(args.rule_id as string, args.enabled as boolean),
};

const deleteAlertRule: ToolDefinition = {
  name: "sakoocloud_delete_alert_rule",
  description: "Delete an SakooCloud alert rule",
  inputSchema: {
    rule_id: z.string(),
  },
  handler: async (client, args) => {
    await client.deleteAlertRule(args.rule_id as string);
    return { success: true };
  },
};

// Notifications
const getNotifications: ToolDefinition = {
  name: "sakoocloud_get_notifications",
  description: "Get SakooCloud notifications (optionally unread only)",
  inputSchema: {
    unread_only: z.boolean().optional(),
  },
  handler: async (client, args) => {
    const notifications = await client.getNotifications(args.unread_only as boolean);
    return { notifications };
  },
};

const getUnreadCount: ToolDefinition = {
  name: "sakoocloud_get_unread_count",
  description: "Get the number of unread SakooCloud notifications",
  inputSchema: {},
  handler: async (client) => {
    const count = await client.getUnreadCount();
    return { count };
  },
};

const markNotificationRead: ToolDefinition = {
  name: "sakoocloud_mark_notification_read",
  description: "Mark a single SakooCloud notification as read",
  inputSchema: {
    id: z.string(),
  },
  handler: async (client, args) => client.markNotificationRead(args.id as string),
};

const markAllNotificationsRead: ToolDefinition = {
  name: "sakoocloud_mark_all_notifications_read",
  description: "Mark all SakooCloud notifications as read",
  inputSchema: {},
  handler: async (client) => {
    await client.markAllNotificationsRead();
    return { success: true };
  },
};

// Tasks (per-project kanban)
const listTasks: ToolDefinition = {
  name: "sakoocloud_list_tasks",
  description: "List the kanban tasks of an SakooCloud project",
  inputSchema: {
    project_id: z.string(),
  },
  handler: async (client, args) => {
    const tasks = await client.getTasks(args.project_id as string);
    return { tasks };
  },
};

const createTask: ToolDefinition = {
  name: "sakoocloud_create_task",
  description: "Create a kanban task in an SakooCloud project",
  inputSchema: {
    project_id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    app_id: z.string().optional(),
    status: z.enum(["backlog", "todo", "doing", "review", "done"]).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    due_date: z.string().optional(),
    labels: z.array(z.string()).optional(),
    assignee_id: z.string().optional(),
  },
  handler: async (client, args) =>
    client.createTask(args.project_id as string, {
      title: args.title as string,
      description: args.description as string | undefined,
      appId: args.app_id as string | undefined,
      status: args.status as "backlog" | "todo" | "doing" | "review" | "done" | undefined,
      priority: args.priority as "low" | "medium" | "high" | undefined,
      dueDate: args.due_date as string | undefined,
      labels: args.labels as string[] | undefined,
      assigneeId: args.assignee_id as string | undefined,
    }),
};

const updateTask: ToolDefinition = {
  name: "sakoocloud_update_task",
  description: "Update a kanban task (title, status, priority, etc.)",
  inputSchema: {
    task_id: z.string(),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    status: z.enum(["backlog", "todo", "doing", "review", "done"]).optional(),
    position: z.number().optional(),
    app_id: z.string().nullable().optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    due_date: z.string().nullable().optional(),
    labels: z.array(z.string()).optional(),
    assignee_id: z.string().nullable().optional(),
  },
  handler: async (client, args) =>
    client.updateTask(args.task_id as string, {
      title: args.title as string | undefined,
      description: args.description as string | null | undefined,
      status: args.status as "backlog" | "todo" | "doing" | "review" | "done" | undefined,
      position: args.position as number | undefined,
      appId: args.app_id as string | null | undefined,
      priority: args.priority as "low" | "medium" | "high" | undefined,
      dueDate: args.due_date as string | null | undefined,
      labels: args.labels as string[] | undefined,
      assigneeId: args.assignee_id as string | null | undefined,
    }),
};

const deleteTask: ToolDefinition = {
  name: "sakoocloud_delete_task",
  description: "Delete a kanban task from an SakooCloud project",
  inputSchema: {
    task_id: z.string(),
  },
  handler: async (client, args) => {
    await client.deleteTask(args.task_id as string);
    return { success: true };
  },
};

// ---- Object Storage (buckets) ----
const listAllBuckets: ToolDefinition = {
  name: "sakoocloud_list_all_buckets",
  description: "List all object-storage buckets across every project for the authenticated user",
  inputSchema: {},
  handler: async (client) => client.getAllBuckets(),
};

const listBuckets: ToolDefinition = {
  name: "sakoocloud_list_buckets",
  description: "List object-storage (S3) buckets in a project",
  inputSchema: { project_id: z.string() },
  handler: async (client, args) => client.getBuckets(args.project_id as string),
};

const createBucket: ToolDefinition = {
  name: "sakoocloud_create_bucket",
  description: "Create an S3-compatible object-storage bucket. sizeGb must be a fixed step (10GB free).",
  inputSchema: {
    project_id: z.string(),
    name: z.string().describe("3-63 lowercase alphanumerics or hyphens"),
    sizeGb: z.number().int().min(10).max(250),
    region: z.string().optional(),
    isPublic: z.boolean().optional().describe("Allow anonymous read"),
    objectLockEnabled: z.boolean().optional().describe("Create-time only; also enables versioning"),
  },
  handler: async (client, args) => {
    const { project_id, ...input } = args;
    return client.createBucket(project_id as string, input as never);
  },
};

const getBucket: ToolDefinition = {
  name: "sakoocloud_get_bucket",
  description: "Get an object-storage bucket by ID",
  inputSchema: { bucket_id: z.string() },
  handler: async (client, args) => client.getBucket(args.bucket_id as string),
};

const updateBucket: ToolDefinition = {
  name: "sakoocloud_update_bucket",
  description: "Update a bucket (resize sizeGb — grow-only steps — or toggle public read)",
  inputSchema: {
    bucket_id: z.string(),
    sizeGb: z.number().int().min(10).max(250).optional(),
    isPublic: z.boolean().optional(),
  },
  handler: async (client, args) => {
    const { bucket_id, ...input } = args;
    return client.updateBucket(bucket_id as string, input as never);
  },
};

const deleteBucket: ToolDefinition = {
  name: "sakoocloud_delete_bucket",
  description: "Delete a bucket (DESTRUCTIVE — removes the bucket and all its objects)",
  inputSchema: { bucket_id: z.string() },
  handler: async (client, args) => {
    await client.deleteBucket(args.bucket_id as string);
    return { success: true };
  },
};

const listBucketObjects: ToolDefinition = {
  name: "sakoocloud_list_bucket_objects",
  description: "List objects in a bucket (optionally filtered by prefix; delimiter for folder view)",
  inputSchema: {
    bucket_id: z.string(),
    prefix: z.string().optional(),
    delimiter: z.string().optional(),
    token: z.string().optional().describe("Continuation token for the next page"),
  },
  handler: async (client, args) => {
    const { bucket_id, ...params } = args;
    return client.listBucketObjects(bucket_id as string, params as never);
  },
};

const getBucketObjectDownloadUrl: ToolDefinition = {
  name: "sakoocloud_get_bucket_object_download_url",
  description: "Get a presigned download URL for a single object by key",
  inputSchema: { bucket_id: z.string(), key: z.string() },
  handler: async (client, args) => client.getBucketObjectDownloadUrl(args.bucket_id as string, args.key as string),
};

const deleteBucketObject: ToolDefinition = {
  name: "sakoocloud_delete_bucket_object",
  description: "Delete a single object from a bucket by key (DESTRUCTIVE)",
  inputSchema: { bucket_id: z.string(), key: z.string() },
  handler: async (client, args) => {
    await client.deleteBucketObject(args.bucket_id as string, args.key as string);
    return { success: true };
  },
};

const createBucketFolder: ToolDefinition = {
  name: "sakoocloud_create_bucket_folder",
  description: "Create an empty folder (zero-byte prefix marker) in a bucket",
  inputSchema: {
    bucket_id: z.string(),
    name: z.string().describe("Folder name (no '/')"),
    prefix: z.string().optional().describe("Parent prefix to create the folder under"),
  },
  handler: async (client, args) =>
    client.createBucketFolder(args.bucket_id as string, args.name as string, args.prefix as string | undefined),
};

const getBucketCors: ToolDefinition = {
  name: "sakoocloud_get_bucket_cors",
  description: "Get a bucket's CORS rules",
  inputSchema: { bucket_id: z.string() },
  handler: async (client, args) => client.getBucketCors(args.bucket_id as string),
};

const putBucketCors: ToolDefinition = {
  name: "sakoocloud_put_bucket_cors",
  description: "Replace a bucket's CORS rules (max 100 rules)",
  inputSchema: {
    bucket_id: z.string(),
    rules: z
      .array(
        z.object({
          allowedOrigins: z.array(z.string()),
          allowedMethods: z.array(z.enum(["GET", "PUT", "POST", "DELETE", "HEAD"])),
          allowedHeaders: z.array(z.string()).optional(),
          exposeHeaders: z.array(z.string()).optional(),
          maxAgeSeconds: z.number().int().min(0).optional(),
        }),
      )
      .describe("CORS rules"),
  },
  handler: async (client, args) => client.putBucketCors(args.bucket_id as string, args.rules as never),
};

const deleteBucketCors: ToolDefinition = {
  name: "sakoocloud_delete_bucket_cors",
  description: "Delete all CORS rules from a bucket",
  inputSchema: { bucket_id: z.string() },
  handler: async (client, args) => {
    await client.deleteBucketCors(args.bucket_id as string);
    return { success: true };
  },
};

const getBucketVersioning: ToolDefinition = {
  name: "sakoocloud_get_bucket_versioning",
  description: "Get a bucket's versioning state",
  inputSchema: { bucket_id: z.string() },
  handler: async (client, args) => client.getBucketVersioning(args.bucket_id as string),
};

const putBucketVersioning: ToolDefinition = {
  name: "sakoocloud_put_bucket_versioning",
  description: "Enable or disable object versioning on a bucket",
  inputSchema: { bucket_id: z.string(), enabled: z.boolean() },
  handler: async (client, args) => client.putBucketVersioning(args.bucket_id as string, args.enabled as boolean),
};

const getBucketLifecycle: ToolDefinition = {
  name: "sakoocloud_get_bucket_lifecycle",
  description: "Get a bucket's lifecycle rules",
  inputSchema: { bucket_id: z.string() },
  handler: async (client, args) => client.getBucketLifecycle(args.bucket_id as string),
};

const putBucketLifecycle: ToolDefinition = {
  name: "sakoocloud_put_bucket_lifecycle",
  description: "Replace a bucket's lifecycle rules (object expiration, noncurrent-version cleanup, multipart abort)",
  inputSchema: {
    bucket_id: z.string(),
    rules: z
      .array(
        z.object({
          id: z.string(),
          prefix: z.string().optional(),
          expirationDays: z.number().int().min(1).optional(),
          noncurrentDays: z.number().int().min(1).optional(),
          newerNoncurrentVersions: z.number().int().min(0).optional(),
          abortIncompleteMultipartDays: z.number().int().min(1).optional(),
          enabled: z.boolean().optional(),
        }),
      )
      .describe("Lifecycle rules"),
  },
  handler: async (client, args) => client.putBucketLifecycle(args.bucket_id as string, args.rules as never),
};

const deleteBucketLifecycle: ToolDefinition = {
  name: "sakoocloud_delete_bucket_lifecycle",
  description: "Delete all lifecycle rules from a bucket",
  inputSchema: { bucket_id: z.string() },
  handler: async (client, args) => {
    await client.deleteBucketLifecycle(args.bucket_id as string);
    return { success: true };
  },
};

// ---- Container Registry ----
const listAllRegistries: ToolDefinition = {
  name: "sakoocloud_list_all_registries",
  description: "List all container registries across every project for the authenticated user",
  inputSchema: {},
  handler: async (client) => client.getAllRegistries(),
};

const listRegistries: ToolDefinition = {
  name: "sakoocloud_list_registries",
  description: "List container (Docker/OCI) registries in a project",
  inputSchema: { project_id: z.string() },
  handler: async (client, args) => client.getRegistries(args.project_id as string),
};

const createRegistry: ToolDefinition = {
  name: "sakoocloud_create_registry",
  description: "Create a private container registry. sizeGb must be a fixed step (1GB free).",
  inputSchema: {
    project_id: z.string(),
    name: z.string().describe("3-63 lowercase alphanumerics or hyphens"),
    sizeGb: z.number().int().min(1).max(100),
    isPublic: z.boolean().optional().describe("Allow anonymous image pulls"),
  },
  handler: async (client, args) => {
    const { project_id, ...input } = args;
    return client.createRegistry(project_id as string, input as never);
  },
};

const getRegistry: ToolDefinition = {
  name: "sakoocloud_get_registry",
  description: "Get a container registry by ID",
  inputSchema: { registry_id: z.string() },
  handler: async (client, args) => client.getRegistry(args.registry_id as string),
};

const updateRegistry: ToolDefinition = {
  name: "sakoocloud_update_registry",
  description: "Update a registry (resize sizeGb — grow-only steps — or toggle public pulls)",
  inputSchema: {
    registry_id: z.string(),
    sizeGb: z.number().int().min(1).max(100).optional(),
    isPublic: z.boolean().optional(),
  },
  handler: async (client, args) => {
    const { registry_id, ...input } = args;
    return client.updateRegistry(registry_id as string, input as never);
  },
};

const listRegistryRepositories: ToolDefinition = {
  name: "sakoocloud_list_registry_repositories",
  description: "List image repositories (and tags) inside a registry",
  inputSchema: { registry_id: z.string() },
  handler: async (client, args) => client.getRegistryRepositories(args.registry_id as string),
};

const deleteRegistry: ToolDefinition = {
  name: "sakoocloud_delete_registry",
  description: "Delete a container registry (DESTRUCTIVE — removes all images)",
  inputSchema: { registry_id: z.string() },
  handler: async (client, args) => {
    await client.deleteRegistry(args.registry_id as string);
    return { success: true };
  },
};

// ---- Functions (FaaS) ----
const listFunctions: ToolDefinition = {
  name: "sakoocloud_list_functions",
  description: "List serverless functions in a project",
  inputSchema: { project_id: z.string() },
  handler: async (client, args) => client.getFunctions(args.project_id as string),
};

const createFunction: ToolDefinition = {
  name: "sakoocloud_create_function",
  description: "Create a serverless function. Pass inline `code` (Node handler, max ~256KB) or upload later.",
  inputSchema: {
    project_id: z.string(),
    name: z.string(),
    entryFile: z.string().optional().describe("e.g. index.handler"),
    code: z.string().optional().describe("Inline handler source, max ~256KB"),
    memoryMb: z.number().int().min(128).max(4096).optional(),
    timeoutSec: z.number().int().min(1).max(900).optional(),
  },
  handler: async (client, args) => {
    const { project_id, ...input } = args;
    return client.createFunction(project_id as string, input as never);
  },
};

const getFunction: ToolDefinition = {
  name: "sakoocloud_get_function",
  description: "Get a serverless function by ID",
  inputSchema: { function_id: z.string() },
  handler: async (client, args) => client.getFunction(args.function_id as string),
};

const updateFunction: ToolDefinition = {
  name: "sakoocloud_update_function",
  description: "Update a function's name, entry file, memory, or timeout",
  inputSchema: {
    function_id: z.string(),
    name: z.string().optional(),
    entryFile: z.string().optional(),
    memoryMb: z.number().int().min(128).max(4096).optional(),
    timeoutSec: z.number().int().min(1).max(900).optional(),
  },
  handler: async (client, args) => {
    const { function_id, ...input } = args;
    return client.updateFunction(function_id as string, input as never);
  },
};

const deleteFunction: ToolDefinition = {
  name: "sakoocloud_delete_function",
  description: "Delete a serverless function (DESTRUCTIVE)",
  inputSchema: { function_id: z.string() },
  handler: async (client, args) => {
    await client.deleteFunction(args.function_id as string);
    return { success: true };
  },
};

const getFunctionSource: ToolDefinition = {
  name: "sakoocloud_get_function_source",
  description: "Get a function's current handler source code",
  inputSchema: { function_id: z.string() },
  handler: async (client, args) => client.getFunctionSource(args.function_id as string),
};

const redeployFunction: ToolDefinition = {
  name: "sakoocloud_redeploy_function",
  description: "Redeploy a function with new inline handler source (max ~256KB)",
  inputSchema: { function_id: z.string(), code: z.string() },
  handler: async (client, args) => client.redeployFunction(args.function_id as string, args.code as string),
};

const getFunctionMetrics: ToolDefinition = {
  name: "sakoocloud_get_function_metrics",
  description: "Get invocation/latency metrics for a function",
  inputSchema: { function_id: z.string(), range: z.string().optional().describe("e.g. 1h, 24h, 7d") },
  handler: async (client, args) =>
    client.getFunctionMetrics(args.function_id as string, args.range as string | undefined),
};

const listFunctionTriggers: ToolDefinition = {
  name: "sakoocloud_list_function_triggers",
  description: "List a function's triggers (http, cron, queue)",
  inputSchema: { function_id: z.string() },
  handler: async (client, args) => client.getFunctionTriggers(args.function_id as string),
};

const createFunctionTrigger: ToolDefinition = {
  name: "sakoocloud_create_function_trigger",
  description: "Add a trigger to a function. cronSchedule required when type=cron; queueRef required when type=queue.",
  inputSchema: {
    function_id: z.string(),
    type: z.enum(["http", "cron", "queue"]),
    cronSchedule: z.string().optional().describe("Required for type=cron, e.g. '0 * * * *'"),
    queueRef: z.string().optional().describe("Required for type=queue"),
    enabled: z.boolean().optional(),
  },
  handler: async (client, args) => {
    const { function_id, ...input } = args;
    return client.createFunctionTrigger(function_id as string, input as never);
  },
};

const deleteFunctionTrigger: ToolDefinition = {
  name: "sakoocloud_delete_function_trigger",
  description: "Delete a trigger from a function",
  inputSchema: { function_id: z.string(), trigger_id: z.string() },
  handler: async (client, args) => {
    await client.deleteFunctionTrigger(args.function_id as string, args.trigger_id as string);
    return { success: true };
  },
};

// ---- Cron jobs ----
const listCrons: ToolDefinition = {
  name: "sakoocloud_list_crons",
  description: "List scheduled cron jobs for an app",
  inputSchema: { app_id: z.string() },
  handler: async (client, args) => client.getCrons(args.app_id as string),
};

const createCron: ToolDefinition = {
  name: "sakoocloud_create_cron",
  description: "Create a scheduled cron job that runs a command in an app's container",
  inputSchema: {
    appId: z.string(),
    name: z.string(),
    schedule: z.string().describe("5-field cron expression, e.g. '0 3 * * *'"),
    command: z.string().describe("e.g. 'node scripts/cleanup.js'"),
    timezone: z.string().optional().describe("Defaults to Asia/Tehran"),
    enabled: z.boolean().optional(),
  },
  handler: async (client, args) => client.createCron(args as never),
};

const getCron: ToolDefinition = {
  name: "sakoocloud_get_cron",
  description: "Get a cron job by ID",
  inputSchema: { cron_id: z.string() },
  handler: async (client, args) => client.getCron(args.cron_id as string),
};

const updateCron: ToolDefinition = {
  name: "sakoocloud_update_cron",
  description: "Update a cron job (schedule, command, timezone, or enable/disable)",
  inputSchema: {
    cron_id: z.string(),
    name: z.string().optional(),
    schedule: z.string().optional(),
    command: z.string().optional(),
    timezone: z.string().optional(),
    enabled: z.boolean().optional(),
  },
  handler: async (client, args) => {
    const { cron_id, ...input } = args;
    return client.updateCron(cron_id as string, input as never);
  },
};

const deleteCron: ToolDefinition = {
  name: "sakoocloud_delete_cron",
  description: "Delete a cron job",
  inputSchema: { cron_id: z.string() },
  handler: async (client, args) => {
    await client.deleteCron(args.cron_id as string);
    return { success: true };
  },
};

const runCron: ToolDefinition = {
  name: "sakoocloud_run_cron",
  description: "Trigger a cron job to run immediately (one-off, off-schedule)",
  inputSchema: { cron_id: z.string() },
  handler: async (client, args) => client.runCron(args.cron_id as string),
};

const getCronRuns: ToolDefinition = {
  name: "sakoocloud_get_cron_runs",
  description: "List a cron job's execution history",
  inputSchema: { cron_id: z.string() },
  handler: async (client, args) => client.getCronRuns(args.cron_id as string),
};

const getCronRunLogs: ToolDefinition = {
  name: "sakoocloud_get_cron_run_logs",
  description: "Get logs for a specific cron run",
  inputSchema: { cron_id: z.string(), job_name: z.string() },
  handler: async (client, args) => client.getCronRunLogs(args.cron_id as string, args.job_name as string),
};

// ---- Persistent disks ----
const listDisks: ToolDefinition = {
  name: "sakoocloud_list_disks",
  description: "List persistent disks (volumes) in a project",
  inputSchema: { project_id: z.string() },
  handler: async (client, args) => client.getDisks(args.project_id as string),
};

const createDisk: ToolDefinition = {
  name: "sakoocloud_create_disk",
  description: "Create a persistent disk (volume). size_gb grows only afterwards.",
  inputSchema: {
    project_id: z.string(),
    name: z.string(),
    size_gb: z.number().int().min(1).max(500),
    mount_path: z.string().optional().describe("Mount path when attached (default /data), must start with /"),
  },
  handler: async (client, args) => {
    const { project_id, ...input } = args;
    return client.createDisk(project_id as string, input as never);
  },
};

const getDisk: ToolDefinition = {
  name: "sakoocloud_get_disk",
  description: "Get a persistent disk by ID",
  inputSchema: { disk_id: z.string() },
  handler: async (client, args) => client.getDisk(args.disk_id as string),
};

const updateDisk: ToolDefinition = {
  name: "sakoocloud_update_disk",
  description: "Update a disk (grow size_gb — cannot shrink — or change mount path; redeploys the attached app)",
  inputSchema: {
    disk_id: z.string(),
    size_gb: z.number().int().min(1).max(500).optional(),
    mount_path: z.string().optional().describe("Must start with /"),
  },
  handler: async (client, args) => {
    const { disk_id, ...input } = args;
    return client.updateDisk(disk_id as string, input as never);
  },
};

const attachDisk: ToolDefinition = {
  name: "sakoocloud_attach_disk",
  description: "Attach a disk to an app (one disk per app). Redeploys the app.",
  inputSchema: {
    disk_id: z.string(),
    app_id: z.string(),
    mount_path: z.string().optional().describe("Override the disk's mount path, must start with /"),
  },
  handler: async (client, args) => {
    const { disk_id, ...input } = args;
    return client.attachDisk(disk_id as string, input as never);
  },
};

const detachDisk: ToolDefinition = {
  name: "sakoocloud_detach_disk",
  description: "Detach a disk from its app. Redeploys the app.",
  inputSchema: { disk_id: z.string() },
  handler: async (client, args) => client.detachDisk(args.disk_id as string),
};

const deleteDisk: ToolDefinition = {
  name: "sakoocloud_delete_disk",
  description: "Delete a persistent disk (DESTRUCTIVE — must be detached first)",
  inputSchema: { disk_id: z.string() },
  handler: async (client, args) => {
    await client.deleteDisk(args.disk_id as string);
    return { success: true };
  },
};

// ---- Disk backups ----
const listDiskBackups: ToolDefinition = {
  name: "sakoocloud_list_disk_backups",
  description: "List backups (snapshots) of a persistent disk",
  inputSchema: { disk_id: z.string() },
  handler: async (client, args) => client.getDiskBackups(args.disk_id as string),
};

const createDiskBackup: ToolDefinition = {
  name: "sakoocloud_create_disk_backup",
  description: "Create a backup (tarball snapshot) of a persistent disk",
  inputSchema: { disk_id: z.string() },
  handler: async (client, args) => client.createDiskBackup(args.disk_id as string),
};

const getDiskBackupDownloadUrl: ToolDefinition = {
  name: "sakoocloud_get_disk_backup_download_url",
  description: "Get a presigned download URL for a disk backup tarball",
  inputSchema: { disk_id: z.string(), backup_id: z.string() },
  handler: async (client, args) => client.getDiskBackupDownloadUrl(args.disk_id as string, args.backup_id as string),
};

const presignDiskBackupRestore: ToolDefinition = {
  name: "sakoocloud_presign_disk_backup_restore",
  description: "Get a presigned PUT URL to upload a tarball for restoring into a disk. Returns the upload key.",
  inputSchema: {
    disk_id: z.string(),
    filename: z.string().min(1).max(255).describe("Tarball filename, including its extension"),
    size_bytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).describe("Tarball size in bytes"),
  },
  handler: async (client, args) => {
    const { disk_id, ...input } = args;
    return client.presignDiskBackupRestore(disk_id as string, input as never);
  },
};

const restoreDiskBackup: ToolDefinition = {
  name: "sakoocloud_restore_disk_backup",
  description: "Restore a previously-uploaded tarball into a detached, ready disk (use the key from presign)",
  inputSchema: { disk_id: z.string(), upload_key: z.string() },
  handler: async (client, args) => client.restoreDiskBackup(args.disk_id as string, args.upload_key as string),
};

const deleteDiskBackup: ToolDefinition = {
  name: "sakoocloud_delete_disk_backup",
  description: "Delete a disk backup (row + S3 tarball)",
  inputSchema: { disk_id: z.string(), backup_id: z.string() },
  handler: async (client, args) => {
    await client.deleteDiskBackup(args.disk_id as string, args.backup_id as string);
    return { success: true };
  },
};

// ---- Secret manager ----
const listProjectSecrets: ToolDefinition = {
  name: "sakoocloud_list_project_secrets",
  description: "List secrets in a project (registry credentials or key-value blobs; values are not returned)",
  inputSchema: { project_id: z.string() },
  handler: async (client, args) => client.getProjectSecrets(args.project_id as string),
};

const createSecret: ToolDefinition = {
  name: "sakoocloud_create_secret",
  description:
    "Create a project secret. type=registry → data {registry, username, password}; type=kv → arbitrary {KEY: value}.",
  inputSchema: {
    project_id: z.string(),
    name: z.string(),
    type: z.enum(["registry", "kv"]),
    data: z.record(z.string()).describe("registry: {registry, username, password}; kv: arbitrary key/value"),
  },
  handler: async (client, args) => {
    const { project_id, ...input } = args;
    return client.createSecret(project_id as string, input as never);
  },
};

const updateSecret: ToolDefinition = {
  name: "sakoocloud_update_secret",
  description: "Replace a secret's data blob (same per-type shape as create)",
  inputSchema: {
    project_id: z.string(),
    secret_id: z.string(),
    data: z.record(z.string()),
  },
  handler: async (client, args) =>
    client.updateSecret(args.project_id as string, args.secret_id as string, { data: args.data as never }),
};

const deleteSecret: ToolDefinition = {
  name: "sakoocloud_delete_secret",
  description: "Delete a project secret (DESTRUCTIVE)",
  inputSchema: { project_id: z.string(), secret_id: z.string() },
  handler: async (client, args) => {
    await client.deleteSecret(args.project_id as string, args.secret_id as string);
    return { success: true };
  },
};

const listAppSecrets: ToolDefinition = {
  name: "sakoocloud_list_app_secrets",
  description: "List secrets attached to an app",
  inputSchema: { app_id: z.string() },
  handler: async (client, args) => client.getAppSecrets(args.app_id as string),
};

const assignSecretToApp: ToolDefinition = {
  name: "sakoocloud_assign_secret_to_app",
  description: "Attach a project secret to an app. Redeploys the app.",
  inputSchema: { app_id: z.string(), secret_id: z.string() },
  handler: async (client, args) => {
    await client.assignSecretToApp(args.app_id as string, args.secret_id as string);
    return { success: true };
  },
};

const unassignSecretFromApp: ToolDefinition = {
  name: "sakoocloud_unassign_secret_from_app",
  description: "Detach a secret from an app. Redeploys the app.",
  inputSchema: { app_id: z.string(), secret_id: z.string() },
  handler: async (client, args) => {
    await client.unassignSecretFromApp(args.app_id as string, args.secret_id as string);
    return { success: true };
  },
};

// ---- Project-level env vars ----
const getProjectEnv: ToolDefinition = {
  name: "sakoocloud_get_project_env",
  description: "Get project-wide environment variables (shared across all apps in the project)",
  inputSchema: { project_id: z.string() },
  handler: async (client, args) => client.getProjectEnv(args.project_id as string),
};

const setProjectEnv: ToolDefinition = {
  name: "sakoocloud_set_project_env",
  description: "Bulk upsert project-wide environment variables (shared across all apps)",
  inputSchema: {
    project_id: z.string(),
    vars: z.array(z.object({
      key: z.string(),
      value: z.string().optional(),
      is_secret: z.boolean().optional(),
      is_build_time: z.boolean().optional(),
    })),
  },
  handler: async (client, args) => {
    await client.setProjectEnv(args.project_id as string, args.vars as EnvVar[]);
    return { success: true };
  },
};

const deleteProjectEnvVar: ToolDefinition = {
  name: "sakoocloud_delete_project_env_var",
  description: "Delete a single project-wide environment variable by key",
  inputSchema: { project_id: z.string(), key: z.string() },
  handler: async (client, args) => {
    await client.deleteProjectEnvVar(args.project_id as string, args.key as string);
    return { success: true };
  },
};

// ---- API keys (require an admin-scoped key or a JWT session) ----
const listApiKeys: ToolDefinition = {
  name: "sakoocloud_list_api_keys",
  description: "List the authenticated user's API keys (metadata only — never the secret values)",
  inputSchema: {},
  handler: async (client) => client.getApiKeys(),
};

const revokeApiKey: ToolDefinition = {
  name: "sakoocloud_revoke_api_key",
  description: "Revoke (delete) an API key by ID (DESTRUCTIVE — the key stops working immediately)",
  inputSchema: { key_id: z.string() },
  handler: async (client, args) => {
    await client.revokeApiKey(args.key_id as string);
    return { success: true };
  },
};

export const tools: ToolDefinition[] = [
  // Identity / regions
  whoami,
  listRegions,
  // Projects
  listProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  // Members / invites / activity
  listMembers,
  inviteMember,
  removeMember,
  updateMemberRole,
  listInvites,
  cancelInvite,
  getActivity,
  // Apps
  listApps,
  createApp,
  getApp,
  updateApp,
  deleteApp,
  startApp,
  stopApp,
  restartApp,
  deployApp,
  redeployApp,
  getSourceUploadUrl,
  getSourceDownloadUrl,
  // Environments / promote
  listEnvironments,
  createEnvironment,
  promoteApp,
  // Deployments
  listDeployments,
  rollbackDeployment,
  retryDeployment,
  getBuildLogs,
  getRuntimeLogs,
  // Env vars
  getEnv,
  setEnv,
  deleteEnvVar,
  // App ↔ DB links
  getAppLinks,
  linkDb,
  unlinkDb,
  // Domains
  listDomains,
  addDomain,
  verifyDomain,
  removeDomain,
  uploadCert,
  // GitHub
  getGithubInstallUrl,
  listGithubRepos,
  githubDisconnect,
  // Databases
  listDatabases,
  getDatabaseVersions,
  createDatabase,
  getDatabase,
  updateDatabase,
  deleteDatabase,
  enableDbPublicAccess,
  disableDbPublicAccess,
  getDatabaseLogs,
  // Backups
  listBackups,
  createBackup,
  restoreBackup,
  cloneBackup,
  setBackupSchedule,
  deleteBackup,
  // DNS
  listDnsZones,
  createDnsZone,
  verifyDnsZone,
  deleteDnsZone,
  listDnsRecords,
  upsertDnsRecord,
  deleteDnsRecord,
  // Templates
  listTemplates,
  getTemplate,
  deployTemplate,
  getTemplateDeployment,
  // Metrics
  getAppMetrics,
  getDatabaseMetrics,
  // Tiers
  getTiers,
  // Billing (read-only)
  getUsage,
  getPlans,
  getInvoices,
  getAddons,
  getMyAddons,
  getWallet,
  getWalletTransactions,
  getAgentUsage,
  // Alert rules
  listAlertRules,
  createAlertRule,
  toggleAlertRule,
  deleteAlertRule,
  // Notifications
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  // Tasks
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  // Object Storage (buckets)
  listAllBuckets,
  listBuckets,
  createBucket,
  getBucket,
  updateBucket,
  deleteBucket,
  listBucketObjects,
  getBucketObjectDownloadUrl,
  deleteBucketObject,
  createBucketFolder,
  getBucketCors,
  putBucketCors,
  deleteBucketCors,
  getBucketVersioning,
  putBucketVersioning,
  getBucketLifecycle,
  putBucketLifecycle,
  deleteBucketLifecycle,
  // Container Registry
  listAllRegistries,
  listRegistries,
  createRegistry,
  getRegistry,
  updateRegistry,
  listRegistryRepositories,
  deleteRegistry,
  // Functions (FaaS)
  listFunctions,
  createFunction,
  getFunction,
  updateFunction,
  deleteFunction,
  getFunctionSource,
  redeployFunction,
  getFunctionMetrics,
  listFunctionTriggers,
  createFunctionTrigger,
  deleteFunctionTrigger,
  // Cron jobs
  listCrons,
  createCron,
  getCron,
  updateCron,
  deleteCron,
  runCron,
  getCronRuns,
  getCronRunLogs,
  // Persistent disks
  listDisks,
  createDisk,
  getDisk,
  updateDisk,
  attachDisk,
  detachDisk,
  deleteDisk,
  // Disk backups
  listDiskBackups,
  createDiskBackup,
  getDiskBackupDownloadUrl,
  presignDiskBackupRestore,
  restoreDiskBackup,
  deleteDiskBackup,
  // Secret manager
  listProjectSecrets,
  createSecret,
  updateSecret,
  deleteSecret,
  listAppSecrets,
  assignSecretToApp,
  unassignSecretFromApp,
  // Project-level env vars
  getProjectEnv,
  setProjectEnv,
  deleteProjectEnvVar,
  // API keys
  listApiKeys,
  revokeApiKey,
];
