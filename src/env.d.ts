/// <reference types="astro/client" />

// The site runs on Vercel's Node runtime, so secrets are read from
// process.env through lib/server/env.ts and the database from
// lib/server/db.ts, rather than arriving on the request as platform
// bindings. The one thing on locals is the logged-in staff member,
// which src/middleware.ts sets on every /admin/ request.
declare namespace App {
  interface Locals {
    staff?: import("./lib/server/auth.ts").Staff;
  }
}
