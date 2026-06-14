import React, { useState, useEffect, useMemo } from "react";
import {
  MessageSquare, Repeat2, Heart, ExternalLink, Send, LogIn,
  CornerDownRight, RotateCw, CornerUpLeft, ChevronDown, ChevronRight,
  Link, Bookmark, EyeOff, Eye, AlertCircle, Globe, Lock, BarChart2,
  Pencil,
} from "lucide-react";
import { MastodonPost, MastodonUserSession, Poll } from "../types";
import {
  fetchPostContext, postReply,
  favouriteStatus, unfavouriteStatus,
  reblogStatus, unreblogStatus,
  bookmarkStatus, unbookmarkStatus,
} from "../lib/mastodon-api";
import { sanitizeHtml } from "../lib/sanitize";

interface PostDetailsModalProps {
  post: MastodonPost;
  boardInstance: string;
  userSession: MastodonUserSession | null;
  onClose: () => void;
  onLoginClick: () => void;
}

interface ThreadNode {
  post: MastodonPost;
  children: ThreadNode[];
  depth: number;
}

function buildThreadTree(flatReplies: MastodonPost[], originalPostId: string): ThreadNode[] {
  const nodeMap = new Map<string, ThreadNode>();
  flatReplies.forEach((r) => nodeMap.set(r.id, { post: r, children: [], depth: 0 }));
  const roots: ThreadNode[] = [];
  flatReplies.forEach((r) => {
    const cur = nodeMap.get(r.id)!;
    const pid = r.in_reply_to_id;
    if (pid && pid !== originalPostId && nodeMap.has(pid)) nodeMap.get(pid)!.children.push(cur);
    else roots.push(cur);
  });
  const assignDepth = (nodes: ThreadNode[], d: number) => {
    nodes.forEach((n) => {
      n.depth = d;
      n.children.sort((a, b) => new Date(a.post.created_at).getTime() - new Date(b.post.created_at).getTime());
      assignDepth(n.children, d + 1);
    });
  };
  roots.sort((a, b) => new Date(a.post.created_at).getTime() - new Date(b.post.created_at).getTime());
  assignDepth(roots, 0);
  return roots;
}

function relativeTime(d: string) {
  try {
    const diff = Math.max(0, Date.now() - new Date(d).getTime());
    const sec = Math.floor(diff / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    if (sec < 60) return "just now";
    if (min < 60) return `${min}m ago`;
    if (hr < 24) return `${hr}h ago`;
    return `${day}d ago`;
  } catch { return ""; }
}

function VisibilityBadge({ v }: { v: MastodonPost["visibility"] }) {
  const map: Record<string, { icon: React.ReactNode; label: string }> = {
    public: { icon: <Globe className="w-3 h-3" />, label: "Public" },
    unlisted: { icon: <EyeOff className="w-3 h-3" />, label: "Unlisted" },
    private: { icon: <Lock className="w-3 h-3" />, label: "Followers only" },
    direct: { icon: <MessageSquare className="w-3 h-3" />, label: "Direct" },
  };
  const { icon, label } = map[v] ?? map.public;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400" title={label}>
      {icon} {label}
    </span>
  );
}

