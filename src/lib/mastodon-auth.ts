import { MastodonUserSession } from "../types";
import { cleanInstanceDomain } from "./mastodon-api";

function base64urlEncode(buffer: Uint8Array): string {
  let str = "";
  buffer.forEach((byte) => { str += String.fromCharCode(byte); });
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function generateCodeVerifier(): Promise<string> {
  const array = new Uint8Array(96);
  crypto.getRandomValues(array);
  return base64urlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64urlEncode(new Uint8Array(hash));
}

export function getRedirectUri(): string {
  return window.location.origin + window.location.pathname;
}

export async function registerMastodonApp(
  instance: string,
  redirectUri: string
): Promise<string> {
  const storageKey = `mastodon_client_${instance}`;
  const existing = localStorage.getItem(storageKey);
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (parsed.client_id && parsed.client_secret) return parsed.client_id;
      // missing client_secret (stale entry) — re-register
      localStorage.removeItem(storageKey);
    } catch {
      // corrupt entry — re-register
    }
  }

  const res = await fetch(`https://${instance}/api/v1/apps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Mastodon Forum Feed",
      redirect_uris: redirectUri,
      scopes: "read write",
      website: window.location.origin,
    }),
  });
  if (!res.ok) throw new Error(`App registration failed: ${await res.text()}`);
  const data = await res.json() as any;
  localStorage.setItem(storageKey, JSON.stringify({ client_id: data.client_id, client_secret: data.client_secret }));
  return data.client_id;
}

export async function initiateLogin(
  rawInstance: string,
  redirectUri: string
): Promise<void> {
  const instance = cleanInstanceDomain(rawInstance);
  const clientId = await registerMastodonApp(instance, redirectUri);

  const verifier = await generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  const stateArray = new Uint8Array(32);
  crypto.getRandomValues(stateArray);
  const state = base64urlEncode(stateArray);

  sessionStorage.setItem("mastodon_pkce_verifier", verifier);
  sessionStorage.setItem("mastodon_pkce_instance", instance);
  sessionStorage.setItem("mastodon_pkce_state", state);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "read write",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  window.location.href = `https://${instance}/oauth/authorize?${params}`;
}

export async function completePkceLogin(
  code: string,
  state: string,
  redirectUri: string
): Promise<MastodonUserSession> {
  const storedState = sessionStorage.getItem("mastodon_pkce_state");
  const verifier = sessionStorage.getItem("mastodon_pkce_verifier");
  const instance = sessionStorage.getItem("mastodon_pkce_instance");

  const clearPkce = () => {
    sessionStorage.removeItem("mastodon_pkce_verifier");
    sessionStorage.removeItem("mastodon_pkce_instance");
    sessionStorage.removeItem("mastodon_pkce_state");
  };

  if (!verifier || !instance || !storedState) { clearPkce(); throw new Error("PKCE session missing. Please try again."); }
  if (state !== storedState) { clearPkce(); throw new Error("OAuth state mismatch. Possible CSRF attack."); }

  const storageKey = `mastodon_client_${instance}`;
  const clientData = localStorage.getItem(storageKey);
  if (!clientData) { clearPkce(); throw new Error(`No client registration found for ${instance}.`); }
  const { client_id, client_secret } = JSON.parse(clientData);

  const tokenRes = await fetch(`https://${instance}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id,
      client_secret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) { clearPkce(); throw new Error(`Token exchange failed: ${await tokenRes.text()}`); }
  const tokenData = await tokenRes.json() as any;
  const accessToken = tokenData.access_token;

  const userRes = await fetch(`https://${instance}/api/v1/accounts/verify_credentials`, {
    headers: { "Authorization": `Bearer ${accessToken}` },
  });
  if (!userRes.ok) { clearPkce(); throw new Error("Failed to fetch user profile."); }
  const user = await userRes.json() as any;

  const session: MastodonUserSession = {
    token: accessToken,
    instance,
    username: user.username,
    displayName: user.display_name || user.username,
    avatar: user.avatar || "",
    acct: user.acct || `${user.username}@${instance}`,
  };

  localStorage.setItem("mastodon_user_session", JSON.stringify(session));
  clearPkce();

  return session;
}

export function loadSession(): MastodonUserSession | null {
  const stored = localStorage.getItem("mastodon_user_session");
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    localStorage.removeItem("mastodon_user_session");
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem("mastodon_user_session");
}
