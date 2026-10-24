// Serves the built site at delightly.dev/lab/*.
//
// Astro writes dist/ without the /lab prefix (dist/status-thread/index.html), so the
// worker strips it before looking up the file. It also adds the trailing slash
// itself, because the built-in redirect would drop /lab from the Location.
interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const BASE = "/lab";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === BASE || (!url.pathname.endsWith("/") && !/\.[a-z0-9]+$/i.test(url.pathname))) {
      url.pathname += "/";
      return Response.redirect(url.toString(), 308);
    }

    url.pathname = url.pathname.slice(BASE.length) || "/";
    return env.ASSETS.fetch(new Request(url, request));
  },
};
