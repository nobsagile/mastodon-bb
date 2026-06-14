import { useState } from "react";
import { MessageSquare, Repeat2, Heart, ExternalLink, BarChart2, EyeOff, Eye, Globe, Lock, AlertCircle } from "lucide-react";
import { MastodonPost } from "../types";
import { sanitizeHtml } from "../lib/sanitize";

interface MastodonPostCardProps {
  post: MastodonPost;
  boardInstance: string;
  onClick: () => void;
}

function relativeTime(d: string) {
  try {
    const diff = Math.max(0, Date.now() - new Date(d).getTime());
    const sec = Math.floor(diff / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    if (sec < 60) return "just now";
    if (min < 60) return `${min}m`;
    if (hr < 24) return `${hr}h`;
    return `${day}d`;
  } catch { return ""; }
}

function VisibilityIcon({ v }: { v: MastodonPost["visibility"] }) {
  if (v === "public") return <Globe className="w-3 h-3 text-slate-300" title="Public" />;
  if (v === "unlisted") return <EyeOff className="w-3 h-3 text-slate-400" title="Unlisted" />;
  if (v === "private") return <Lock className="w-3 h-3 text-amber-400" title="Followers only" />;
  return null;
}

function LinkCard({ card, onClick }: { card: NonNullable<MastodonPost["card"]>; onClick: () => void }) {
  if (!card.title) return null;
  return (
    <a
      href={card.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="flex gap-3 border border-slate-200 hover:border-slate-300 bg-[#f8f8f8] hover:bg-slate-50 transition overflow-hidden mt-2"
      style={{ borderRadius: "4px" }}
    >
      {card.image && (
        <img
          src={card.image}
          alt=""
          referrerPolicy="no-referrer"
          className="w-16 h-16 object-cover flex-shrink-0 bg-slate-200"
        />
      )}
      <div className="flex-1 min-w-0 py-2 pr-2">
        <p className="text-xs font-bold text-[#222] line-clamp-1 leading-snug">{card.title}</p>
        {card.description && (
          <p className="text-xs text-slate-500 line-clamp-2 mt-0.5 leading-snug">{card.description}</p>
        )}
        <p className="text-[10px] text-slate-400 font-mono mt-1 truncate">
          {card.provider_name || (() => { try { return new URL(card.url).hostname; } catch { return card.url; } })()}
        </p>
      </div>
    </a>
  );
}

export default function MastodonPostCard({ post, boardInstance, onClick }: MastodonPostCardProps) {
  const displayPost = post.reblog ?? post;
  const booster = post.reblog ? post.account : null;

  const [cwRevealed, setCwRevealed] = useState(false);
  const [sensitiveRevealed, setSensitiveRevealed] = useState(false);

  const hasCw = !!displayPost.spoiler_text;
  const contentHidden = hasCw && !cwRevealed;

  const getFullAcct = (acct: string) =>
    acct.includes("@") ? `@${acct}` : `@${acct}@${boardInstance}`;

  return (
    <div
      onClick={onClick}
      className="bg-white border hover:bg-slate-50/50 p-4 shadow-sm cursor-pointer transition flex flex-col justify-between group h-full select-none"
      style={{ borderColor: "#e9e9e9", borderRadius: "4px" }}
      onMouseOver={(e) => (e.currentTarget.style.borderColor = "#0088cc")}
      onMouseOut={(e) => (e.currentTarget.style.borderColor = "#e9e9e9")}
    >
      <div className="space-y-2.5">
        {/* Boost header */}
        {booster && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 -mb-1">
            <Repeat2 className="w-3 h-3 flex-shrink-0" />
            <img
              src={booster.avatar}
              alt=""
              referrerPolicy="no-referrer"
              className="w-4 h-4 object-cover border border-slate-200 flex-shrink-0"
              style={{ borderRadius: "2px" }}
            />
            <span className="truncate">
              <strong className="text-slate-500">{booster.display_name || booster.username}</strong> boosted
            </span>
          </div>
        )}

        {/* Author header */}
        <div className="flex items-start gap-2.5">
          <a
            href={displayPost.account.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={displayPost.account.avatar}
              alt={displayPost.account.display_name || displayPost.account.username}
              referrerPolicy="no-referrer"
              className="w-9 h-9 object-cover border border-slate-200 bg-slate-100 flex-shrink-0"
              style={{ borderRadius: "4px" }}
            />
          </a>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1.5">
              <a
                href={displayPost.account.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-bold text-sm text-[#222] truncate hover:underline block"
                onMouseOver={(e) => (e.currentTarget.style.color = "#0088cc")}
                onMouseOut={(e) => (e.currentTarget.style.color = "#222")}
              >
                {displayPost.account.display_name || displayPost.account.username}
              </a>
              <div className="flex items-center gap-1 flex-shrink-0">
                <VisibilityIcon v={displayPost.visibility} />
                <span className="text-xs text-slate-400 font-mono">{relativeTime(displayPost.created_at)}</span>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-mono truncate block">
              {getFullAcct(displayPost.account.acct)}
              {displayPost.account.bot && (
                <span className="ml-1 bg-slate-100 text-slate-500 font-bold text-[8px] px-1 uppercase tracking-wider align-middle" style={{ borderRadius: "2px" }}>Bot</span>
              )}
            </span>
          </div>
        </div>

        {/* Content warning */}
        {hasCw && (
          <div
            className="flex items-center justify-between px-3 py-2 border border-amber-200 bg-amber-50"
            style={{ borderRadius: "4px" }}
            onClick={(e) => { e.stopPropagation(); setCwRevealed((v) => !v); }}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="line-clamp-1">{displayPost.spoiler_text}</span>
            </div>
            <span className="text-[10px] font-bold text-amber-600 ml-2 flex-shrink-0">
              {cwRevealed ? "Hide" : "Show"}
            </span>
          </div>
        )}

        {/* Content */}
        {!contentHidden && (
          <>
            <div
              className="text-sm text-slate-700 leading-relaxed break-words mastodon-html-content line-clamp-5 font-medium"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayPost.content) }}
            />

            {/* Media */}
            {displayPost.media_attachments?.length > 0 && (
              <div
                className="grid gap-1 overflow-hidden border border-slate-200 bg-slate-100 relative"
                style={{
                  borderRadius: "4px",
                  gridTemplateColumns: displayPost.media_attachments.length > 1 ? "1fr 1fr" : "1fr",
                }}
                onClick={(e) => { if (displayPost.sensitive && !sensitiveRevealed) { e.stopPropagation(); setSensitiveRevealed(true); } }}
              >
                {displayPost.media_attachments.slice(0, 4).map((media) => {
                  if (media.type !== "image" && media.type !== "gifv") return null;
                  return (
                    <div key={media.id} className="relative">
                      <img
                        src={media.preview_url || media.url}
                        alt={media.description || "Attachment"}
                        referrerPolicy="no-referrer"
                        className="w-full h-28 object-cover bg-slate-100"
                        style={{ filter: displayPost.sensitive && !sensitiveRevealed ? "blur(16px)" : "none" }}
                      />
                    </div>
                  );
                })}
                {displayPost.sensitive && !sensitiveRevealed && (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-1 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setSensitiveRevealed(true); }}
                  >
                    <EyeOff className="w-5 h-5 text-white drop-shadow" />
                    <span className="text-xs font-bold text-white drop-shadow">Sensitive</span>
                  </div>
                )}
              </div>
            )}

            {/* Poll badge */}
            {displayPost.poll && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Poll · {displayPost.poll.votes_count} votes{displayPost.poll.expired ? " · closed" : ""}</span>
              </div>
            )}

            {/* Link card */}
            {displayPost.card && !displayPost.media_attachments?.length && (
              <LinkCard card={displayPost.card} onClick={onClick} />
            )}
          </>
        )}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between pt-3 mt-3 text-slate-500 text-xs font-mono font-bold" style={{ borderTop: "1px solid #e9e9e9" }}>
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-1" title={`${displayPost.replies_count} replies`}>
            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
            <span>{displayPost.replies_count}</span>
          </div>
          <div className="flex items-center gap-1" title={`${displayPost.reblogs_count} boosts`}>
            <Repeat2 className="w-3.5 h-3.5 text-slate-400" />
            <span>{displayPost.reblogs_count}</span>
          </div>
          <div className="flex items-center gap-1" title={`${displayPost.favourites_count} likes`}>
            <Heart className="w-3.5 h-3.5 text-rose-400" />
            <span>{displayPost.favourites_count}</span>
          </div>
        </div>
        <a
          href={displayPost.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="hover:text-slate-800 transition p-1 hover:bg-slate-100"
          style={{ borderRadius: "4px" }}
          title="Open on Mastodon"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
