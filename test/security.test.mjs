import assert from "node:assert/strict";
import test from "node:test";
import {
  executeWithUserConfirmation,
  getToolAnnotations,
  redactSensitiveResult,
  requiresUserConfirmation,
} from "../dist/security.js";
import { tools } from "../dist/tools.js";

const removedCredentialTools = [
  "sakoocloud_get_database_credentials",
  "sakoocloud_get_bucket_credentials",
  "sakoocloud_rotate_bucket_credentials",
  "sakoocloud_get_registry_credentials",
  "sakoocloud_rotate_registry_credentials",
  "sakoocloud_create_api_key",
];

test("credential-bearing tools are not exported", () => {
  const exportedNames = new Set(tools.map((tool) => tool.name));
  for (const name of removedCredentialTools) assert.equal(exportedNames.has(name), false);
});

test("tool classification defaults unknown tools to confirmation", () => {
  assert.equal(requiresUserConfirmation("sakoocloud_whoami"), false);
  assert.equal(requiresUserConfirmation("sakoocloud_get_app"), false);
  assert.equal(requiresUserConfirmation("sakoocloud_list_projects"), false);
  assert.equal(requiresUserConfirmation("sakoocloud_get_source_upload_url"), true);
  assert.equal(requiresUserConfirmation("sakoocloud_get_bucket_object_download_url"), true);
  assert.equal(requiresUserConfirmation("sakoocloud_get_disk_backup_download_url"), true);
  assert.equal(requiresUserConfirmation("sakoocloud_future_operation"), true);
  assert.equal(requiresUserConfirmation("sakoocloud_get_future_secret"), true);
  assert.equal(requiresUserConfirmation("sakoocloud_list_future_secrets"), true);
  assert.equal(requiresUserConfirmation("sakoocloud_get_runtime_logs"), true);
  assert.equal(requiresUserConfirmation("sakoocloud_get_function_source"), true);
  assert.equal(requiresUserConfirmation("sakoocloud_get_env"), true);
  assert.equal(requiresUserConfirmation("sakoocloud_get_project_env"), true);
  assert.equal(requiresUserConfirmation("sakoocloud_list_project_secrets"), true);
  assert.equal(requiresUserConfirmation("sakoocloud_list_api_keys"), true);
  assert.equal(requiresUserConfirmation("sakoocloud_list_bucket_objects"), true);
  assert.equal(requiresUserConfirmation("sakoocloud_list_registry_repositories"), true);
  assert.equal(requiresUserConfirmation("sakoocloud_list_github_repos"), true);
  assert.deepEqual(getToolAnnotations("sakoocloud_list_projects"), {
    readOnlyHint: true,
    destructiveHint: false,
  });
  assert.deepEqual(getToolAnnotations("sakoocloud_get_source_download_url"), {
    readOnlyHint: false,
    destructiveHint: false,
  });
  assert.deepEqual(getToolAnnotations("sakoocloud_delete_app"), {
    readOnlyHint: false,
    destructiveHint: true,
  });
  assert.equal(getToolAnnotations("sakoocloud_github_disconnect").destructiveHint, true);
});

test("result redaction handles nested arrays without mutating ordinary fields", () => {
  const source = {
    name: "demo",
    nested: { access_key_id: "key", safe: "kept" },
    values: [{ apiKey: "secret", count: 1 }],
    connectionString: "postgres://secret",
  };
  source.self = source;

  assert.deepEqual(redactSensitiveResult(source), {
    name: "demo",
    nested: { access_key_id: "[REDACTED]", safe: "kept" },
    values: [{ apiKey: "[REDACTED]", count: 1 }],
    connectionString: "[REDACTED]",
    self: "[Circular]",
  });
  assert.equal(source.nested.access_key_id, "key");
  assert.equal(source.values[0].apiKey, "secret");
});

function requester(response, supportsElicitation = true) {
  return {
    getClientCapabilities: () => supportsElicitation ? { elicitation: { form: {} } } : {},
    elicitInput: async () => response,
  };
}

const tool = { name: "sakoocloud_delete_app", description: "Delete an app" };

test("confirmation fails closed when elicitation is unavailable", async () => {
  let invocations = 0;
  await assert.rejects(
    executeWithUserConfirmation(
      requester({ action: "accept", content: { confirm: true } }, false),
      tool,
      async () => ++invocations,
    ),
    /does not support user confirmations/,
  );
  assert.equal(invocations, 0);
});

test("confirmation decline does not invoke the handler", async () => {
  let invocations = 0;
  await assert.rejects(
    executeWithUserConfirmation(requester({ action: "decline" }), tool, async () => ++invocations),
    /declined or cancelled/,
  );
  assert.equal(invocations, 0);
});

test("accepted confirmation invokes the handler exactly once", async () => {
  let invocations = 0;
  const result = await executeWithUserConfirmation(
    requester({ action: "accept", content: { confirm: true } }),
    tool,
    async () => ++invocations,
  );
  assert.equal(result, 1);
  assert.equal(invocations, 1);
});
