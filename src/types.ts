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
  type: 'image' | 'video' | 'gifv' | 'unknown';
  url: string;
  preview_url: string;
  description?: string;
}

export interface MastodonPost {
  id: string;
  created_at: string;
  in_reply_to_id?: string | null;
  in_reply_to_account_id?: string | null;
  sensitive: boolean;
  spoiler_text: string;
  visibility: string;
  language: string;
  uri: string;
  url: string;
  replies_count: number;
  reblogs_count: number;
  favourites_count: number;
  favourited?: boolean;
  reblogged?: boolean;
  muted?: boolean;
  bookmarked?: boolean;
  content: string; // HTML Content
  account: MastodonAccount;
  media_attachments: MastodonMedia[];
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
