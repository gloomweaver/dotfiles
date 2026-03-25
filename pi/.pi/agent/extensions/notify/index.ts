import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { execSync } from "node:child_process";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "notify",
    label: "Notify",
    description:
      "Send a macOS notification. Use this when a long-running task completes or when the user asks to be notified.",
    parameters: Type.Object({
      title: Type.String({ description: "Notification title" }),
      message: Type.String({ description: "Notification body" }),
    }),
    async execute(_toolCallId, params) {
      const title = params.title.replace(/"/g, '\\"');
      const message = params.message.replace(/"/g, '\\"');
      try {
        execSync(
          `osascript -e 'display notification "${message}" with title "${title}"'`
        );
        return {
          content: [{ type: "text", text: `Notification sent: ${params.title}` }],
        };
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Failed to send notification: ${e.message}` }],
          isError: true,
        };
      }
    },
    renderCall(args, theme) {
      return new Text(
        theme.fg("toolTitle", theme.bold("notify ")) +
          theme.fg("accent", args.title || "..."),
        0,
        0
      );
    },
    renderResult(result, _opts, theme) {
      const text = result.content?.[0];
      const msg = text?.type === "text" ? text.text : "";
      return new Text(
        result.isError ? theme.fg("error", msg) : theme.fg("success", `✓ ${msg}`),
        0,
        0
      );
    },
  });
}
