import { MessageSquare, Repeat, Heart, ExternalLink } from "lucide-react";
import { MastodonPost } from "../types";
import { sanitizeHtml } from "../lib/sanitize";

interface MastodonPostCardProps {
  post: MastodonPost;
  boardInstance: string;
  onClick: () => void;
}

export default function MastodonPostCard({ post, boardInstance, onClick }: MastodonPostCardProps) {
  const { account, created_at, content, replies_count, reblogs_count, favourites_count, media_attachments, url } = post;

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const getFullAcct = () => {
    if (account.acct.includes("@")) return `@${account.acct}`;
    return `@${account.acct}@${boardInstance}`;
  };

  return (
    <div
      onClick={onClick}
      className="bg-white border hover:bg-slate-50/50 p-4 shadow-sm cursor-pointer transition flex flex-col justify-between group h-full select-none"
      style={{ borderColor: "#e9e9e9", borderRadius: "4px" }}
      onMouseOver={(e) => (e.currentTarget.style.borderColor = "#0088cc")}
      onMouseOut={(e) => (e.currentTarget.style.borderColor = "#e9e9e9")}
    >
      <div className="space-y-3">
        {/* Author header */}
        <div className="flex items-start gap-2.5">
          <a
            href={account.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={account.avatar}
              alt={account.display_name || account.username}
              referrerPolicy="no-referrer"
              className="w-9 h-9 object-cover border border-slate-200 bg-slate-100"
              style={{ borderRadius: "4px" }}
            />
          </a>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1.5">
              <a
                href={account.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-bold text-sm text-[#222] truncate hover:underline block"
                style={{ color: "#222" }}
                onMouseOver={(e) => (e.currentTarget.style.color = "#0088cc")}
                onMouseOut={(e) => (e.currentTarget.style.color = "#222")}
              >
                {account.display_name || account.username}
              </a>
              <span className="text-xs text-slate-400 flex-shrink-0 font-mono">
                {formatDate(created_at)}
              </span>
            </div>
            <div className="flex items-center gap-1 leading-none">
              <span className="text-xs text-slate-500 truncate font-mono">{getFullAcct()}</span>
              {account.bot && (
                <span className="bg-slate-100 text-slate-600 font-mono font-bold text-[8.5px] px-1 uppercase tracking-wider" style={{ borderRadius: "2px" }}>
                  Bot
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div
          className="text-sm text-slate-700 leading-relaxed break-words mastodon-html-content line-clamp-6 font-medium"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
        />

        {/* Media */}
        {media_attachments && media_attachments.length > 0 && (
          <div className="grid grid-cols-1 gap-1.5 overflow-hidden border border-slate-200 bg-slate-100" style={{ borderRadius: "4px" }}>
            {media_attachments.slice(0, 2).map((media) => {
              if (media.type === "image" || media.type === "gifv") {
                return (
                  <img
                    key={media.id}
                    src={media.preview_url || media.url}
                    alt={media.description || "Attachment"}
                    referrerPolicy="no-referrer"
                    className="w-full h-32 object-cover bg-slate-100"
                  />
                );
              }
              return null;
            })}
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between pt-3 mt-4 text-slate-500 text-xs font-mono font-bold" style={{ borderTop: "1px solid #e9e9e9" }}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1" title={`${replies_count} replies`}>
            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
            <span>{replies_count}</span>
          </div>
          <div className="flex items-center gap-1" title={`${reblogs_count} boosts`}>
            <Repeat className="w-3.5 h-3.5 text-slate-400" />
            <span>{reblogs_count}</span>
          </div>
          <div className="flex items-center gap-1" title={`${favourites_count} likes`}>
            <Heart className="w-3.5 h-3.5 text-rose-500" />
            <span>{favourites_count}</span>
          </div>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="hover:text-slate-800 transition p-1 hover:bg-slate-100"
          style={{ borderRadius: "4px" }}
          title="Open original post"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
