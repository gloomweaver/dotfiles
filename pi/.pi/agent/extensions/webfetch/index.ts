import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { Text } from "@mariozechner/pi-tui";
import TurndownService from "turndown";
import { load } from "cheerio";

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_TIMEOUT = 30 * 1000; // 30 seconds
const MAX_TIMEOUT = 120 * 1000; // 2 minutes

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "webfetch",
    label: "Web Fetch",
    description: `Fetches content from a specified URL
- Takes a URL and optional format as input
- Fetches the URL content, converts to requested format (markdown by default)
- Returns the content in the specified format
- Use this tool when you need to retrieve and analyze web content

Usage notes:
  - IMPORTANT: if another tool is present that offers better web fetching capabilities, is more targeted to the task, or has fewer restrictions, prefer using that tool instead of this one.
  - The URL must be a fully-formed valid URL
  - HTTP URLs will be automatically upgraded to HTTPS
  - Format options: "markdown" (default), "text", or "html"
  - This tool is read-only and does not modify any files
  - Results may be summarized if the content is very large`,
    parameters: Type.Object({
      url: Type.String({ description: "The URL to fetch content from" }),
      format: Type.Optional(
        StringEnum(["text", "markdown", "html"], {
          description:
            "The format to return the content in (text, markdown, or html). Defaults to markdown.",
          default: "markdown",
        }),
      ),
      timeout: Type.Optional(
        Type.Number({ description: "Optional timeout in seconds (max 120)" }),
      ),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // Validate URL
      let url = params.url;
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        throw new Error("URL must start with http:// or https://");
      }
      if (url.startsWith("http://")) {
        url = url.replace("http://", "https://");
      }

      // Try to convert GitHub blob URLs to raw content
      try {
        const u = new URL(url);
        if (u.hostname === "github.com") {
          const parts = u.pathname.split('/');
          // Expected: /, user, repo, blob, ref, ...path
          if (parts.length >= 5 && parts[3] === "blob") {
            u.hostname = "raw.githubusercontent.com";
            // Remove 'blob'
            parts.splice(3, 1);
            u.pathname = parts.join('/');
            url = u.toString();
          }
        }
      } catch (e) {
        // Ignore invalid URL errors here, they will be caught later
      }

      const timeoutMs = Math.min(
        params.timeout ? params.timeout * 1000 : DEFAULT_TIMEOUT,
        MAX_TIMEOUT,
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // Combine signals if parent signal exists
      if (signal) {
        signal.addEventListener("abort", () => controller.abort());
      }

      try {
        const format = params.format || "markdown";

        // Build Accept header based on requested format
        let acceptHeader = "*/*";
        switch (format) {
          case "markdown":
            acceptHeader =
              "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1";
            break;
          case "text":
            acceptHeader =
              "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1";
            break;
          case "html":
            acceptHeader =
              "text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1";
            break;
          default:
            acceptHeader =
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8";
        }

        const headers: Record<string, string> = {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
          Accept: acceptHeader,
          "Accept-Language": "en-US,en;q=0.9",
        };

        let response: Response | null = null;
        let finalUrl = url;

        // If markdown/text requested, try variants first
        if (format === "markdown" || format === "text") {
          const variants = [`${url}.md`, `${url}.txt`];

          for (const variant of variants) {
            try {
              // Try fetching variant
              const variantResponse = await fetch(variant, {
                method: "GET",
                signal: controller.signal,
                headers,
              });

              if (variantResponse.ok) {
                const ct = variantResponse.headers.get("content-type") || "";
                // Use if it looks like markdown or text
                if (
                  ct.includes("text/markdown") ||
                  ct.includes("text/plain") ||
                  ct.includes("text/x-markdown")
                ) {
                  response = variantResponse;
                  finalUrl = variant;
                  break;
                }
              }
            } catch (e) {
              // Ignore variant fetch errors, proceed to next or original
            }
          }
        }

        if (!response) {
          response = await fetch(url, { signal: controller.signal, headers });
        }

        // Retry with honest UA if blocked by Cloudflare bot detection
        if (
          response.status === 403 &&
          response.headers.get("cf-mitigated") === "challenge"
        ) {
          response = await fetch(finalUrl, {
            signal: controller.signal,
            headers: { ...headers, "User-Agent": "opencode" },
          });
        }

        if (!response.ok) {
          throw new Error(
            `Request failed with status code: ${response.status}`,
          );
        }

        // Check content length
        const contentLength = response.headers.get("content-length");
        if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
          throw new Error("Response too large (exceeds 5MB limit)");
        }

        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_RESPONSE_SIZE) {
          throw new Error("Response too large (exceeds 5MB limit)");
        }

        const contentType = response.headers.get("content-type") || "";
        const mime = contentType.split(";")[0]?.trim().toLowerCase() || "";
        const title = `${finalUrl} (${contentType})`;

        // Check if response is an image
        const isImage =
          mime.startsWith("image/") &&
          mime !== "image/svg+xml" &&
          mime !== "image/vnd.fastbidsheet";

        if (isImage) {
          const base64Content = Buffer.from(arrayBuffer).toString("base64");
          return {
            content: [
              { type: "text", text: "Image fetched successfully" },
              {
                type: "image",
                source: {
                  type: "base64",
                  mediaType: mime,
                  data: base64Content,
                },
              },
            ],
            details: {
              title,
              mime,
            },
          };
        }

        const content = new TextDecoder().decode(arrayBuffer);

        // Handle content based on requested format
        let outputContent = content;

        if (format === "markdown") {
          if (contentType.includes("text/html")) {
            outputContent = convertHTMLToMarkdown(content);
          }
        } else if (format === "text") {
          if (contentType.includes("text/html")) {
            outputContent = extractTextFromHTML(content);
          }
        }

        return {
          content: [{ type: "text", text: outputContent }],
          details: {
            title,
            url: finalUrl,
            contentType
          },
        };

      } catch (error: any) {
        if (error.name === "AbortError") {
          throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("webfetch "));
      if (args.url) {
        const display =
          args.url.length > 50 ? args.url.substring(0, 47) + "..." : args.url;
        text += theme.fg("muted", `"${display}"`);
      }
      if (args.format)
        text += " " + theme.fg("dim", `(format: ${args.format})`);
      return new Text(text, 0, 0);
    },
    renderResult(result, { expanded, isPartial }, theme) {
      if (isPartial) {
        return new Text(theme.fg("warning", "Fetching..."), 0, 0);
      }
      if (result.isError) {
        const errorMsg =
          result.content?.[0]?.type === "text"
            ? result.content[0].text
            : "Unknown error";
        return new Text(theme.fg("error", `Failed: ${errorMsg}`), 0, 0);
      }

      const title = result.details?.title || "Content fetched";
      const sourceUrl = result.details?.url ? ` (${result.details.url})` : "";
      return new Text(theme.fg("success", `✓ ${title}${sourceUrl}`), 0, 0);
    },
  });
}

function extractTextFromHTML(html: string): string {
  const $ = load(html);

  // Remove script, style, and other non-content elements
  $("script, style, noscript, iframe, object, embed").remove();

  // Get text content
  return $.text().trim();
}

function convertHTMLToMarkdown(html: string): string {
  // @ts-ignore
  const turndownService = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  });
  turndownService.remove(["script", "style", "meta", "link"]);
  return turndownService.turndown(html);
}
