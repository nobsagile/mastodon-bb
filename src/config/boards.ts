import { Board } from "../types";

export const DEFAULT_BOARDS: Board[] = [
  {
    id: "agile",
    title: "Agile Bulletin Board",
    description: "The latest developments, methods, and discussions around Agile, Scrum, and Kanban on Mastodon.",
    subboards: [
      { id: "agile-sub", title: "Agile", tag: "agile" },
      { id: "scrum-sub", title: "Scrum", tag: "scrum" },
      { id: "kanban-sub", title: "Kanban", tag: "kanban" }
    ]
  },
  {
    id: "tech",
    title: "Technology & Coding",
    description: "Exciting topics around web development and modern technologies.",
    subboards: [
      { id: "webdev-sub", title: "WebDev", tag: "webdev" },
      { id: "typescript-sub", title: "TypeScript", tag: "typescript" },
      { id: "react-sub", title: "React", tag: "reactjs" }
    ]
  }
];
