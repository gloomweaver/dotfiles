import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { complete, type Message } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionCommandContext, SessionEntry } from "@mariozechner/pi-coding-agent";
import {
	BorderedLoader,
	DynamicBorder,
	convertToLlm,
	getMarkdownTheme,
} from "@mariozechner/pi-coding-agent";
import { Container, Markdown, Spacer, Text, matchesKey } from "@mariozechner/pi-tui";

const BTW_USAGE = "Usage: /btw <question>";
const SIDE_QUESTION_SYSTEM_PROMPT = `You are answering a quick side question about an existing pi coding session.

Rules:
- Answer only from the supplied conversation context and system instructions.
- Do not claim to have opened files, run commands, searched the web, or verified anything outside that context.
- If the context is insufficient, say that briefly.
- Keep the answer concise and practical.
- This is a one-off side question, so answer directly instead of starting a back-and-forth.`;

function entryToMessage(entry: SessionEntry): AgentMessage | undefined {
	if (entry.type === "message") {
		return entry.message;
	}
	if (entry.type === "compaction") {
		return {
			role: "compactionSummary",
			summary: entry.summary,
			tokensBefore: entry.tokensBefore,
			timestamp: new Date(entry.timestamp).getTime(),
		};
	}
	return undefined;
}

function getConversationMessages(branch: SessionEntry[]): AgentMessage[] {
	let compactionIndex = -1;
	for (let i = branch.length - 1; i >= 0; i--) {
		if (branch[i].type === "compaction") {
			compactionIndex = i;
			break;
		}
	}

	if (compactionIndex < 0) {
		return branch.map(entryToMessage).filter((message): message is AgentMessage => message !== undefined);
	}

	const compaction = branch[compactionIndex];
	const firstKeptIndex =
		compaction.type === "compaction" ? branch.findIndex((entry) => entry.id === compaction.firstKeptEntryId) : -1;
	const compactedBranch = [
		compaction,
		...(firstKeptIndex >= 0 ? branch.slice(firstKeptIndex, compactionIndex) : []),
		...branch.slice(compactionIndex + 1),
	];
	return compactedBranch.map(entryToMessage).filter((message): message is AgentMessage => message !== undefined);
}

async function getQuestion(args: string, ctx: ExtensionCommandContext): Promise<string | undefined> {
	const trimmed = args.trim();
	if (trimmed) {
		return trimmed;
	}
	if (!ctx.hasUI) {
		return undefined;
	}
	const value = await ctx.ui.input("Side question", "Ask something about the current session...");
	return value?.trim() || undefined;
}

async function showAnswer(question: string, answer: string, ctx: ExtensionCommandContext): Promise<void> {
	if (!ctx.hasUI) {
		ctx.ui.notify(answer, "info");
		return;
	}

	await ctx.ui.custom<void>((_tui, theme, _kb, done) => {
		const container = new Container();
		const border = new DynamicBorder((s: string) => theme.fg("accent", s));
		const mdTheme = getMarkdownTheme();

		container.addChild(border);
		container.addChild(new Text(theme.fg("accent", theme.bold("BTW")), 1, 0));
		container.addChild(new Text(theme.fg("dim", `Q: ${question}`), 1, 0));
		container.addChild(new Spacer(1));
		container.addChild(new Markdown(answer, 1, 0, mdTheme));
		container.addChild(new Spacer(1));
		container.addChild(new Text(theme.fg("dim", "Space, Enter, or Esc to close"), 1, 0));
		container.addChild(border);

		return {
			render: (width: number) => container.render(width),
			invalidate: () => container.invalidate(),
			handleInput: (data: string) => {
				if (
					matchesKey(data, "space") ||
					matchesKey(data, "enter") ||
					matchesKey(data, "return") ||
					matchesKey(data, "escape") ||
					matchesKey(data, "ctrl+c")
				) {
					done(undefined);
				}
			},
		};
	}, {
		overlay: true,
		overlayOptions: { anchor: "center", width: "70%", minWidth: 56, maxHeight: "80%" },
	});
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("btw", {
		description: "Ask an ephemeral side question without adding to the conversation",
		handler: async (args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("/btw requires interactive mode", "error");
				return;
			}

			if (!ctx.model) {
				ctx.ui.notify("No model selected", "error");
				return;
			}

			const question = await getQuestion(args, ctx);
			if (!question) {
				ctx.ui.notify(BTW_USAGE, "warning");
				return;
			}

			const messages = convertToLlm(getConversationMessages(ctx.sessionManager.getBranch()));
			let errorMessage: string | undefined;

			const answer = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
				const loader = new BorderedLoader(tui, theme, `Answering side question...`);
				loader.onAbort = () => done(null);

				const doAnswer = async () => {
					const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model!);
					if (!auth.ok || !auth.apiKey) {
						throw new Error(auth.ok ? `No API key for ${ctx.model!.provider}` : auth.error);
					}

					const sideQuestion: Message = {
						role: "user",
						content: [
							{
								type: "text",
								text: `[SIDE QUESTION]\n${question}\n\nAnswer using only the current conversation context. No tool use is available.`,
							},
						],
						timestamp: Date.now(),
					};

					const response = await complete(
						ctx.model!,
						{
							systemPrompt: `${ctx.getSystemPrompt()}\n\n[SIDE QUESTION MODE]\n${SIDE_QUESTION_SYSTEM_PROMPT}`,
							messages: [...messages, sideQuestion],
						},
						{ apiKey: auth.apiKey, headers: auth.headers, signal: loader.signal },
					);

					if (response.stopReason === "aborted") {
						return null;
					}

					return (
						response.content
							.filter((c): c is { type: "text"; text: string } => c.type === "text")
							.map((c) => c.text)
							.join("\n")
							.trim() || "I couldn't find an answer in the current conversation context."
					);
				};

				doAnswer()
					.then(done)
					.catch((error) => {
						errorMessage = error instanceof Error ? error.message : String(error);
						console.error("btw failed:", error);
						done(null);
					});

				return loader;
			}, {
				overlay: true,
				overlayOptions: { anchor: "center", width: 52, maxHeight: 7 },
			});

			if (answer === null) {
				ctx.ui.notify(errorMessage ? `btw failed: ${errorMessage}` : "Cancelled", errorMessage ? "error" : "info");
				return;
			}

			await showAnswer(question, answer, ctx);
		},
	});
}
