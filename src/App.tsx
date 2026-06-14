import React, { useState, useEffect } from "react";
import {
  LogIn, RefreshCw, Hash, Layers,
  X, Search, Plus, MessageSquare, Heart,
  Home, FolderOpen, Send, Filter
} from "lucide-react";
import { Board, MastodonPost, MastodonUserSession } from "./types";
import { DEFAULT_BOARDS } from "./config/boards";
import { fetchHashtagFeed, postStatus } from "./lib/mastodon-api";
import { initiateLogin, completePkceLogin, getRedirectUri, loadSession, clearSession } from "./lib/mastodon-auth";
import PostDetailsModal from "./components/PostDetailsModal";

function relativeTime(dateStr: string): string {
  try {
    const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
    const sec = Math.floor(diff / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    if (sec < 60) return "just now";
    if (min < 60) return `${min}m`;
    if (hr < 24) return `${hr}h`;
    return `${day}d`;
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function App() {
  const [activeBoardId, setActiveBoardId] = useState(DEFAULT_BOARDS[0]?.id ?? "");
  const [feedData, setFeedData] = useState<Record<string, { posts: MastodonPost[]; loading: boolean; error: string | null }>>({});

  const [selectedPost, setSelectedPost] = useState<MastodonPost | null>(null);

  const [userSession, setUserSession] = useState<MastodonUserSession | null>(null);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [instanceInput, setInstanceInput] = useState("mastodon.social");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [initiatingLogin, setInitiatingLogin] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const [activeTag, setActiveTag] = useState("all");
  const [sortBy, setSortBy] = useState<"latest" | "likes" | "replies" | "boosts">("latest");
  const [searchQuery, setSearchQuery] = useState("");

  const [showNewTopicModal, setShowNewTopicModal] = useState(false);
  const [newTopicTag, setNewTopicTag] = useState("");
  const [newTopicContent, setNewTopicContent] = useState("");
  const [submittingNewTopic, setSubmittingNewTopic] = useState(false);
  const [newTopicError, setNewTopicError] = useState<string | null>(null);
  const [newTopicSuccess, setNewTopicSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Restore session
    const session = loadSession();
    if (session) setUserSession(session);

    // Handle OAuth PKCE callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    if (code && state) {
      setOauthLoading(true);
      completePkceLogin(code, state, getRedirectUri())
        .then((s) => {
          setUserSession(s);
          setShowLoginDialog(false);
        })
        .catch((err) => {
          console.error("OAuth callback error:", err);
          setLoginError(err?.message || "Sign in failed. Please try again.");
          setShowLoginDialog(true);
        })
        .finally(() => {
          setOauthLoading(false);
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    }
  }, []);

  useEffect(() => {
    if (!activeBoardId) return;
    const board = DEFAULT_BOARDS.find((b) => b.id === activeBoardId);
    if (!board) return;

    setActiveTag("all");
    setSearchQuery("");

    const initial: typeof feedData = {};
    board.subboards.forEach((sub) => {
      initial[sub.id] = { posts: [], loading: true, error: null };
    });
    setFeedData(initial);
    board.subboards.forEach((sub) => loadSubboardFeed(sub.id, sub.tag));
  }, [activeBoardId, userSession]);

  const loadSubboardFeed = async (subboardId: string, tag: string) => {
    setFeedData((prev) => ({
      ...prev,
      [subboardId]: { ...prev[subboardId], loading: true, error: null },
    }));
    try {
      const instance = userSession?.instance || "mastodon.social";
      const { posts } = await fetchHashtagFeed(tag, instance, userSession?.token);
      setFeedData((prev) => ({
        ...prev,
        [subboardId]: { posts, loading: false, error: null },
      }));
    } catch {
      setFeedData((prev) => ({
        ...prev,
        [subboardId]: { posts: [], loading: false, error: "Failed to load feed." },
      }));
    }
  };

  const getPostTitle = (html: string) => {
    const text = stripHtml(html);
    if (!text) return "Untitled Discussion";
    const words = text.split(" ");
    return words.length > 9 ? words.slice(0, 9).join(" ") + "…" : text;
  };

  const getUnifiedPosts = () => {
    if (!activeBoard) return [];
    const seen = new Set<string>();
    const all: (MastodonPost & { associatedSubboard: Board["subboards"][0] })[] = [];

    activeBoard.subboards.forEach((sub) => {
      const state = feedData[sub.id];
      if (!state?.posts) return;
      state.posts.forEach((post) => {
        if (!seen.has(post.id)) {
          seen.add(post.id);
          all.push({ ...post, associatedSubboard: sub });
        }
      });
    });

    let filtered =
      activeTag !== "all"
        ? all.filter((p) => p.associatedSubboard.tag.toLowerCase() === activeTag.toLowerCase())
        : all;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((p) => {
        const text = stripHtml(p.content).toLowerCase();
        return (
          text.includes(q) ||
          (p.account?.display_name || "").toLowerCase().includes(q) ||
          (p.account?.username || "").toLowerCase().includes(q)
        );
      });
    }

    return filtered.sort((a, b) => {
      if (sortBy === "likes") return (b.favourites_count || 0) - (a.favourites_count || 0);
      if (sortBy === "replies") return (b.replies_count || 0) - (a.replies_count || 0);
      if (sortBy === "boosts") return (b.reblogs_count || 0) - (a.reblogs_count || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userSession) { setShowLoginDialog(true); return; }
    if (!newTopicContent.trim()) { setNewTopicError("Topic content cannot be empty."); return; }

    setSubmittingNewTopic(true);
    setNewTopicError(null);
    setNewTopicSuccess(null);
    try {
      let text = newTopicContent;
      if (newTopicTag && !text.toLowerCase().includes(`#${newTopicTag.toLowerCase()}`)) {
        text += `\n\n#${newTopicTag}`;
      }
      await postStatus(text, userSession.instance, userSession.token);
      setNewTopicSuccess("Topic published to Mastodon!");
      setNewTopicContent("");
      setTimeout(() => {
        setShowNewTopicModal(false);
        setNewTopicSuccess(null);
        if (activeBoard) activeBoard.subboards.forEach((sub) => loadSubboardFeed(sub.id, sub.tag));
      }, 1500);
    } catch (err: any) {
      setNewTopicError(err.message || "Failed to publish topic.");
    } finally {
      setSubmittingNewTopic(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instanceInput.trim()) return;
    setLoginError(null);
    setInitiatingLogin(true);
    try {
      await initiateLogin(instanceInput, getRedirectUri());
      // page redirects — nothing runs after this
    } catch (err: any) {
      setLoginError(err.message || "Unexpected error.");
      setInitiatingLogin(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setUserSession(null);
  };

  const activeBoard = DEFAULT_BOARDS.find((b) => b.id === activeBoardId);

  if (oauthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <RefreshCw className="w-7 h-7 animate-spin mx-auto" style={{ color: "#0088cc" }} />
          <p className="text-slate-600 font-medium text-sm">Completing sign in…</p>
        </div>
      </div>
    );
  }

  const unifiedPosts = getUnifiedPosts();
  const isAnyLoading = activeBoard?.subboards.some((s) => feedData[s.id]?.loading) ?? false;

  return (
    <div className="min-h-screen bg-[#f2f2f2] text-[#222] flex flex-col font-sans antialiased overflow-x-hidden" style={{ WebkitFontSmoothing: "antialiased" }}>

      {/* Header */}
      <header
        className="bg-white flex items-center justify-between px-5 sticky top-0 z-40 flex-shrink-0"
        style={{ borderBottom: "1px solid #e9e9e9", height: "60px" }}
      >
        <div className="flex items-center gap-2.5">
          <Layers className="w-5 h-5 flex-shrink-0" style={{ color: "#0088cc" }} />
          <div>
            <h1 className="text-sm font-bold text-[#222] leading-none flex items-center gap-2">
              Mastodon Forum
              <span
                className="text-[10px] px-1.5 py-0.5 font-mono font-bold border leading-none"
                style={{ color: "#0088cc", backgroundColor: "#e8f4fc", borderColor: "#b3d9ee", borderRadius: "4px" }}
              >
                Federated
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 leading-none">Aggregated Mastodon hashtag discussions</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeBoard && (
            <button
              onClick={() => activeBoard.subboards.forEach((sub) => loadSubboardFeed(sub.id, sub.tag))}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-[#222] bg-white hover:bg-slate-50 border border-slate-200 transition-colors"
              style={{ borderRadius: "4px" }}
              title="Refresh feeds"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Refresh</span>
            </button>
          )}

          {userSession ? (
            <div className="flex items-center gap-2 border-l pl-3 ml-1" style={{ borderColor: "#e9e9e9" }}>
              <img
                src={userSession.avatar}
                alt={userSession.username}
                referrerPolicy="no-referrer"
                className="w-7 h-7 object-cover border border-slate-200"
                style={{ borderRadius: "4px" }}
              />
              <div className="hidden md:block">
                <p className="text-xs font-bold leading-none text-[#222]">{userSession.displayName}</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5 leading-none">{userSession.instance}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-colors"
                style={{ borderRadius: "4px" }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setLoginError(null); setShowLoginDialog(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-white transition-colors"
              style={{ backgroundColor: "#0088cc", borderRadius: "4px" }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#006fa3")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#0088cc")}
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign in
            </button>
          )}

        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col lg:flex-row w-full max-w-[1400px] mx-auto">

        {/* Sidebar */}
        <aside
          className="w-full bg-white flex-shrink-0 p-4 flex flex-col gap-5"
          style={{
            borderBottom: "1px solid #e9e9e9",
            width: undefined,
          }}
          id="forum-sidebar"
        >
          <style>{`@media (min-width: 1024px) { #forum-sidebar { width: 17em; border-bottom: none; border-right: 1px solid #e9e9e9; min-height: calc(100vh - 60px); } }`}</style>

          {/* Categories */}
          <div>
            <div
              className="flex items-center gap-1.5 text-slate-500 uppercase font-semibold tracking-wide mb-2"
              style={{ fontSize: "0.7579rem", letterSpacing: "0.05em" }}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Categories
            </div>
            <div className="space-y-0.5">
              {DEFAULT_BOARDS.map((b) => {
                const isActive = b.id === activeBoardId;
                return (
                  <button
                    key={b.id}
                    onClick={() => setActiveBoardId(b.id)}
                    className={`w-full text-left flex items-center gap-2 px-2 text-sm transition-colors ${
                      isActive ? "font-bold" : "text-slate-600 hover:text-[#222] hover:bg-slate-50"
                    }`}
                    style={{
                      borderRadius: "4px",
                      height: "2.2em",
                      backgroundColor: isActive ? "#e8f4fc" : undefined,
                      color: isActive ? "#0088cc" : undefined,
                    }}
                  >
                    <span
                      className="w-2 h-2 flex-shrink-0 rounded-sm"
                      style={{ backgroundColor: "#0088cc" }}
                    />
                    <span className="truncate">{b.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hashtag filter */}
          {activeBoard && (
            <div>
              <div
                className="flex items-center gap-1.5 text-slate-500 uppercase font-semibold tracking-wide mb-2"
                style={{ fontSize: "0.7579rem", letterSpacing: "0.05em" }}
              >
                <Filter className="w-3.5 h-3.5" />
                Filter by Hashtag
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveTag("all")}
                  className={`w-full text-left flex items-center gap-2 px-2 text-sm transition-colors ${
                    activeTag === "all" ? "font-bold" : "text-slate-600 hover:text-[#222] hover:bg-slate-50"
                  }`}
                  style={{
                    borderRadius: "4px",
                    height: "2.2em",
                    backgroundColor: activeTag === "all" ? "#e8f4fc" : undefined,
                    color: activeTag === "all" ? "#0088cc" : undefined,
                  }}
                >
                  <Home className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                  <span>All Topics</span>
                </button>
                {activeBoard.subboards.map((sub) => {
                  const isSelected = activeTag.toLowerCase() === sub.tag.toLowerCase();
                  return (
                    <button
                      key={sub.id}
                      onClick={() => setActiveTag(sub.tag)}
                      className={`w-full text-left flex items-center gap-2 px-2 text-sm transition-colors ${
                        isSelected ? "font-bold" : "text-slate-600 hover:text-[#222] hover:bg-slate-50"
                      }`}
                      style={{
                        borderRadius: "4px",
                        height: "2.2em",
                        backgroundColor: isSelected ? "#e8f4fc" : undefined,
                        color: isSelected ? "#0088cc" : undefined,
                      }}
                    >
                      <Hash className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                      <span className="truncate">{sub.title}</span>
                      <span className="ml-auto font-mono text-slate-400" style={{ fontSize: "0.8em" }}>
                        #{sub.tag}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sidebar footer */}
          <div className="mt-auto pt-4" style={{ borderTop: "1px solid #e9e9e9" }}>
            <div className="px-2 space-y-1">
              <p className="text-slate-400 uppercase font-semibold" style={{ fontSize: "0.7579rem", letterSpacing: "0.05em" }}>Status</p>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-slate-700 font-medium">Aggregator Active</span>
              </div>
              <p className="text-slate-500" style={{ fontSize: "0.8em" }}>
                Sourcing from {userSession ? userSession.instance : "mastodon.social"}
              </p>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4 min-w-0">
          {selectedPost ? (
            <PostDetailsModal
              post={selectedPost}
              boardInstance={userSession ? userSession.instance : "mastodon.social"}
              userSession={userSession}
              onClose={() => setSelectedPost(null)}
              onLoginClick={() => setShowLoginDialog(true)}
            />
          ) : activeBoard ? (
            <div className="bg-white border" style={{ borderColor: "#e9e9e9", borderRadius: "4px", overflow: "hidden" }}>

              {/* Category header */}
              <div
                className="px-5 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                style={{ borderBottom: "1px solid #e9e9e9" }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: "#0088cc" }}
                    />
                    {activeTag !== "all" && (
                      <span
                        className="text-xs font-bold font-mono uppercase"
                        style={{ color: "#0088cc" }}
                      >
                        #{activeTag}
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-[#222] leading-tight">{activeBoard.title}</h2>
                  <p className="text-sm text-slate-500 mt-1">{activeBoard.description}</p>
                </div>
                <button
                  onClick={() => {
                    if (!userSession) { setShowLoginDialog(true); return; }
                    setNewTopicTag(activeBoard.subboards[0]?.tag || "");
                    setShowNewTopicModal(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white flex-shrink-0 transition-colors"
                  style={{ backgroundColor: "#0088cc", borderRadius: "4px" }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#006fa3")}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#0088cc")}
                >
                  <Plus className="w-4 h-4" />
                  New Topic
                </button>
              </div>

              {/* Sort tabs + search */}
              <div
                className="flex items-center px-2 overflow-x-auto"
                style={{ borderBottom: "1px solid #e9e9e9" }}
              >
                {(["Latest", "Top Liked", "Most Replied", "Most Boosted"] as const).map((label, i) => {
                  const vals = ["latest", "likes", "replies", "boosts"] as const;
                  const val = vals[i];
                  return (
                    <button
                      key={val}
                      onClick={() => setSortBy(val)}
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                        sortBy === val
                          ? "border-[#0088cc] text-[#0088cc]"
                          : "border-transparent text-slate-500 hover:text-[#222] hover:border-slate-300"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                <div className="flex-1" />
                <div className="relative py-2 pr-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search topics…"
                    className="pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-200 focus:outline-none"
                    style={{
                      borderRadius: "4px",
                      minWidth: "160px",
                      transition: "border-color 0.15s",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#0088cc")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Topic table */}
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ borderBottom: "3px solid #e9e9e9" }}>
                    <th
                      className="text-left px-4 py-3 text-slate-500 font-semibold uppercase tracking-wide bg-white"
                      style={{ fontSize: "0.8em" }}
                    >
                      Topic
                    </th>
                    <th
                      className="hidden lg:table-cell px-2 py-3 text-center text-slate-500 font-semibold uppercase tracking-wide bg-white"
                      style={{ fontSize: "0.8em", width: "146px" }}
                    >
                      Posters
                    </th>
                    <th
                      className="hidden md:table-cell px-2 py-3 text-center text-slate-500 font-semibold uppercase tracking-wide bg-white"
                      style={{ fontSize: "0.8em", width: "4.3em" }}
                    >
                      Replies
                    </th>
                    <th
                      className="hidden md:table-cell px-2 py-3 text-center text-slate-500 font-semibold uppercase tracking-wide bg-white"
                      style={{ fontSize: "0.8em", width: "4.3em" }}
                    >
                      Likes
                    </th>
                    <th
                      className="hidden md:table-cell px-2 py-3 text-right text-slate-500 font-semibold uppercase tracking-wide bg-white"
                      style={{ fontSize: "0.8em", width: "4.5em" }}
                    >
                      Activity
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isAnyLoading ? (
                    <>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #e9e9e9" }}>
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-3 animate-pulse">
                              <div className="w-9 h-9 bg-slate-200 flex-shrink-0" style={{ borderRadius: "4px" }} />
                              <div className="flex-1 space-y-2 pt-0.5">
                                <div className="h-4 bg-slate-200 rounded w-2/3" />
                                <div className="h-3 bg-slate-200 rounded w-1/2" />
                              </div>
                            </div>
                          </td>
                          <td className="hidden lg:table-cell px-2 py-3">
                            <div className="w-6 h-6 bg-slate-200 rounded mx-auto animate-pulse" />
                          </td>
                          <td className="hidden md:table-cell px-2 py-3">
                            <div className="h-4 w-5 bg-slate-200 rounded mx-auto animate-pulse" />
                          </td>
                          <td className="hidden md:table-cell px-2 py-3">
                            <div className="h-4 w-5 bg-slate-200 rounded mx-auto animate-pulse" />
                          </td>
                          <td className="hidden md:table-cell px-2 py-3">
                            <div className="h-3 w-8 bg-slate-200 rounded ml-auto animate-pulse" />
                          </td>
                        </tr>
                      ))}
                    </>
                  ) : unifiedPosts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-16 text-center">
                        <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="font-bold text-[#222] mb-1">No topics found</p>
                        <p className="text-sm text-slate-500 mb-4">
                          No active discussions found for these hashtags. Start the first one!
                        </p>
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => activeBoard.subboards.forEach((sub) => loadSubboardFeed(sub.id, sub.tag))}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#222] border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                            style={{ borderRadius: "4px" }}
                          >
                            Refresh
                          </button>
                          <button
                            onClick={() => {
                              if (!userSession) { setShowLoginDialog(true); return; }
                              setNewTopicTag(activeBoard.subboards[0]?.tag || "");
                              setShowNewTopicModal(true);
                            }}
                            className="px-4 py-2 text-sm font-bold text-white transition-colors"
                            style={{ backgroundColor: "#0088cc", borderRadius: "4px" }}
                          >
                            Post First Topic
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    unifiedPosts.map((post) => (
                      <tr
                        key={post.id}
                        onClick={() => setSelectedPost(post)}
                        className="cursor-pointer transition-colors hover:bg-slate-50 group"
                        style={{ borderBottom: "1px solid #e9e9e9" }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <a
                              href={post.account?.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex-shrink-0"
                            >
                              <img
                                src={post.account?.avatar}
                                alt={post.account?.username}
                                referrerPolicy="no-referrer"
                                className="w-9 h-9 object-cover border border-slate-200"
                                style={{ borderRadius: "4px" }}
                              />
                            </a>
                            <div className="min-w-0 flex-1">
                              <h4
                                className="font-semibold text-[#222] group-hover:text-[#0088cc] transition-colors leading-snug line-clamp-1"
                                style={{ fontSize: "1.05em" }}
                              >
                                {getPostTitle(post.content)}
                              </h4>
                              <p
                                className="text-slate-500 line-clamp-1 mt-0.5"
                                style={{ fontSize: "0.8706em" }}
                              >
                                {stripHtml(post.content)}
                              </p>
                              {/* Mobile meta */}
                              <div
                                className="flex md:hidden items-center gap-3 mt-1.5 flex-wrap"
                                style={{ fontSize: "0.8em" }}
                              >
                                <span className="inline-flex items-center gap-1 text-slate-500">
                                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#0088cc", display: "inline-block" }} />
                                  #{post.associatedSubboard.tag}
                                </span>
                                <span className="text-slate-400 font-mono">@{post.account?.username}</span>
                                <div className="flex items-center gap-2 text-slate-400 ml-auto font-mono">
                                  <span className="flex items-center gap-0.5">
                                    <MessageSquare className="w-3 h-3" /> {post.replies_count}
                                  </span>
                                  <span className="flex items-center gap-0.5">
                                    <Heart className="w-3 h-3 text-rose-400" /> {post.favourites_count}
                                  </span>
                                  <span>{relativeTime(post.created_at)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden lg:table-cell px-2 py-3" style={{ width: "146px" }}>
                          <img
                            src={post.account?.avatar}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-6 h-6 object-cover border border-slate-200 mx-auto"
                            style={{ borderRadius: "4px" }}
                          />
                        </td>
                        <td className="hidden md:table-cell px-2 py-3 text-center" style={{ width: "4.3em" }}>
                          <span
                            className="font-medium"
                            style={{
                              fontSize: "0.9em",
                              color: post.replies_count > 0 ? "#0088cc" : "#999",
                            }}
                          >
                            {post.replies_count}
                          </span>
                        </td>
                        <td className="hidden md:table-cell px-2 py-3 text-center" style={{ width: "4.3em" }}>
                          <span className="font-medium text-slate-600" style={{ fontSize: "0.9em" }}>
                            {post.favourites_count}
                          </span>
                        </td>
                        <td className="hidden md:table-cell px-2 py-3 text-right" style={{ width: "4.5em" }}>
                          <span className="font-mono text-slate-400" style={{ fontSize: "0.8706em" }}>
                            {relativeTime(post.created_at)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white border text-center py-16 px-6" style={{ borderColor: "#e9e9e9", borderRadius: "4px" }}>
              <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-[#222] mb-1">No boards loaded</h3>
              <p className="text-sm text-slate-500 mb-4">
                Define boards with hashtags to start aggregating Mastodon discussions.
              </p>
              </div>
          )}
        </main>
      </div>

      {/* Login dialog */}
      {showLoginDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div
            className="bg-white w-full max-w-md shadow-2xl"
            style={{ borderRadius: "4px", border: "1px solid #e9e9e9" }}
          >
            <div className="flex justify-between items-start px-5 py-4" style={{ borderBottom: "1px solid #e9e9e9" }}>
              <div>
                <h3 className="text-base font-bold text-[#222]">Sign in with Mastodon</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Mastodon is decentralized. Enter your instance domain (e.g. mastodon.social).
                </p>
              </div>
              <button
                onClick={() => setShowLoginDialog(false)}
                className="text-slate-400 hover:text-slate-700 p-1 ml-4 flex-shrink-0"
                style={{ borderRadius: "4px" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loginError && (
              <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm" style={{ borderRadius: "4px" }}>
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Instance Domain
                </label>
                <input
                  type="text"
                  required
                  value={instanceInput}
                  onChange={(e) => setInstanceInput(e.target.value)}
                  placeholder="mastodon.social"
                  className="w-full text-sm border border-slate-200 px-3 py-2 focus:outline-none"
                  style={{ borderRadius: "4px" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#0088cc")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                  disabled={initiatingLogin}
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowLoginDialog(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#222] border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                  style={{ borderRadius: "4px" }}
                  disabled={initiatingLogin}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={initiatingLogin || !instanceInput.trim()}
                  className="px-4 py-2 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ backgroundColor: "#0088cc", borderRadius: "4px" }}
                >
                  {initiatingLogin ? "Connecting…" : "Connect & Sign In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New topic modal */}
      {showNewTopicModal && activeBoard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div
            className="bg-white w-full max-w-lg shadow-2xl"
            style={{ borderRadius: "4px", border: "1px solid #e9e9e9" }}
          >
            <div className="flex justify-between items-start px-5 py-4" style={{ borderBottom: "1px solid #e9e9e9" }}>
              <div>
                <h3 className="text-base font-bold text-[#222] flex items-center gap-2">
                  <Plus className="w-4 h-4" style={{ color: "#0088cc" }} />
                  Start New Topic
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Your post will be published on Mastodon and appear here immediately.
                </p>
              </div>
              <button
                onClick={() => setShowNewTopicModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 ml-4 flex-shrink-0"
                style={{ borderRadius: "4px" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {newTopicError && (
              <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm" style={{ borderRadius: "4px" }}>
                {newTopicError}
              </div>
            )}
            {newTopicSuccess && (
              <div className="mx-5 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm" style={{ borderRadius: "4px" }}>
                {newTopicSuccess}
              </div>
            )}

            <form onSubmit={handleCreateTopic} className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                  Default Hashtag
                </label>
                <div className="flex flex-wrap gap-2">
                  {activeBoard.subboards.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setNewTopicTag(sub.tag)}
                      className="px-3 py-1.5 text-xs font-bold border transition-colors"
                      style={{
                        borderRadius: "4px",
                        backgroundColor: newTopicTag.toLowerCase() === sub.tag.toLowerCase() ? "#e8f4fc" : "#f8f8f8",
                        color: newTopicTag.toLowerCase() === sub.tag.toLowerCase() ? "#0088cc" : "#555",
                        borderColor: newTopicTag.toLowerCase() === sub.tag.toLowerCase() ? "#b3d9ee" : "#ddd",
                      }}
                    >
                      #{sub.tag} ({sub.title})
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Your Message
                </label>
                <textarea
                  required
                  rows={5}
                  value={newTopicContent}
                  onChange={(e) => setNewTopicContent(e.target.value)}
                  placeholder="Write your forum post here…"
                  className="w-full text-sm border border-slate-200 px-3 py-2 resize-none focus:outline-none leading-relaxed"
                  style={{ borderRadius: "4px" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#0088cc")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                  disabled={submittingNewTopic}
                />
                {newTopicTag && (
                  <p className="text-xs text-slate-500 mt-1">
                    Hashtag <strong>#{newTopicTag}</strong> will be appended automatically.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewTopicModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#222] border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                  style={{ borderRadius: "4px" }}
                  disabled={submittingNewTopic}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNewTopic || !newTopicContent.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ backgroundColor: "#0088cc", borderRadius: "4px" }}
                >
                  {submittingNewTopic ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Publishing…
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Publish Topic
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
