import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const FOLLOW_UP_MESSAGE = "Continue from where you left off and finish the task you were working on before compaction.";

export default function continueAfterCompaction(pi: ExtensionAPI) {
	pi.on("session_compact", async (_event, ctx) => {
		if (ctx.hasUI) {
			ctx.ui.notify("Compaction completed, continuing task", "info");
		}

		pi.sendUserMessage(FOLLOW_UP_MESSAGE, {
			deliverAs: "followUp",
			triggerTurn: true,
		});
	});
}
