import { defineConfig } from "astro/config";

// The site lives at delightly.dev/lab, so every URL and asset carries the base.
export default defineConfig({
  site: "https://delightly.dev",
  base: "/lab",
  trailingSlash: "always",
  build: { format: "directory" },
});
