import { MastodonPost, PostOptions } from "../types";

export function cleanInstanceDomain(instance: string): string {
  let domain = instance.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, "");
  domain = domain.replace(/\/$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    throw new Error("Invalid Mastodon instance URL. Example: mastodon.social");
  }
  return domain;
}

async function resolveStatusId(
  postUrl: string,
  fallbackId: string,
  instance: string,
  token: string
): Promise<string> {
  try {
    const domain = cleanInstanceDomain(instance);
    const res = await fetch(
      `https://${domain}/api/v2/search?q=${encodeURIComponent(postUrl)}&type=statuses&resolve=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) {
      const data = await res.json() as any;
      if (data.statuses?.length > 0) return data.statuses[0].id;
    }
  } catch { /* use fallback */ }
  return fallbackId;
}

async function statusAction(
  action: string,
  postUrl: string,
  fallbackId: string,
  instance: string,
  token: string
): Promise<MastodonPost> {
  const domain = cleanInstanceDomain(instance);
  const id = await resolveStatusId(postUrl, fallbackId, instance, token);
  const res = await fetch(`https://${domain}/api/v1/statuses/${id}/${action}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${action} failed: ${res.status}`);
  return res.json();
}

export const favouriteStatus = (url: string, id: string, instance: string, token: string) =>
  statusAction("favourite", url, id, instance, token);
export const unfavouriteStatus = (url: string, id: string, instance: string, token: string) =>
  statusAction("unfavourite", url, id, instance, token);
export const reblogStatus = (url: string, id: string, instance: string, token: string) =>
  statusAction("reblog", url, id, instance, token);
export const unreblogStatus = (url: string, id: string, instance: string, token: string) =>
  statusAction("unreblog", url, id, instance, token);
export const bookmarkStatus = (url: string, id: string, instance: string, token: string) =>
  statusAction("bookmark", url, id, instance, token);
export const unbookmarkStatus = (url: string, id: string, instance: string, token: string) =>
  statusAction("unbookmark", url, id, instance, token);

export async function fetchStatus(
  postId: string,
  instance: string,
  token?: string
): Promise<MastodonPost> {
  const domain = cleanInstanceDomain(instance);
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`https://${domain}/api/v1/statuses/${encodeURIComponent(postId)}`, { headers });
  if (!res.ok) throw new Error(`Status ${res.status}`);
  return res.json();
}

export async function fetchHashtagFeed(
  hashtag: string,
  instance: string,
  token?: string
): Promise<{ posts: MastodonPost[]; feedInstance: string }> {
  const domain = cleanInstanceDomain(instance);
  const url = `https://${domain}/api/v1/timelines/tag/${encodeURIComponent(hashtag)}?limit=20`;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Mastodon API returned status ${res.status}`);
  const posts = await res.json();
  return { posts: Array.isArray(posts) ? posts : [], feedInstance: domain };
}

export async function fetchPostContext(
  postId: string,
  instance: string,
  token?: string
): Promise<{ ancestors: MastodonPost[]; descendants: MastodonPost[] }> {
  const domain = cleanInstanceDomain(instance);
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`https://${domain}/api/v1/statuses/${encodeURIComponent(postId)}/context`, { headers });
  if (!res.ok) throw new Error(`Context API returned status ${res.status}`);
  return res.json();
}

export async function postStatus(
  statusText: string,
  userInstance: string,
  userToken: string,
  opts?: PostOptions
): Promise<MastodonPost> {
  const domain = cleanInstanceDomain(userInstance);
  const body: Record<string, unknown> = { status: statusText };
  if (opts?.spoilerText) body.spoiler_text = opts.spoilerText;
  if (opts?.visibility) body.visibility = opts.visibility;
  if (opts?.sensitive != null) body.sensitive = opts.sensitive;
  if (opts?.poll) body.poll = opts.poll;
  const res = await fetch(`https://${domain}/api/v1/statuses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${userToken}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function postReply(
  originalPostUrl: string,
  replyText: string,
  userInstance: string,
  userToken: string,
  fallbackPostId: string,
  opts?: PostOptions
): Promise<MastodonPost> {
  const domain = cleanInstanceDomain(userInstance);
  const targetPostId = await resolveStatusId(originalPostUrl, fallbackPostId, userInstance, userToken);

  const body: Record<string, unknown> = { status: replyText, in_reply_to_id: targetPostId };
  if (opts?.spoilerText) body.spoiler_text = opts.spoilerText;
  if (opts?.visibility) body.visibility = opts.visibility;
  if (opts?.sensitive != null) body.sensitive = opts.sensitive;

  const res = await fetch(`https://${domain}/api/v1/statuses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${userToken}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
