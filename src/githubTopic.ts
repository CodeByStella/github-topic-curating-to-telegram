import axios from "axios";
import type { TopRepo } from "./types.js";

const API_BASE = "https://api.github.com/search/repositories";
const REPO_API_BASE = "https://api.github.com/repos";
const TIMEOUT_MS = 30_000;

interface RepoSearchItem {
  full_name: string;
  html_url: string;
  description: string | null;
  updated_at: string | null;
  language: string | null;
  topics?: string[];
  owner: { login: string };
}

interface SearchResponse {
  items: RepoSearchItem[];
  total_count: number;
  incomplete_results: boolean;
}

function mapItem(item: RepoSearchItem): TopRepo {
  const fullName = item.full_name.toLowerCase();
  const [owner, name] = item.full_name.split("/");
  return {
    fullName,
    owner: owner ?? item.owner.login,
    name: name ?? item.full_name,
    url: item.html_url,
    description: item.description?.trim() || null,
    updatedAtIso: item.updated_at ?? null,
    language: item.language?.trim() || null,
    topics: Array.isArray(item.topics) ? item.topics : [],
  };
}

/**
 * Fetches repositories tagged with the given topic, sorted by recently updated (GitHub REST Search API).
 */
export async function fetchTopicRepos(
  topicSlug: string,
  token?: string,
): Promise<TopRepo[]> {
  const params = new URLSearchParams({
    q: `topic:${topicSlug}`,
    sort: "updated",
    order: "desc",
    per_page: "30",
    page: "1",
  });
  const url = `${API_BASE}?${params.toString()}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "github-topic-curating-to-telegram",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await axios.get<SearchResponse>(url, {
    headers,
    timeout: TIMEOUT_MS,
    validateStatus: (s) => s === 200 || s === 403 || s === 422 || s === 503,
  });

  if (res.status === 403) {
    throw new Error(
      "GitHub API rate limit or forbidden (consider setting GITHUB_TOKEN)",
    );
  }
  if (res.status === 422) {
    throw new Error("GitHub API validation failed (check topic slug)");
  }
  if (res.status === 503) {
    throw new Error("GitHub API unavailable");
  }
  if (res.status !== 200) {
    throw new Error(`GitHub API returned HTTP ${res.status}`);
  }

  const data = res.data;
  if (!data.items || !Array.isArray(data.items)) {
    return [];
  }
  return data.items.map(mapItem);
}

interface RepoDetails {
  stargazers_count: number;
  forks_count: number;
  network_count: number;
  subscribers_count: number;
  open_issues_count: number;
  default_branch: string;
  created_at: string;
  pushed_at: string | null;
  size: number;
  license: { name: string; spdx_id: string } | null;
  homepage: string | null;
  archived: boolean;
  fork: boolean;
  private: boolean;
  visibility: string;
  has_issues: boolean;
  has_projects: boolean;
  has_wiki: boolean;
  has_pages: boolean;
  has_downloads: boolean;
}

/**
 * Fetches comprehensive repository information from GitHub API.
 */
export async function fetchRepoDetails(
  owner: string,
  repo: string,
  token?: string,
): Promise<{
  stars: number;
  forks: number;
  networkCount: number;
  subscribers: number;
  openIssues: number;
  defaultBranch: string;
  createdAt: string | null;
  pushedAt: string | null;
  size: number;
  license: string | null;
  homepage: string | null;
  archived: boolean;
  fork: boolean;
  private: boolean;
  visibility: string;
  hasIssues: boolean;
  hasProjects: boolean;
  hasWiki: boolean;
  hasPages: boolean;
  hasDownloads: boolean;
}> {
  const url = `${REPO_API_BASE}/${owner}/${repo}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "github-topic-curating-to-telegram",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await axios.get<RepoDetails>(url, {
    headers,
    timeout: TIMEOUT_MS,
    validateStatus: (s) => s === 200 || s === 403 || s === 404,
  });

  if (res.status === 403) {
    throw new Error("GitHub API rate limit or forbidden");
  }
  if (res.status === 404) {
    throw new Error(`Repository ${owner}/${repo} not found`);
  }
  if (res.status !== 200) {
    throw new Error(`GitHub API returned HTTP ${res.status}`);
  }

  const data = res.data;
  return {
    stars: data.stargazers_count ?? 0,
    forks: data.forks_count ?? 0,
    networkCount: data.network_count ?? 0,
    subscribers: data.subscribers_count ?? 0,
    openIssues: data.open_issues_count ?? 0,
    defaultBranch: data.default_branch ?? "main",
    createdAt: data.created_at ?? null,
    pushedAt: data.pushed_at ?? null,
    size: data.size ?? 0,
    license: data.license?.name ?? data.license?.spdx_id ?? null,
    homepage: data.homepage ?? null,
    archived: data.archived ?? false,
    fork: data.fork ?? false,
    private: data.private ?? false,
    visibility: data.visibility ?? "public",
    hasIssues: data.has_issues ?? false,
    hasProjects: data.has_projects ?? false,
    hasWiki: data.has_wiki ?? false,
    hasPages: data.has_pages ?? false,
    hasDownloads: data.has_downloads ?? false,
  };
}

