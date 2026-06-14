import { MastodonPost } from "../types";

export function cleanInstanceDomain(instance: string): string {
  let domain = instance.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, "");
  domain = domain.replace(/\/$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    throw new Error("Invalid Mastodon instance URL. Example: mastodon.social");
  }
  return domain;
}

export async function fetchHashtagFeed(
  hashtag: string,
  instance: string,
  token?: string
): Promise<{ posts: MastodonPost[]; feedInstance: string }> {
  const domain = cleanInstanceDomain(instance);
  const url = `https://${domain}/api/v1/timelines/tag/${encodeURIComponent(hashtag)}?limit=10`;
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
  const url = `https://${domain}/api/v1/statuses/${encodeURIComponent(postId)}/context`;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Context API returned status ${res.status}`);
  return res.json();
}

export async function postStatus(
  statusText: string,
  userInstance: string,
  userToken: string
): Promise<MastodonPost> {
  const domain = cleanInstanceDomain(userInstance);
  const res = await fetch(`https://${domain}/api/v1/statuses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${userToken}`,
    },
    body: JSON.stringify({ status: statusText }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function postReply(
  originalPostUrl: string,
  replyText: string,
  userInstance: string,
  userToken: string,
  fallbackPostId: string
): Promise<MastodonPost> {
  const domain = cleanInstanceDomain(userInstance);
  let targetPostId = fallbackPostId;

  if (originalPostUrl) {
    try {
      const searchUrl = `https://${domain}/api/v2/search?q=${encodeURIComponent(originalPostUrl)}&type=statuses&resolve=true`;
      const searchRes = await fetch(searchUrl, {
        headers: { "Authorization": `Bearer ${userToken}` },
      });
      if (searchRes.ok) {
        const data = await searchRes.json() as any;
        if (data.statuses?.length > 0) targetPostId = data.statuses[0].id;
      }
    } catch {
      // fall through to fallbackPostId
    }
  }

  if (!targetPostId) {
    throw new Error("The original post could not be resolved on your instance.");
  }

  const res = await fetch(`https://${domain}/api/v1/statuses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${userToken}`,
    },
    body: JSON.stringify({ status: replyText, in_reply_to_id: targetPostId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
