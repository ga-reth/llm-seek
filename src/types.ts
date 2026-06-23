export interface Job {
  id: string;
  source: string;
  company: string;
  title: string;
  location: string | null;
  isRemote: boolean | null;
  employmentType: string | null;
  publishedAt: Date | null;
  url: string;
  raw: unknown;
}

export interface FilterResult {
  passed: boolean;
  reason?: string;
}
