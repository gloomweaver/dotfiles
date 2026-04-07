import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { execSync } from "node:child_process";

function sendNotification(title: string, message: string) {
  const t = title.replace(/"/g, '\\"');
  const m = message.replace(/"/g, '\\"');
  execSync(
    `osascript -e 'display notification "${m}" with title "${t}"'`
  );
}

export default function (pi: ExtensionAPI) {
  // Auto-notify when agent finishes a task
  pi.on("agent_end", async (event) => {
    try {
      let summary = "Task completed";
      const messages = event.messages ?? [];
      // Find last assistant message and extract text
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === "assistant" && Array.isArray(msg.content)) {
          const textParts = msg.content
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          if (textParts.length > 0) {
            summary = textParts.length > 100
              ? textParts.slice(0, 100) + "…"
              : textParts;
            break;
          }
        }
      }
      sendNotification("Pi", summary);
    } catch {}
  });

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
      try {
        sendNotification(params.title, params.message);
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
