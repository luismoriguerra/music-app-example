// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// Dev twin of public/serve.json (prod rewrite, 004 game-route.md): every
// /courses/<c>/games/lyrics-chords/<entry_id> serves the static sheet shell.
const SHEET_PAGE_RE =
  /^\/courses\/([^/]+)\/games\/lyrics-chords\/([^/?]+)\/?(\?.*)?$/;

/** @returns {import("vite").Plugin} */
function sheetPageRewrite() {
  return {
    name: "sheet-page-rewrite",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const match = req.url?.match(SHEET_PAGE_RE);
        if (match && match[2] !== "entry") {
          req.url = `/courses/${match[1]}/games/lyrics-chords/entry${match[3] ?? ""}`;
        }
        next();
      });
    },
  };
}

// https://astro.build/config
export default defineConfig({
  // Intent prefetching (FR-025): hover by default; card links opt into
  // viewport via data-astro-prefetch. External links never prefetch.
  prefetch: true,
  integrations: [react()],
  vite: {
    plugins: [tailwindcss(), sheetPageRewrite()],
  },
});
