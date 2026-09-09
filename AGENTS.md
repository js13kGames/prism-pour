# Prism Pour release requirements

This is a static Vite PWA powered by `vite-plugin-pwa`. After source or asset changes, run `npm run build` before committing or packaging. Commit the generated `dist/` output, including `dist/sw.js` and `dist/manifest.webmanifest`.

Preserve the between-level-only update activation, offline fallback, stored progress, and instant pointer controls. No reloads during an active puzzle. Keep Workbox `skipWaiting` disabled so the app activates updates only after the player chooses a new level.
