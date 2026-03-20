export type TopRepo = {
  /** Normalized `owner/name` for comparison (lowercase). */
  fullName: string;
  owner: string;
  name: string;
  url: string;
  description: string | null;
  updatedAtIso: string | null;
  language: string | null;
  topics: string[];
  // Extended stats (optional, fetched separately)
  stars?: number;
  forks?: number;
  networkCount?: number;
  subscribers?: number;
  openIssues?: number;
  contributorsCount?: number;
  commitCount?: number;
  createdAt?: string | null;
  pushedAt?: string | null;
  size?: number; // in KB
  license?: string | null;
  homepage?: string | null;
  archived?: boolean;
  fork?: boolean;
  private?: boolean;
  visibility?: string;
  hasIssues?: boolean;
  hasProjects?: boolean;
  hasWiki?: boolean;
  hasPages?: boolean;
  hasDownloads?: boolean;
};
