import axios from "axios";
import * as cheerio from "cheerio";
import type { TopRepo } from "./types.js";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function fetchTopicHtml(topicUrl: string): Promise<string> {
  const res = await axios.get<string>(topicUrl, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html,application/xhtml+xml",
    },
    responseType: "text",
    validateStatus: (s) => s >= 200 && s < 400,
  });
  if (res.status >= 400) {
    throw new Error(`GitHub returned HTTP ${res.status}`);
  }
  return res.data;
}

const REPO_HREF = /^\/([^/]+)\/([^/]+)\/?$/;

/**
 * Parses repository cards from a GitHub topic HTML page (first page only).
 * Cards are `article` elements with the standard topic listing classes.
 */
export function parseRepositories(html: string): TopRepo[] {
  const $ = cheerio.load(html);
  const out: TopRepo[] = [];

  $("article.border.rounded.color-shadow-small").each((_, el) => {
    const root = $(el);
    const h3 = root.find("h3").first();
    const links = h3.find('a[href^="/"]');
    if (links.length < 2) {
      return;
    }
    const repoHref = $(links[1]).attr("href")?.trim() ?? "";
    const m = repoHref.match(REPO_HREF);
    if (!m) {
      return;
    }
    const owner = m[1];
    const name = m[2];
    const fullName = `${owner}/${name}`.toLowerCase();

    const desc = root.find("p.color-fg-muted.mb-0").first().text().trim();
    const updatedAtIso = root.find("relative-time").first().attr("datetime") ?? null;
    const language =
      root.find('[itemprop="programmingLanguage"]').first().text().trim() || null;
    const topics = root
      .find("a.topic-tag")
      .map((__, a) => $(a).text().trim())
      .get()
      .filter(Boolean);

    out.push({
      fullName,
      owner,
      name,
      url: `https://github.com${repoHref.startsWith("/") ? repoHref : `/${repoHref}`}`,
      description: desc.length > 0 ? desc : null,
      updatedAtIso,
      language,
      topics,
    });
  });

  return out;
}
