export interface Subboard {
  id: string;
  title: string;
  tag: string;
}

export interface Board {
  id: string;
  title: string;
  description: string;
  subboards: Subboard[];
}

export interface MastodonAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  locked: boolean;
  bot: boolean;
  created_at: string;
  note: string;
  url: string;
  avatar: string;
  avatar_static: string;
  header: string;
  header_static: string;
  followers_count: number;
  following_count: number;
  statuses_count: number;
}

export interface MastodonMedia {
  id: string;
  type: "image" | "video" | "gifv" | "unknown";
  url: string;
  preview_url: string;
  description?: string;
}

export interface Poll {
  id: string;
  expires_at: string | null;
  expired: boolean;
  multiple: boolean;
  votes_count: number;
  voters_count: number | null;
  options: Array<{ title: string; votes_count: number | null }>;
  voted?: boolean;
  own_votes?: number[];
}

export interface PreviewCard {
  url: string;
  title: string;
  description: string;
  type: "link" | "photo" | "video" | "rich";
  image?: string | null;
  provider_name?: string;
  provider_url?: string;
  author_name?: string;
}

export interface MastodonPost {
  id: string;
  created_at: string;
  in_reply_to_id?: string | null;
  in_reply_to_account_id?: string | null;
  sensitive: boolean;
  spoiler_text: string;
  visibility: "public" | "unlisted" | "private" | "direct";
  language?: string | null;
  uri: string;
  url: string;
  replies_count: number;
  reblogs_count: number;
  favourites_count: number;
  favourited?: boolean;
  reblogged?: boolean;
  muted?: boolean;
  bookmarked?: boolean;
  pinned?: boolean;
  content: string;
  reblog?: MastodonPost | null;
  account: MastodonAccount;
  media_attachments: MastodonMedia[];
  poll?: Poll | null;
  card?: PreviewCard | null;
  edited_at?: string | null;
  tags?: Array<{ name: string; url: string }>;
  mentions?: Array<{ id: string; username: string; url: string; acct: string }>;
  associatedSubboard?: Subboard;
}

export interface MastodonUserSession {
  token: string;
  instance: string;
  username: string;
  displayName: string;
  avatar: string;
  acct: string;
}

export interface PostOptions {
  spoilerText?: string;
  visibility?: "public" | "unlisted" | "private" | "direct";
  sensitive?: boolean;
  poll?: {
    options: string[];
    expires_in: number;
    multiple?: boolean;
    hide_totals?: boolean;
  };
}
