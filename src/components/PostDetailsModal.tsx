import React, { useState, useEffect, useMemo } from "react";
import {
  X, MessageSquare, Repeat, Heart, ExternalLink,
  Send, LogIn, CornerDownRight, RotateCw, CornerUpLeft,
  ChevronDown, ChevronRight,
} from "lucide-react";
import { MastodonPost, MastodonUserSession } from "../types";
import { fetchPostContext, postReply } from "../lib/mastodon-api";
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
  flatReplies.forEach((reply) => {
    nodeMap.set(reply.id, { post: reply, children: [], depth: 0 });
  });

  const roots: ThreadNode[] = [];
  flatReplies.forEach((reply) => {
    const current = nodeMap.get(reply.id)!;
    const parentId = reply.in_reply_to_id;
    if (parentId && parentId !== originalPostId && nodeMap.has(parentId)) {
      nodeMap.get(parentId)!.children.push(current);
    } else {
      roots.push(current);
    }
  });

  const assignDepthAndSort = (nodes: ThreadNode[], depth: number) => {
    nodes.forEach((node) => {
      node.depth = depth;
      node.children.sort((a, b) => new Date(a.post.created_at).getTime() - new Date(b.post.created_at).getTime());
      assignDepthAndSort(node.children, depth + 1);
    });
  };

  roots.sort((a, b) => new Date(a.post.created_at).getTime() - new Date(b.post.created_at).getTime());
  assignDepthAndSort(roots, 0);
  return roots;
}

