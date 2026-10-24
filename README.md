# Delightly Lab

Small interface experiments, served at `delightly.dev/lab/<project>`.

## Add a project

1. Create `src/pages/<slug>/index.astro` and wrap it in `LabLayout`.
2. Add an entry to `src/projects.ts` so it shows on the index.

Each project keeps its own styles and script (larger ones put code in `src/projects/<slug>/`); nothing is shared except the frame
(brand + share button) in `src/layouts/LabLayout.astro`.

## Develop

```bash
pnpm dev     # http://localhost:4321/lab/
pnpm build
```

## Deploy

`pnpm deploy` (or a push to `main`) builds and runs `wrangler deploy`. The Worker in
`worker/index.ts` serves `dist/` for `delightly.dev/lab/*`; every other path on the
domain is untouched. CI needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
