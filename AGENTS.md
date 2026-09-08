# Prism Pour release requirements

This is a static PWA. After any change to dist/, run `python scripts/prepare-pwa.py` BEFORE committing and packaging. Commit the resulting dist/sw.js and dist/version.json with the source. The worker verifies all release asset hashes; forgetting this step prevents clients from receiving updates.

Preserve the between-level-only update activation, offline fallback, stored progress, and instant pointer controls. No reloads during an active puzzle. Do not add automatic skipWaiting during service-worker install.
