// @ts-check
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";

// Rendered on demand. The ranges, the rates and the site settings live
// in the database for the shop to edit, so every page reads them when
// it is asked for — and src/middleware.ts lets Vercel's CDN hold the
// public pages for a minute, so that costs a query a minute, not one
// per visitor.
export default defineConfig({
  site: "https://www.quintoncarpets.co.uk",
  output: "server",
  // Vercel's own image optimisation, not Astro's: Astro's /_image
  // endpoint is not deployed on this adapter.
  adapter: vercel({ imageService: true }),
  image: {
    // Photos are paths under public/ or, once the shop uploads its
    // own, public files in the project's Supabase Storage.
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
  // Pages keep their trailing slash via build.format "directory".
  // "always" would 308-redirect a POST to /api/bookings, so this is
  // left permissive and the API routes answer either spelling.
  trailingSlash: "ignore",
  build: { format: "directory" },
  vite: { plugins: [tailwindcss()] },
  devToolbar: { enabled: false },
});
