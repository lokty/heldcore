# Heldcore notes for Claude

## Deployment is a static export, not Phoenix

This repo deploys to GitHub Pages from hand-flattened static files at the repo root:
`index.html`, `impressum.html`, `priv/static/assets/{css,js}/*`, and the images
under `priv/static/images/`. The Phoenix LiveView source under `lib/` and
`assets/` is **not** what gets served — it's only the dev environment.

After any source change that should ship, run:

```
mix phx.server          # in another terminal, must be running
mix static_export
```

`mix static_export` rebuilds the minified JS/CSS bundles, fetches `/` and
`/impressum` from the dev server, rewrites asset paths to `priv/static/...`,
strips the LiveReload iframe, and writes the result to `index.html` /
`impressum.html`. Commit those files together with the source changes.

Source for the task: `lib/mix/tasks/static_export.ex`.