function PollDisplay({ poll }: { poll: Poll }) {
  const total = poll.votes_count || 1;
  const expiresAt = poll.expires_at ? new Date(poll.expires_at) : null;
  const isExpired = poll.expired || (expiresAt ? expiresAt < new Date() : false);

  return (
    <div className="space-y-2 p-3 border border-slate-200 bg-[#f8f8f8]" style={{ borderRadius: "4px" }}>
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
        <BarChart2 className="w-3.5 h-3.5" />
        {isExpired ? "Poll closed" : "Poll"}
      </div>
      {poll.options.map((opt, i) => {
        const pct = poll.votes_count ? Math.round(((opt.votes_count ?? 0) / total) * 100) : 0;
        const isVoted = poll.own_votes?.includes(i);
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className={`font-medium ${isVoted ? "text-[#0088cc]" : "text-[#222]"}`}>{opt.title}</span>
              <span className="text-xs font-mono text-slate-500 ml-2 flex-shrink-0">{pct}%</span>
            </div>
            <div className="h-2 bg-slate-200 overflow-hidden" style={{ borderRadius: "2px" }}>
              <div
                className="h-full transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor: isVoted ? "#0088cc" : "#bbb",
                }}
              />
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono pt-1">
        <span>{poll.votes_count} vote{poll.votes_count !== 1 ? "s" : ""}</span>
        {poll.multiple && <span>Multiple choice</span>}
        {expiresAt && !isExpired && <span>Closes {relativeTime(poll.expires_at!)}</span>}
        {isExpired && <span>Poll closed</span>}
        {!isExpired && !poll.voted && (
          <a
            href="#"
            className="ml-auto"
            style={{ color: "#0088cc" }}
            onClick={(e) => e.preventDefault()}
            title="Vote on Mastodon"
          >
            Vote on Mastodon ↗
          </a>
        )}
      </div>
    </div>
  );
}

function LinkCard({ card }: { card: NonNullable<MastodonPost["card"]> }) {
  if (!card.title) return null;
  return (
    <a
      href={card.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 border border-slate-200 hover:border-slate-300 bg-[#f8f8f8] hover:bg-white transition overflow-hidden"
      style={{ borderRadius: "4px" }}
    >
      {card.image && (
        <img
          src={card.image}
          alt=""
          referrerPolicy="no-referrer"
          className="w-24 object-cover flex-shrink-0 bg-slate-200"
          style={{ maxHeight: "100px" }}
        />
      )}
      <div className="flex-1 min-w-0 p-3">
        <p className="text-sm font-bold text-[#222] line-clamp-2 leading-snug">{card.title}</p>
        {card.description && (
          <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-snug">{card.description}</p>
        )}
        <p className="text-[10px] text-slate-400 font-mono mt-1.5 truncate">
          {card.provider_name || (() => { try { return new URL(card.url).hostname; } catch { return card.url; } })()}
        </p>
      </div>
    </a>
  );
}

function ReplyThreadNode({
  node, onReplyClick, onScrollToParent, collapsedIds, onToggleCollapse, flatRepliesMap, boardInstance,
}: {
  key?: React.Key;
  node: ThreadNode;
  onReplyClick: (p: MastodonPost) => void;
  onScrollToParent: (id: string) => void;
  collapsedIds: Record<string, boolean>;
  onToggleCollapse: (id: string) => void;
  flatRepliesMap: Record<string, MastodonPost>;
  boardInstance: string;
}) {
  const isCollapsed = !!collapsedIds[node.post.id];
  const hasChildren = node.children.length > 0;
  const parentPost = node.post.in_reply_to_id ? flatRepliesMap[node.post.in_reply_to_id] : null;
  const [cwRevealed, setCwRevealed] = useState(false);
  const [sensitiveRevealed, setSensitiveRevealed] = useState(false);
  const hasCw = !!node.post.spoiler_text;

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
    catch { return d; }
  };
  const getFullAcct = (acct: string) => acct.includes("@") ? `@${acct}` : `@${acct}@${boardInstance}`;

  return (
    <div className="relative space-y-2 mt-3 select-none">
      <div className="flex gap-2.5">
        {node.depth > 0 && (
          <div className="flex flex-shrink-0">
            {Array.from({ length: Math.min(node.depth, 5) }).map((_, i) => (
              <div
                key={i}
                className="w-4 md:w-5 flex justify-center cursor-pointer group/line"
                onClick={() => onToggleCollapse(node.post.id)}
              >
                <div
                  className="w-[1.5px] h-full group-hover/line:w-[2px] transition-all"
                  style={{ backgroundColor: "#e9e9e9" }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#0088cc")}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#e9e9e9")}
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {isCollapsed ? (
            <div
              onClick={() => onToggleCollapse(node.post.id)}
              className="bg-[#f8f8f8] border border-slate-200 hover:bg-slate-100/50 p-2.5 text-xs flex items-center justify-between cursor-pointer transition"
              style={{ borderRadius: "4px" }}
            >
              <div className="flex items-center gap-2">
                <img src={node.post.account.avatar} alt="" referrerPolicy="no-referrer" className="w-5 h-5 object-cover border border-slate-200" style={{ borderRadius: "4px" }} />
                <span className="font-bold text-slate-700">{node.post.account.display_name || node.post.account.username}</span>
                <span className="text-[10px] text-slate-400">{formatDate(node.post.created_at)}</span>
                <span className="bg-slate-100 border border-slate-200 text-slate-500 font-mono text-[9px] px-1.5 py-0.5" style={{ borderRadius: "4px" }}>collapsed</span>
              </div>
              <div className="flex items-center gap-1 font-bold text-xs" style={{ color: "#0088cc" }}>
                <ChevronRight className="w-3.5 h-3.5" />
                {hasChildren ? `Expand (${node.children.length})` : "Expand"}
              </div>
            </div>
          ) : (
            <div
              id={`reply-${node.post.id}`}
              className="bg-[#f8f8f8] p-4 border border-slate-200 transition hover:bg-slate-100/30"
              style={{ borderRadius: "4px" }}
            >
              <div className="flex gap-2.5 w-full">
                <img
                  src={node.post.account.avatar}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 object-cover border border-slate-200 bg-white flex-shrink-0"
                  style={{ borderRadius: "4px" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
                      <span className="font-bold text-[#222] text-sm">{node.post.account.display_name || node.post.account.username}</span>
                      <span className="text-[11px] text-slate-400 font-mono truncate max-w-[140px]">{getFullAcct(node.post.account.acct)}</span>
                      {parentPost && (
                        <button
                          onClick={() => onScrollToParent(parentPost.id)}
                          className="inline-flex items-center gap-0.5 text-[10px] font-bold border py-0.5 px-1.5 transition"
                          style={{ color: "#0088cc", backgroundColor: "#e8f4fc", borderColor: "#b3d9ee", borderRadius: "4px" }}
                        >
                          <CornerUpLeft className="w-2.5 h-2.5" />
                          @{parentPost.account.username}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
                      <span className="text-[10px] text-slate-400 font-mono">{formatDate(node.post.created_at)}</span>
                      {node.post.edited_at && <Pencil className="w-2.5 h-2.5 text-slate-300" title="Edited" />}
                      <button onClick={() => onToggleCollapse(node.post.id)} className="text-slate-400 hover:text-slate-600 p-0.5 hover:bg-slate-200/50" style={{ borderRadius: "4px" }}>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {hasCw && (
                    <div
                      className="flex items-center justify-between px-2.5 py-1.5 border border-amber-200 bg-amber-50 mb-2 cursor-pointer"
                      style={{ borderRadius: "4px" }}
                      onClick={() => setCwRevealed((v) => !v)}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                        <AlertCircle className="w-3 h-3" />
                        {node.post.spoiler_text}
                      </div>
                      <span className="text-[10px] font-bold text-amber-600 ml-2">{cwRevealed ? "Hide" : "Show"}</span>
                    </div>
                  )}

                  {(!hasCw || cwRevealed) && (
                    <div
                      className="text-sm text-slate-700 leading-relaxed mt-1 space-y-2 break-words font-medium mastodon-html-content"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(node.post.content) }}
                    />
                  )}

                  {(!hasCw || cwRevealed) && node.post.media_attachments?.length > 0 && (
                    <div
                      className="grid grid-cols-2 gap-1 overflow-hidden mt-2 border border-slate-200 relative"
                      style={{ borderRadius: "4px" }}
                    >
                      {node.post.media_attachments.map((m) => (
                        <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={m.preview_url || m.url}
                            alt="Attachment"
                            referrerPolicy="no-referrer"
                            className="w-full h-24 object-cover bg-slate-100"
                            style={{ filter: node.post.sensitive && !sensitiveRevealed ? "blur(12px)" : "none" }}
                          />
                        </a>
                      ))}
                      {node.post.sensitive && !sensitiveRevealed && (
                        <button
                          className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/20"
                          onClick={(e) => { e.stopPropagation(); setSensitiveRevealed(true); }}
                        >
                          <EyeOff className="w-4 h-4 text-white drop-shadow" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-2.5 pt-2 text-[10.5px] font-bold text-slate-400" style={{ borderTop: "1px solid #e9e9e9" }}>
                    <button onClick={() => onReplyClick(node.post)} className="flex items-center gap-1 transition font-bold" style={{ color: "#0088cc" }}>
                      <CornerDownRight className="w-3.5 h-3.5" /> Reply
                    </button>
                    <span className="text-slate-200">|</span>
                    <span className="flex items-center gap-0.5"><Heart className="w-3 h-3 text-rose-400" /> {node.post.favourites_count}</span>
                    <span className="flex items-center gap-0.5"><Repeat2 className="w-3 h-3 text-slate-400" /> {node.post.reblogs_count}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isCollapsed && hasChildren && (
            <div className="space-y-1">
              {node.children.map((child) => (
                <ReplyThreadNode
                  key={child.post.id}
                  node={child}
                  onReplyClick={onReplyClick}
                  onScrollToParent={onScrollToParent}
                  collapsedIds={collapsedIds}
                  onToggleCollapse={onToggleCollapse}
                  flatRepliesMap={flatRepliesMap}
                  boardInstance={boardInstance}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PostDetailsModal({ post, boardInstance, userSession, onClose, onLoginClick }: PostDetailsModalProps) {
  const displayPost = post.reblog ?? post;
  const booster = post.reblog ? post.account : null;

  const [replies, setReplies] = useState<MastodonPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});
  const [replyToPost, setReplyToPost] = useState<MastodonPost | null>(null);
  const [copied, setCopied] = useState(false);

  // CW + sensitive state for original post
  const [cwRevealed, setCwRevealed] = useState(false);
  const [sensitiveRevealed, setSensitiveRevealed] = useState(false);
  const hasCw = !!displayPost.spoiler_text;

  // Interaction state
  const [favd, setFavd] = useState(displayPost.favourited ?? false);
  const [favCount, setFavCount] = useState(displayPost.favourites_count);
  const [rebd, setRebd] = useState(displayPost.reblogged ?? false);
  const [rebCount, setRebCount] = useState(displayPost.reblogs_count);
  const [bookd, setBookd] = useState(displayPost.bookmarked ?? false);
  const [interacting, setInteracting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reset interaction state when post changes
  useEffect(() => {
    setFavd(displayPost.favourited ?? false);
    setFavCount(displayPost.favourites_count);
    setRebd(displayPost.reblogged ?? false);
    setRebCount(displayPost.reblogs_count);
    setBookd(displayPost.bookmarked ?? false);
    setCwRevealed(false);
    setSensitiveRevealed(false);
  }, [post.id]);

  const loadReplies = async () => {
    setLoading(true);
    setError(null);
    try {
      const instance = userSession?.instance || boardInstance;
      const ctx = await fetchPostContext(displayPost.id, instance, userSession?.token);
      setReplies(ctx.descendants || []);
    } catch (err: any) {
      setError(err.message || "Failed to load replies.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReplies();
    setReplyToPost(null);
    const handle = displayPost.account.acct.includes("@") ? `@${displayPost.account.acct}` : `@${displayPost.account.acct}@${boardInstance}`;
    setReplyText(`${handle} `);
  }, [post, boardInstance, userSession]);

  const threadTree = useMemo(() => buildThreadTree(replies, displayPost.id), [replies, displayPost.id]);

  useEffect(() => {
    const collapsed: Record<string, boolean> = {};
    const walk = (nodes: ThreadNode[]) => {
      nodes.forEach((n) => {
        if (n.depth > 0) collapsed[n.post.id] = true;
        walk(n.children);
      });
    };
    walk(threadTree);
    setCollapsedIds(collapsed);
  }, [threadTree]);

  const flatRepliesMap = useMemo(() => {
    const m: Record<string, MastodonPost> = {};
    replies.forEach((r) => { m[r.id] = r; });
    return m;
  }, [replies]);

  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userSession || !replyText.trim()) return;
    setSubmittingReply(true);
    setError(null);
    setSuccessMsg("");
    const target = replyToPost || displayPost;
    try {
      await postReply(target.url, replyText, userSession.instance, userSession.token, target.id);
      setSuccessMsg("Reply published!");
      setReplyToPost(null);
      const h = displayPost.account.acct.includes("@") ? `@${displayPost.account.acct}` : `@${displayPost.account.acct}@${boardInstance}`;
      setReplyText(`${h} `);
      setTimeout(() => { loadReplies(); setSuccessMsg(""); }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to publish reply.");
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleStartReplyToNode = (target: MastodonPost) => {
    setReplyToPost(target);
    const h = target.account.acct.includes("@") ? `@${target.account.acct}` : `@${target.account.acct}@${boardInstance}`;
    setReplyText((prev) => {
      const cleaned = prev.replace(/^@[a-zA-Z0-9_.-]+(@[a-zA-Z0-9_.-]+)?\s+/, "");
      return `${h} ${cleaned}`;
    });
    setTimeout(() => {
      const el = document.getElementById("reply-textarea");
      if (el) { el.focus(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
    }, 50);
  };

  const handleScrollToParent = (parentId: string) => {
    const el = document.getElementById(`reply-${parentId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.outline = "2px solid #0088cc";
      setTimeout(() => { el.style.outline = ""; }, 2000);
    }
  };

  const handleToggleCollapse = (id: string) => setCollapsedIds((p) => ({ ...p, [id]: !p[id] }));

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const interact = async (action: string) => {
    if (!userSession || interacting) return;
    setInteracting(action);
    setActionError(null);
    const { url, id } = displayPost;
    const { instance, token } = userSession;
    try {
      if (action === "favourite") {
        const res = await (favd ? unfavouriteStatus : favouriteStatus)(url, id, instance, token);
        setFavd(res.favourited ?? !favd);
        setFavCount(res.favourites_count);
      } else if (action === "reblog") {
        const res = await (rebd ? unreblogStatus : reblogStatus)(url, id, instance, token);
        setRebd(!rebd);
        setRebCount(res.reblogs_count ?? (rebd ? rebCount - 1 : rebCount + 1));
      } else if (action === "bookmark") {
        const res = await (bookd ? unbookmarkStatus : bookmarkStatus)(url, id, instance, token);
        setBookd(res.bookmarked ?? !bookd);
      }
    } catch (err: any) {
      setActionError(err.message || `${action} failed`);
      setTimeout(() => setActionError(null), 3000);
    } finally {
      setInteracting(null);
    }
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleString("en-US", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch { return d; }
  };

  return (
    <div className="bg-white w-full border flex flex-col shadow-sm overflow-hidden" style={{ borderColor: "#e9e9e9", borderRadius: "4px" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#f8f8f8]" style={{ borderBottom: "1px solid #e9e9e9" }}>
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
          style={{ borderRadius: "4px" }}
        >
          <CornerUpLeft className="w-3.5 h-3.5" style={{ color: "#0088cc" }} /> Back to list
        </button>
        <div className="flex items-center gap-2">
          {post.associatedSubboard && (
            <span className="border px-2 py-0.5 uppercase font-mono text-xs font-bold" style={{ color: "#0088cc", backgroundColor: "#e8f4fc", borderColor: "#b3d9ee", borderRadius: "4px" }}>
              #{post.associatedSubboard.tag}
            </span>
          )}
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border transition"
            style={{ borderRadius: "4px", backgroundColor: copied ? "#e8f4fc" : "#fff", borderColor: copied ? "#b3d9ee" : "#e2e2e2", color: copied ? "#0088cc" : "#666" }}
          >
            <Link className="w-3.5 h-3.5" />
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-5">

        {/* Original post card */}
        <div className="bg-[#f8f8f8] border p-5 space-y-4" style={{ borderColor: "#e9e9e9", borderRadius: "4px" }}>

          {/* Boost header */}
          {booster && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 pb-3" style={{ borderBottom: "1px solid #e9e9e9" }}>
              <Repeat2 className="w-3.5 h-3.5 flex-shrink-0" />
              <img src={booster.avatar} alt="" referrerPolicy="no-referrer" className="w-5 h-5 object-cover border border-slate-200" style={{ borderRadius: "4px" }} />
              <span><strong>{booster.display_name || booster.username}</strong> boosted</span>
            </div>
          )}

          {/* Author */}
          <div className="flex items-center gap-3">
            <a href={displayPost.account.url} target="_blank" rel="noopener noreferrer">
              <img src={displayPost.account.avatar} alt="" referrerPolicy="no-referrer" className="w-11 h-11 object-cover border border-slate-200 bg-white" style={{ borderRadius: "4px" }} />
            </a>
            <div>
              <a
                href={displayPost.account.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[15px] text-[#222] block"
                onMouseOver={(e) => (e.currentTarget.style.color = "#0088cc")}
                onMouseOut={(e) => (e.currentTarget.style.color = "#222")}
              >
                {displayPost.account.display_name || displayPost.account.username}
              </a>
              <span className="text-xs text-slate-500 font-mono">
                {displayPost.account.acct.includes("@") ? `@${displayPost.account.acct}` : `@${displayPost.account.acct}@${boardInstance}`}
              </span>
            </div>
          </div>

          {/* Content warning */}
          {hasCw && (
            <div
              className="flex items-center justify-between px-3 py-2.5 border border-amber-200 bg-amber-50 cursor-pointer"
              style={{ borderRadius: "4px" }}
              onClick={() => setCwRevealed((v) => !v)}
            >
              <div className="flex items-center gap-2 text-sm font-bold text-amber-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {displayPost.spoiler_text}
              </div>
              <button className="text-xs font-bold text-amber-600 ml-3 flex-shrink-0 hover:underline">
                {cwRevealed ? "Hide content" : "Show content"}
              </button>
            </div>
          )}

          {/* Post body */}
          {(!hasCw || cwRevealed) && (
            <>
              <div
                className="text-[15px] text-[#222] leading-relaxed mastodon-html-content space-y-3 font-medium"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayPost.content) }}
              />

              {/* Media */}
              {displayPost.media_attachments?.length > 0 && (
                <div
                  className="grid gap-2 overflow-hidden border border-slate-200 relative"
                  style={{
                    borderRadius: "4px",
                    gridTemplateColumns: displayPost.media_attachments.length > 1 ? "1fr 1fr" : "1fr",
                  }}
                >
                  {displayPost.media_attachments.map((m) => (
                    <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="block relative group" onClick={(e) => { if (displayPost.sensitive && !sensitiveRevealed) { e.preventDefault(); setSensitiveRevealed(true); } }}>
                      <img
                        src={m.url}
                        alt={m.description || "Attachment"}
                        referrerPolicy="no-referrer"
                        className="w-full object-cover bg-slate-100"
                        style={{ maxHeight: "320px", filter: displayPost.sensitive && !sensitiveRevealed ? "blur(20px)" : "none" }}
                      />
                      {!displayPost.sensitive || sensitiveRevealed ? (
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-sm gap-1.5 font-bold">
                          View original <ExternalLink className="w-4 h-4" />
                        </div>
                      ) : null}
                    </a>
                  ))}
                  {displayPost.sensitive && !sensitiveRevealed && (
                    <button
                      className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                      onClick={() => setSensitiveRevealed(true)}
                    >
                      <EyeOff className="w-6 h-6 text-white drop-shadow-lg" />
                      <span className="text-sm font-bold text-white drop-shadow-lg">Sensitive content — click to reveal</span>
                    </button>
                  )}
                </div>
              )}

              {/* Poll */}
              {displayPost.poll && <PollDisplay poll={displayPost.poll} />}

              {/* Link card */}
              {displayPost.card && !displayPost.media_attachments?.length && <LinkCard card={displayPost.card} />}
            </>
          )}

          {/* Meta row */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-3" style={{ borderTop: "1px solid #e9e9e9" }}>
            <div className="flex items-center gap-2">
              <span className="font-mono">{formatDate(displayPost.created_at)}</span>
              {displayPost.edited_at && (
                <span className="flex items-center gap-1 text-slate-400" title={`Edited ${formatDate(displayPost.edited_at)}`}>
                  <Pencil className="w-3 h-3" /> edited
                </span>
              )}
              <VisibilityBadge v={displayPost.visibility} />
            </div>
            <a href={displayPost.url} target="_blank" rel="noopener noreferrer" className="font-bold flex items-center gap-1.5 hover:underline" style={{ color: "#0088cc" }}>
              Open on Mastodon <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Interactions */}
          {actionError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2" style={{ borderRadius: "4px" }}>{actionError}</p>
          )}
          <div className="flex items-center gap-4 text-sm font-mono font-bold">
            <button
              onClick={() => interact("favourite")}
              disabled={!userSession || !!interacting}
              className="flex items-center gap-1.5 transition disabled:opacity-50"
              style={{ color: favd ? "#e11d48" : "#888" }}
              title={userSession ? (favd ? "Unlike" : "Like") : "Sign in to like"}
            >
              <Heart className={`w-4.5 h-4.5 ${favd ? "fill-rose-500 text-rose-500" : ""}`} style={{ width: "1.1rem", height: "1.1rem" }} />
              {favCount}
            </button>
            <button
              onClick={() => interact("reblog")}
              disabled={!userSession || !!interacting || displayPost.visibility === "private" || displayPost.visibility === "direct"}
              className="flex items-center gap-1.5 transition disabled:opacity-50"
              style={{ color: rebd ? "#16a34a" : "#888" }}
              title={userSession ? (rebd ? "Unboost" : "Boost") : "Sign in to boost"}
            >
              <Repeat2 className="w-4.5 h-4.5" style={{ width: "1.1rem", height: "1.1rem" }} />
              {rebCount}
            </button>
            <button
              onClick={() => interact("bookmark")}
              disabled={!userSession || !!interacting}
              className="flex items-center gap-1.5 transition disabled:opacity-50"
              style={{ color: bookd ? "#0088cc" : "#888" }}
              title={userSession ? (bookd ? "Remove bookmark" : "Bookmark") : "Sign in to bookmark"}
            >
              <Bookmark className={`w-4.5 h-4.5 ${bookd ? "fill-[#0088cc]" : ""}`} style={{ width: "1.1rem", height: "1.1rem" }} />
            </button>

            {!userSession && (
              <button
                onClick={onLoginClick}
                className="ml-auto text-xs flex items-center gap-1 font-bold"
                style={{ color: "#0088cc" }}
              >
                <LogIn className="w-3.5 h-3.5" /> Sign in to interact
              </button>
            )}
          </div>
        </div>

        {/* Replies section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2" style={{ borderBottom: "1px solid #e9e9e9" }}>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
              Discussion ({replies.length})
            </h4>
            <button onClick={loadReplies} className="text-slate-400 hover:text-slate-700 transition p-1 hover:bg-slate-100" style={{ borderRadius: "9999px" }} title="Refresh">
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse flex gap-3 bg-[#f8f8f8] border border-slate-200 p-4" style={{ borderRadius: "4px" }}>
                  <div className="w-8 h-8 bg-slate-200" style={{ borderRadius: "4px" }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-slate-200 rounded w-1/3" />
                    <div className="h-3 bg-slate-200 rounded w-5/6" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 p-3" style={{ borderRadius: "4px" }}>{error}</p>
          ) : threadTree.length === 0 ? (
            <div className="text-center py-8 bg-[#f8f8f8] border border-dashed border-slate-200" style={{ borderRadius: "4px" }}>
              <p className="text-sm text-slate-500 italic">No replies yet. Be the first!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {threadTree.map((node) => (
                <ReplyThreadNode
                  key={node.post.id}
                  node={node}
                  onReplyClick={handleStartReplyToNode}
                  onScrollToParent={handleScrollToParent}
                  collapsedIds={collapsedIds}
                  onToggleCollapse={handleToggleCollapse}
                  flatRepliesMap={flatRepliesMap}
                  boardInstance={boardInstance}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reply composer */}
      <div className="bg-white p-5" style={{ borderTop: "1px solid #e9e9e9" }}>
        {successMsg && (
          <div className="mb-3 bg-emerald-50 border border-emerald-200 text-emerald-700 p-2.5 text-xs font-bold" style={{ borderRadius: "4px" }}>{successMsg}</div>
        )}

        {userSession ? (
          <form onSubmit={handlePostReply} className="space-y-3">
            {replyToPost && (
              <div className="p-2.5 text-xs flex items-center justify-between" style={{ backgroundColor: "#e8f4fc", border: "1px solid #b3d9ee", borderRadius: "4px", color: "#0088cc" }}>
                <div className="flex items-center gap-1.5 font-bold">
                  <CornerDownRight className="w-3.5 h-3.5" />
                  Replying to <strong className="text-[#222]">{replyToPost.account.display_name || replyToPost.account.username}</strong>
                </div>
                <button type="button" onClick={() => { setReplyToPost(null); const h = displayPost.account.acct.includes("@") ? `@${displayPost.account.acct}` : `@${displayPost.account.acct}@${boardInstance}`; setReplyText(`${h} `); }} className="text-slate-400 hover:text-slate-700 p-0.5" style={{ borderRadius: "4px" }}>
                  ×
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <img src={userSession.avatar} alt="" referrerPolicy="no-referrer" className="w-6 h-6 border border-slate-200" style={{ borderRadius: "4px" }} />
              <span className="text-xs text-slate-500 font-bold">Reply as <strong className="text-[#222]">{userSession.displayName}</strong></span>
              <span className="ml-auto text-[11px] font-mono font-bold px-2 py-0.5 border" style={{ color: "#0088cc", backgroundColor: "#e8f4fc", borderColor: "#b3d9ee", borderRadius: "4px" }}>{userSession.instance}</span>
            </div>
            <div className="relative border border-slate-200 overflow-hidden" style={{ borderRadius: "4px" }}
              onFocusCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#0088cc"; }}
              onBlurCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = ""; }}
            >
              <textarea
                id="reply-textarea"
                rows={3}
                required
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write your reply…"
                className="w-full p-3 text-sm bg-transparent border-none focus:outline-none resize-none text-[#222] placeholder-slate-400 leading-relaxed font-medium"
              />
              <div className="flex justify-between items-center px-3 py-2 bg-slate-50" style={{ borderTop: "1px solid #e9e9e9" }}>
                <span className={`text-[10px] font-mono ${replyText.length > 480 ? "text-red-500 font-bold" : "text-slate-400"}`}>{500 - replyText.length} chars left</span>
                <button type="submit" disabled={submittingReply || !replyText.trim()} className="px-4 py-1.5 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50" style={{ backgroundColor: "#0088cc", borderRadius: "4px" }}>
                  <Send className="w-3.5 h-3.5" /> {submittingReply ? "Sending…" : "Send Reply"}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="text-center py-4 space-y-3">
            <p className="text-sm text-slate-500">Sign in with Mastodon to reply, like, and boost.</p>
            <button type="button" onClick={onLoginClick} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-white text-sm font-bold" style={{ backgroundColor: "#0088cc", borderRadius: "4px" }}>
              <LogIn className="w-3.5 h-3.5" /> Sign in with Mastodon
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
