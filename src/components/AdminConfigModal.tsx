import React, { useState } from "react";
import { X, Plus, Trash2, Save } from "lucide-react";
import { Board, Subboard } from "../types";

interface AdminConfigModalProps {
  onClose: () => void;
  onSaveSuccess: (updatedBoards: Board[]) => void;
  currentBoards: Board[];
}

export default function AdminConfigModal({
  onClose,
  onSaveSuccess,
  currentBoards,
}: AdminConfigModalProps) {
  const [boards, setBoards] = useState<Board[]>(JSON.parse(JSON.stringify(currentBoards)));
  const [success, setSuccess] = useState(false);

  const handleAddBoard = () => {
    const ts = Date.now();
    const newBoard: Board = {
      id: "board-" + ts,
      title: "New Category",
      description: "Category description...",
      subboards: [{ id: "sub-" + ts + "-1", title: "General", tag: "general" }],
    };
    setBoards([...boards, newBoard]);
  };

  const handleUpdateBoardField = (boardIndex: number, field: keyof Board, value: any) => {
    const updated = [...boards];
    updated[boardIndex] = { ...updated[boardIndex], [field]: value };
    if (field === "title") {
      const generatedId = (value as string)
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 30);
      updated[boardIndex].id = generatedId || updated[boardIndex].id;
    }
    setBoards(updated);
  };

  const handleDeleteBoard = (boardIndex: number) => {
    const updated = [...boards];
    updated.splice(boardIndex, 1);
    setBoards(updated);
  };

  const handleAddSubboard = (boardIndex: number) => {
    const updated = [...boards];
    const newSub: Subboard = { id: "sub-" + Date.now(), title: "New Hashtag", tag: "hashtag" };
    updated[boardIndex].subboards = [...updated[boardIndex].subboards, newSub];
    setBoards(updated);
  };

  const handleUpdateSubboardField = (
    boardIndex: number,
    subIndex: number,
    field: keyof Subboard,
    value: string
  ) => {
    const updated = [...boards];
    const subs = [...updated[boardIndex].subboards];
    let val = value;
    if (field === "tag") {
      val = value.replace(/#/g, "").replace(/\s+/g, "").toLowerCase();
    }
    subs[subIndex] = { ...subs[subIndex], [field]: val };
    updated[boardIndex].subboards = subs;
    setBoards(updated);
  };

  const handleDeleteSubboard = (boardIndex: number, subIndex: number) => {
    const updated = [...boards];
    const subs = [...updated[boardIndex].subboards];
    subs.splice(subIndex, 1);
    updated[boardIndex].subboards = subs;
    setBoards(updated);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("mastodon_boards_config", JSON.stringify(boards));
    setSuccess(true);
    setTimeout(() => {
      onSaveSuccess(boards);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div
        className="bg-white w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        style={{ borderRadius: "4px", border: "1px solid #e9e9e9" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 bg-white"
          style={{ borderBottom: "1px solid #e9e9e9" }}
        >
          <div>
            <h3 className="text-base font-bold text-[#222]">Manage Categories & Hashtags</h3>
            <p className="text-sm text-slate-500 mt-1">
              Define categories and link them to Mastodon hashtags. Config is saved locally in your browser.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 transition flex-shrink-0 ml-4"
            style={{ borderRadius: "4px" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#f2f2f2]">
          {success && (
            <div
              className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm font-semibold"
              style={{ borderRadius: "4px" }}
            >
              Configuration saved locally! Closing…
            </div>
          )}

          {boards.map((board, bIndex) => (
            <div
              key={board.id}
              className="bg-white border space-y-4 p-5"
              style={{ borderColor: "#e9e9e9", borderRadius: "4px" }}
            >
              {/* Board fields */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                      Category Name
                    </label>
                    <input
                      type="text"
                      value={board.title}
                      onChange={(e) => handleUpdateBoardField(bIndex, "title", e.target.value)}
                      placeholder="e.g. Agile Software Development"
                      className="w-full text-sm font-semibold border border-slate-200 text-[#222] px-3 py-2 focus:outline-none bg-white"
                      style={{ borderRadius: "4px" }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#0088cc")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      value={board.description}
                      onChange={(e) => handleUpdateBoardField(bIndex, "description", e.target.value)}
                      placeholder="Discussions around Scrum and Kanban..."
                      className="w-full text-sm border border-slate-200 text-slate-700 px-3 py-2 focus:outline-none bg-white"
                      style={{ borderRadius: "4px" }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#0088cc")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteBoard(bIndex)}
                  className="p-2 text-red-500 hover:bg-red-50 transition mt-6 flex-shrink-0"
                  style={{ borderRadius: "4px" }}
                  title="Delete category"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Subboards */}
              <div className="pt-4" style={{ borderTop: "1px solid #e9e9e9" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Hashtag Feeds
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAddSubboard(bIndex)}
                    className="font-bold text-xs flex items-center gap-1 transition"
                    style={{ color: "#0088cc" }}
                    onMouseOver={(e) => (e.currentTarget.style.color = "#006fa3")}
                    onMouseOut={(e) => (e.currentTarget.style.color = "#0088cc")}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Hashtag
                  </button>
                </div>

                <div className="space-y-2">
                  {board.subboards.map((sub, sIndex) => (
                    <div
                      key={sub.id}
                      className="flex items-center gap-3 bg-[#f8f8f8] p-2.5 border border-slate-200"
                      style={{ borderRadius: "4px" }}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-xs font-mono font-bold select-none">T:</span>
                          <input
                            type="text"
                            value={sub.title}
                            onChange={(e) => handleUpdateSubboardField(bIndex, sIndex, "title", e.target.value)}
                            placeholder="Display name"
                            className="w-full text-xs border border-slate-200 bg-white px-2.5 py-1.5 text-[#222] focus:outline-none font-medium"
                            style={{ borderRadius: "4px" }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = "#0088cc")}
                            onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-xs font-mono font-bold select-none">#</span>
                          <input
                            type="text"
                            value={sub.tag}
                            onChange={(e) => handleUpdateSubboardField(bIndex, sIndex, "tag", e.target.value)}
                            placeholder="agile (no # required)"
                            className="w-full text-xs border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-[#222] focus:outline-none font-semibold"
                            style={{ borderRadius: "4px" }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = "#0088cc")}
                            onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSubboard(bIndex, sIndex)}
                        className="text-red-500 hover:bg-red-50 p-1.5 transition flex-shrink-0"
                        style={{ borderRadius: "4px" }}
                        title="Remove hashtag"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {board.subboards.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-2 italic">
                      No hashtags added. Add one to start fetching posts.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddBoard}
            className="w-full py-3.5 border-2 border-dashed border-slate-300 bg-white text-slate-600 transition flex items-center justify-center gap-2 text-sm font-bold"
            style={{ borderRadius: "4px" }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = "#0088cc"; e.currentTarget.style.color = "#0088cc"; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.color = ""; }}
          >
            <Plus className="w-4 h-4" /> Add New Category
          </button>
        </div>

        {/* Footer */}
        <form
          onSubmit={handleSave}
          className="bg-white px-5 py-4 flex items-center justify-between gap-4"
          style={{ borderTop: "1px solid #e9e9e9" }}
        >
          <p className="text-xs text-slate-400">
            Configuration is stored locally in your browser and overrides the default categories.
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-sm font-bold text-slate-600 hover:text-[#222] transition"
              style={{ borderRadius: "4px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={success}
              className="px-5 py-2 text-white text-sm font-bold flex items-center gap-2 transition disabled:opacity-50"
              style={{ backgroundColor: "#0088cc", borderRadius: "4px" }}
              onMouseOver={(e) => { if (!success) e.currentTarget.style.backgroundColor = "#006fa3"; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#0088cc"; }}
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
