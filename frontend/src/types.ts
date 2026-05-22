export type Meme = {
  id: string;
  name: string;
  name_en?: string | null;
  description: string;
  origin?: string | null;
  year?: number | null;
  era?: string | null;
  platform: string[];
  context?: string | null;
  visual_features?: string | null;
  tags: string[];
  region?: string | null;
  format: string[];
  source?: string | null;
  nsfw: boolean;
};

export type SnatchResponse = {
  snatch_id: string;
  postcard_code: string;
  meme: Meme;
};

export type RevealResponse = {
  reveal_id: string;
  meme: Meme;
  revealed_ratio: number;
  message: string;
};

export type VoteSyncResponse = {
  source_url: string;
  fetched_rows: number;
  inserted_rows: number;
  total_rows: number;
};
