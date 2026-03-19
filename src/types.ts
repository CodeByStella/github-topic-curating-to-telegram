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
};
