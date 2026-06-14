# Mastodon Bulletin Board

## Commit Messages

NIEMALS Claude als Co-Autor in Commit-Messages eintragen. Kein `Co-Authored-By: Claude`.

## Hosting

GitHub Pages via https://github.com/nobsagile

## Architecture

Static SPA — kein Server. React + Vite → `dist/` deployed auf GitHub Pages.
Board-Konfiguration in `src/config/boards.ts` (editierbar, dann Redeploy).
OAuth komplett client-side direkt gegen Mastodon-Instanzen.