/**
 * Fetches total commit count for a repository's default branch.
 * Uses pagination Link header to determine total commits.
 */
export async function fetchCommitCount(
  owner: string,
  repo: string,
  branch: string,
  token?: string,
): Promise<number> {
  const url = `${REPO_API_BASE}/${owner}/${repo}/commits`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "github-topic-curating-to-telegram",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await axios.get<unknown[]>(url, {
      headers,
      timeout: TIMEOUT_MS,
      params: { sha: branch, per_page: 1, page: 1 },
      validateStatus: (s) => s === 200 || s === 403 || s === 404,
    });

    if (res.status === 403 || res.status === 404) {
      return 0;
    }
    if (res.status !== 200) {
      return 0;
    }

    // Check Link header for pagination info
    const linkHeader = res.headers.link as string | undefined;
    if (linkHeader) {
      // Parse Link header to find last page number
      // Format: <https://api.github.com/...?page=123>; rel="last"
      const lastMatch = linkHeader.match(/[?&]page=(\d+)[^>]*>; rel="last"/);
      if (lastMatch) {
        return Number.parseInt(lastMatch[1], 10);
      }
    }

    // Fallback: if no pagination header, return array length (single page)
    return Array.isArray(res.data) ? res.data.length : 0;
  } catch {
    return 0; // Fail silently, commit count is optional
  }
}

interface ContributorItem {
  login: string;
  contributions: number;
  html_url: string;
}

/**
 * Fetches contributor count for a repository.
 * Returns the number of contributors by parsing pagination Link header.
 */
export async function fetchContributorsCount(
  owner: string,
  repo: string,
  token?: string,
): Promise<number> {
  const url = `${REPO_API_BASE}/${owner}/${repo}/contributors`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "github-topic-curating-to-telegram",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await axios.get<unknown[]>(url, {
      headers,
      timeout: TIMEOUT_MS,
      params: { per_page: 1 },
      validateStatus: (s) => s === 200 || s === 403 || s === 404,
    });

    if (res.status === 403 || res.status === 404) {
      return 0;
    }
    if (res.status !== 200) {
      return 0;
    }

    // Check Link header for pagination info
    const linkHeader = res.headers.link as string | undefined;
    if (linkHeader) {
      // Parse Link header to find last page number
      // Format: <https://api.github.com/...?page=5>; rel="last"
      const lastMatch = linkHeader.match(/[?&]page=(\d+)[^>]*>; rel="last"/);
      if (lastMatch) {
        return Number.parseInt(lastMatch[1], 10);
      }
    }

    // Fallback: if no pagination header, return array length (single page)
    return Array.isArray(res.data) ? res.data.length : 0;
  } catch {
    return 0; // Fail silently, contributors count is optional
  }
}

/**
 * Fetches the list of contributors for a repository.
 * Returns up to 30 contributors (first page) sorted by contributions (descending).
 */
export async function fetchContributors(
  owner: string,
  repo: string,
  token?: string,
): Promise<Array<{ login: string; contributions: number; html_url: string }>> {
  const url = `${REPO_API_BASE}/${owner}/${repo}/contributors`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "github-topic-curating-to-telegram",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await axios.get<ContributorItem[]>(url, {
      headers,
      timeout: TIMEOUT_MS,
      params: { per_page: 30, page: 1 },
      validateStatus: (s) => s === 200 || s === 403 || s === 404,
    });

    if (res.status === 403 || res.status === 404) {
      return [];
    }
    if (res.status !== 200) {
      return [];
    }

    if (!Array.isArray(res.data)) {
      return [];
    }

    // Map to simplified format
    return res.data.map((item) => ({
      login: item.login,
      contributions: item.contributions,
      html_url: item.html_url,
    }));
  } catch {
    return []; // Fail silently, contributors list is optional
  }
}
