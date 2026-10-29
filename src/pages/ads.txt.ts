// ads.txt names who may sell this site's ad space; AdSense warns (and pays
// less) without it. Crawlers read it only from the domain root, so it
// counts once the site has its own domain (BASE_PATH "/").
import type { APIRoute } from "astro"
import { adsense } from "../lib/ads"

export const GET: APIRoute = () => {
  const publisher = adsense.client.replace(/^ca-/, "")
  const body = publisher ? `google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n` : ""
  return new Response(body, { headers: { "Content-Type": "text/plain" } })
}
