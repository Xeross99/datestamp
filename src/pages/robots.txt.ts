// robots.txt: everything may be crawled, search engines and AI crawlers
// alike (the site wants to be found and quoted). The AI crawlers are named
// on purpose, so an "allow all" is not read as an oversight. Like ads.txt,
// crawlers read it only from the domain root, so it counts once the site
// has its own domain.
import type { APIRoute } from "astro"

const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
]

export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "")
  const sitemap = new URL(`${base}/sitemap-index.xml`, site).href
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    ...AI_CRAWLERS.flatMap((agent) => [`User-agent: ${agent}`, "Allow: /", ""]),
    `Sitemap: ${sitemap}`,
    "",
  ].join("\n")
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}