function ReplyThreadNode({
  node,
  onReplyClick,
  onScrollToParent,
  collapsedIds,
  onToggleCollapse,
  flatRepliesMap,
  boardInstance,
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

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch { return d; }
  };

  const getFullAcct = (account: any) =>
    account.acct.includes("@") ? `@${account.acct}` : `@${account.acct}@${boardInstance}`;

  return (
    <div className="relative space-y-2 mt-3 select-none">
      <div className="flex gap-2.5">
        {node.depth > 0 && (
          <div className="flex flex-shrink-0 select-none">
            {Array.from({ length: Math.min(node.depth, 5) }).map((_, idx) => (
              <div
                key={idx}
                className="w-4 md:w-5 flex justify-center group/line cursor-pointer"
                onClick={() => onToggleCollapse(node.post.id)}
                title="Collapse thread"
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
              className="bg-[#f8f8f8] border border-slate-200 hover:bg-slate-100/50 p-2.5 text-xs flex items-center justify-between cursor-pointer text-slate-500 transition"
              style={{ borderRadius: "4px" }}
            >
              <div className="flex items-center gap-2">
                <img
                  src={node.post.account.avatar}
                  alt={node.post.account.username}
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 object-cover bg-white border border-slate-200"
                  style={{ borderRadius: "4px" }}
                />
                <span className="font-bold text-slate-700">{node.post.account.display_name || node.post.account.username}</span>
                <span className="text-[10px] text-slate-400">{formatDate(node.post.created_at)}</span>
                <span className="bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[9px] px-1.5 py-0.5" style={{ borderRadius: "4px" }}>
                  collapsed
                </span>
              </div>
              <div className="flex items-center gap-1 font-bold text-xs" style={{ color: "#0088cc" }}>
                <ChevronRight className="w-3.5 h-3.5" />
                <span>{hasChildren ? `Expand (${node.children.length})` : "Expand"}</span>
              </div>
            </div>
          ) : (
            <div
              id={`reply-${node.post.id}`}
              className="bg-[#f8f8f8] p-4 border border-slate-200 relative transition hover:bg-slate-100/30 group/reply"
              style={{ borderRadius: "4px" }}
            >
              <div className="flex gap-2.5 w-full">
                <img
                  src={node.post.account.avatar}
                  alt={node.post.account.display_name || node.post.account.username}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 object-cover border border-slate-200 bg-white flex-shrink-0"
                  style={{ borderRadius: "4px" }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
                      <span className="font-bold text-[#222] text-sm truncate">
                        {node.post.account.display_name || node.post.account.username}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono truncate max-w-[120px] sm:max-w-[180px]">
                        {getFullAcct(node.post.account)}
                      </span>
                      {parentPost && (
                        <button
                          onClick={() => onScrollToParent(parentPost.id)}
                          className="inline-flex items-center gap-0.5 text-[10px] font-bold border py-0.5 px-1.5 transition select-none flex-shrink-0"
                          style={{ color: "#0088cc", backgroundColor: "#e8f4fc", borderColor: "#b3d9ee", borderRadius: "4px" }}
                          title="Jump to parent comment"
                        >
                          <CornerUpLeft className="w-2.5 h-2.5" />
                          <span>@{parentPost.account.username}</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
                      <span className="text-[10px] text-slate-400 font-mono">{formatDate(node.post.created_at)}</span>
                      <button
                        onClick={() => onToggleCollapse(node.post.id)}
                        className="text-slate-400 hover:text-slate-600 transition p-0.5 hover:bg-slate-200/50 cursor-pointer"
                        style={{ borderRadius: "4px" }}
                        title="Collapse"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div
                    className="text-sm text-slate-700 leading-relaxed mt-1.5 space-y-2 break-words font-medium mastodon-html-content"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(node.post.content) }}
                  />

                  {node.post.media_attachments && node.post.media_attachments.length > 0 && (
                    <div className="grid grid-cols-2 gap-1 overflow-hidden mt-2.5 border border-slate-200" style={{ borderRadius: "4px" }}>
                      {node.post.media_attachments.map((media) => (
                        <a key={media.id} href={media.url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={media.preview_url || media.url}
                            alt="Attachment"
                            referrerPolicy="no-referrer"
                            className="w-full h-24 object-cover bg-slate-100"
                          />
                        </a>
                      ))}
                    </div>
                  )}

                  <div
                    className="flex items-center gap-3.5 mt-3 pt-2.5 text-[10.5px] font-bold text-slate-400 select-none"
                    style={{ borderTop: "1px solid #e9e9e9" }}
                  >
                    <button
                      onClick={() => onReplyClick(node.post)}
                      className="flex items-center gap-1 cursor-pointer transition font-sans font-bold"
                      style={{ color: "#0088cc" }}
                    >
                      <CornerDownRight className="w-3.5 h-3.5" />
                      <span>Reply</span>
                    </button>
                    <span className="text-slate-200">|</span>
                    <span className="flex items-center gap-0.5">
                      <Heart className="w-3 h-3 text-rose-500 flex-shrink-0" /> {node.post.favourites_count}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Repeat className="w-3 h-3 text-slate-400 flex-shrink-0" /> {node.post.reblogs_count}
                    </span>
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

export default function PostDetailsModal({
  post,
  boardInstance,
  userSession,
  onClose,
  onLoginClick,
}: PostDetailsModalProps) {
  const [replies, setReplies] = useState<MastodonPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});
  const [replyToPost, setReplyToPost] = useState<MastodonPost | null>(null);

  const loadReplies = async () => {
    setLoading(true);
    setError(null);
    try {
      const instance = userSession?.instance || boardInstance;
      const context = await fetchPostContext(post.id, instance, userSession?.token);
      setReplies(context.descendants || []);
    } catch (err: any) {
      setError(err.message || "Failed to load replies.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReplies();
    setReplyToPost(null);
    const handle = post.account.acct.includes("@") ? `@${post.account.acct}` : `@${post.account.acct}@${boardInstance}`;
    setReplyText(`${handle} `);
  }, [post, boardInstance, userSession]);

  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userSession || !replyText.trim()) return;

    setSubmittingReply(true);
    setError(null);
    setSuccessMsg("");

    const targetPost = replyToPost || post;
    try {
      await postReply(targetPost.url, replyText, userSession.instance, userSession.token, targetPost.id);
      setSuccessMsg("Reply published on Mastodon!");
      setReplyToPost(null);
      const mainHandle = post.account.acct.includes("@") ? `@${post.account.acct}` : `@${post.account.acct}@${boardInstance}`;
      setReplyText(`${mainHandle} `);
      setTimeout(() => { loadReplies(); setSuccessMsg(""); }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to publish reply.");
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleStartReplyToNode = (targetComment: MastodonPost) => {
    setReplyToPost(targetComment);
    const handle = targetComment.account.acct.includes("@")
      ? `@${targetComment.account.acct}`
      : `@${targetComment.account.acct}@${boardInstance}`;
    setReplyText((prev) => {
      const cleaned = prev.replace(/^@[a-zA-Z0-9_.-]+(@[a-zA-Z0-9_.-]+)?\s+/, "");
      return `${handle} ${cleaned}`;
    });
    setTimeout(() => {
      const el = document.getElementById("reply-textarea");
      if (el) { el.focus(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
    }, 50);
  };

  const handleScrollToParentNode = (parentId: string) => {
    const el = document.getElementById(`reply-${parentId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.outline = "2px solid #0088cc";
      el.style.outlineOffset = "2px";
      setTimeout(() => { el.style.outline = ""; el.style.outlineOffset = ""; }, 2000);
    }
  };

  const handleToggleCollapse = (commentId: string) => {
    setCollapsedIds((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const flatRepliesMap = useMemo(() => {
    const map: Record<string, MastodonPost> = {};
    replies.forEach((r) => { map[r.id] = r; });
    return map;
  }, [replies]);

  const threadTree = useMemo(() => buildThreadTree(replies, post.id), [replies, post.id]);

  useEffect(() => {
    const collapsed: Record<string, boolean> = {};
    const walk = (nodes: ThreadNode[]) => {
      nodes.forEach((node) => {
        if (node.depth > 0) collapsed[node.post.id] = true;
        walk(node.children);
      });
    };
    walk(threadTree);
    setCollapsedIds(collapsed);
  }, [threadTree]);

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleString("en-US", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return d; }
  };

  return (
    <div
      className="bg-white w-full border flex flex-col shadow-sm overflow-hidden"
      style={{ borderColor: "#e9e9e9", borderRadius: "4px" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 bg-[#f8f8f8]"
        style={{ borderBottom: "1px solid #e9e9e9" }}
      >
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-[#222] text-xs font-bold transition"
          style={{ borderRadius: "4px" }}
        >
          <CornerUpLeft className="w-3.5 h-3.5" style={{ color: "#0088cc" }} />
          Back to list
        </button>

        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-400">
          <span
            className="border px-2 py-0.5 uppercase"
            style={{ color: "#0088cc", backgroundColor: "#e8f4fc", borderColor: "#b3d9ee", borderRadius: "4px" }}
          >
            #{post.associatedSubboard?.tag || "Thread"}
          </span>
          <span className="hidden sm:inline text-slate-500">Viewing topic</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-5">
        {/* Original post */}
        <div
          className="bg-[#f8f8f8] border p-5 space-y-4"
          style={{ borderColor: "#e9e9e9", borderRadius: "4px" }}
        >
          <div className="flex items-center gap-3">
            <a href={post.account.url} target="_blank" rel="noopener noreferrer">
              <img
                src={post.account.avatar}
                alt={post.account.display_name || post.account.username}
                referrerPolicy="no-referrer"
                className="w-11 h-11 object-cover border border-slate-200 bg-white"
                style={{ borderRadius: "4px" }}
              />
            </a>
            <div>
              <a
                href={post.account.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[15px] text-[#222] block transition"
                onMouseOver={(e) => (e.currentTarget.style.color = "#0088cc")}
                onMouseOut={(e) => (e.currentTarget.style.color = "#222")}
              >
                {post.account.display_name || post.account.username}
              </a>
              <span className="text-xs text-slate-500 font-mono">
                {post.account.acct.includes("@") ? `@${post.account.acct}` : `@${post.account.acct}@${boardInstance}`}
              </span>
            </div>
          </div>

          <div
            className="text-[15px] text-[#222] leading-relaxed mastodon-html-content space-y-3 font-medium"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
          />

          {post.media_attachments && post.media_attachments.length > 0 && (
            <div className="grid grid-cols-1 gap-2 overflow-hidden border border-slate-200" style={{ borderRadius: "4px" }}>
              {post.media_attachments.map((media) => (
                <a key={media.id} href={media.url} target="_blank" rel="noopener noreferrer" className="block relative group">
                  <img
                    src={media.url}
                    alt={media.description || "Attachment"}
                    referrerPolicy="no-referrer"
                    className="w-full object-contain max-h-96 bg-slate-100"
                  />
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-sm gap-1.5 font-bold">
                    View original <ExternalLink className="w-4 h-4" />
                  </div>
                </a>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-500 pt-3" style={{ borderTop: "1px solid #e9e9e9" }}>
            <span className="font-mono text-slate-400">{formatDate(post.created_at)}</span>
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold flex items-center gap-1.5 hover:underline"
              style={{ color: "#0088cc" }}
            >
              Open on Mastodon <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div className="flex items-center gap-6 text-slate-500 text-xs font-mono font-bold">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-slate-400" />
              <span>{post.replies_count} Replies</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Repeat className="w-4 h-4 text-slate-400" />
              <span>{post.reblogs_count} Boosts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span>{post.favourites_count} Likes</span>
            </div>
          </div>
        </div>

        {/* Thread replies */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2" style={{ borderBottom: "1px solid #e9e9e9" }}>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
              Discussion ({replies.length})
            </h4>
            <button
              onClick={loadReplies}
              className="text-slate-400 hover:text-slate-700 transition p-1 hover:bg-slate-100"
              style={{ borderRadius: "9999px" }}
              title="Refresh replies"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3 py-6">
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
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 p-3 font-medium" style={{ borderRadius: "4px" }}>
              {error}
            </p>
          ) : threadTree.length === 0 ? (
            <div className="text-center py-8 bg-[#f8f8f8] border border-dashed border-slate-200" style={{ borderRadius: "4px" }}>
              <p className="text-sm text-slate-500 italic">No replies yet.</p>
              <p className="text-xs text-slate-400 mt-1">Be the first to reply to this topic!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {threadTree.map((node) => (
                <ReplyThreadNode
                  key={node.post.id}
                  node={node}
                  onReplyClick={handleStartReplyToNode}
                  onScrollToParent={handleScrollToParentNode}
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
      <div className="bg-white p-5 shadow-lg z-10" style={{ borderTop: "1px solid #e9e9e9" }}>
        {successMsg && (
          <div className="mb-3 bg-emerald-50 border border-emerald-200 text-emerald-700 p-2.5 text-xs font-bold" style={{ borderRadius: "4px" }}>
            {successMsg}
          </div>
        )}

        {userSession ? (
          <form onSubmit={handlePostReply} className="space-y-3">
            {replyToPost && (
              <div
                className="p-2.5 text-xs flex items-center justify-between"
                style={{ backgroundColor: "#e8f4fc", border: "1px solid #b3d9ee", borderRadius: "4px", color: "#0088cc" }}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <CornerDownRight className="w-3.5 h-3.5" />
                  <span>
                    Replying to{" "}
                    <strong className="text-[#222]">{replyToPost.account.display_name || replyToPost.account.username}</strong>{" "}
                    as sub-thread
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReplyToPost(null);
                    const handle = post.account.acct.includes("@") ? `@${post.account.acct}` : `@${post.account.acct}@${boardInstance}`;
                    setReplyText(`${handle} `);
                  }}
                  className="text-slate-400 hover:text-slate-700 p-0.5 hover:bg-white/50 transition"
                  style={{ borderRadius: "4px" }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={userSession.avatar}
                  alt={userSession.displayName}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 border border-slate-200"
                  style={{ borderRadius: "4px" }}
                />
                <span className="text-xs text-slate-500 font-bold">
                  Reply as <strong className="text-[#222]">{userSession.displayName}</strong>
                </span>
              </div>
              <span
                className="text-[11px] font-mono font-bold px-2 py-0.5 border"
                style={{ color: "#0088cc", backgroundColor: "#e8f4fc", borderColor: "#b3d9ee", borderRadius: "4px" }}
              >
                {userSession.instance}
              </span>
            </div>

            <div
              className="relative border border-slate-200 overflow-hidden bg-[#f8f8f8] transition"
              style={{ borderRadius: "4px" }}
              onFocusCapture={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "#0088cc";
                (e.currentTarget as HTMLDivElement).style.backgroundColor = "#fff";
              }}
              onBlurCapture={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "";
                (e.currentTarget as HTMLDivElement).style.backgroundColor = "";
              }}
            >
              <textarea
                id="reply-textarea"
                rows={3}
                required
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write your reply here…"
                className="w-full p-3 text-sm bg-transparent border-none focus:outline-none resize-none text-[#222] placeholder-slate-400 leading-relaxed font-medium"
              />
              <div className="flex justify-between items-center px-3 py-2 bg-slate-100/50" style={{ borderTop: "1px solid #e9e9e9" }}>
                <span className="text-[10px] text-slate-400 font-mono">{500 - replyText.length} chars left</span>
                <button
                  type="submit"
                  disabled={submittingReply || !replyText.trim()}
                  className="px-4 py-1.5 text-white text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#0088cc", borderRadius: "4px" }}
                  onMouseOver={(e) => { if (!submittingReply) e.currentTarget.style.backgroundColor = "#006fa3"; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#0088cc"; }}
                >
                  <Send className="w-3.5 h-3.5" />
                  {submittingReply ? "Sending…" : "Send Reply"}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="text-center py-4 space-y-3">
            <p className="text-sm text-slate-500">
              Sign in with your Mastodon account to reply directly from this board.
            </p>
            <button
              type="button"
              onClick={onLoginClick}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-white text-sm font-bold transition"
              style={{ backgroundColor: "#0088cc", borderRadius: "4px" }}
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign in with Mastodon
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
