import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SakooCloudClient } from "@sakoocloud/sdk";
import { executeWithUserConfirmation, getToolAnnotations, redactSensitiveResult, requiresUserConfirmation } from "./security.js";
import { tools } from "./tools.js";

// The API's AllExceptionsFilter sends a NESTED envelope:
//   { statusCode, success:false, error: { code, message, message_fa, timestamp, path } }
// The old flat interface here read `data.error` (the nested OBJECT) into a string template →
// "Error: [object Object]", with message/status undefined. That masked every real error. Model the
// real shape; a few legacy paths still send flat top-level fields, so both are optional.
interface ApiErrorEnvelope {
  statusCode?: number;
  status?: number;
  // Nested (current filter). `error` is an object here; on legacy paths it may be a bare code string.
  error?: string | { code?: string; message?: string | string[]; message_fa?: string };
  message?: string | string[];
  message_fa?: string;
}

interface AxiosError extends Error {
  response?: {
    status?: number;
    data?: ApiErrorEnvelope;
  };
  isAxiosError?: boolean;
}

export function createServer(client: SakooCloudClient): McpServer {
  const server = new McpServer(
    {
      name: "sakoocloud-ai",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: getToolAnnotations(tool.name),
      },
      async (args) => {
        try {
          const result = requiresUserConfirmation(tool.name)
            ? await executeWithUserConfirmation(server.server, tool, () => tool.handler(client, args))
            : await tool.handler(client, args);

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(redactSensitiveResult(result), null, 2),
              },
            ],
          };
        } catch (err) {
          const error = err as AxiosError;

          let errorText: string;

          if (error.isAxiosError && error.response?.data) {
            const apiError = error.response.data;
            // Flatten the nested `error` object (current filter) OR bare fields (legacy paths).
            const nested = typeof apiError.error === "object" ? apiError.error : undefined;
            const code = typeof apiError.error === "string" ? apiError.error : nested?.code;
            const msg = nested?.message ?? apiError.message;
            const msgFa = nested?.message_fa ?? apiError.message_fa;
            const httpStatus = apiError.statusCode ?? apiError.status ?? error.response.status;

            const parts: string[] = [];
            if (code) parts.push(`Error: ${code}`);
            if (msg) parts.push(`Message: ${Array.isArray(msg) ? msg.join(", ") : msg}`);
            if (msgFa) parts.push(`Message (Farsi): ${msgFa}`);
            if (httpStatus) parts.push(`Status: ${httpStatus}`);

            errorText = parts.length > 0 ? parts.join("\n") : error.message;
          } else {
            errorText = error.message ?? "Unknown error";
          }

          return {
            content: [
              {
                type: "text" as const,
                text: errorText,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  return server;
}
