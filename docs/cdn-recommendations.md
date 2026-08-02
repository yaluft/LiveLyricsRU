# CDN recommendations

Two very different things sit behind a CDN in this app: static build assets served by
nginx, and the audio bytes proxied through `/api/stream/:trackId`. They need different
caching strategies.

## Static assets (`/assets/`)

Any CDN that honours the origin's `Cache-Control` response header can be dropped in front
of nginx with no extra configuration. `nginx.conf`'s `/assets/` block already does the
right thing for hashed, content-addressed filenames:

```nginx
location /assets/ {
    proxy_pass http://lyrika_app;
    proxy_set_header Host $host;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

`expires 1y` plus `Cache-Control: public, immutable` tells any downstream cache the
response body for a given hashed filename (e.g. `index-a1b2c3.js`) will never change, so
it's safe to cache for a year and skip revalidation entirely. A CDN just needs to respect
that header — no bespoke cache-key or TTL override is required for this path.

**Do not apply that same long TTL to `/` (the root, i.e. `index.html`).** The `location /`
block in `nginx.conf` has no `expires`/`Cache-Control` override, and that's deliberate:
`index.html` references the *current* deploy's hashed asset filenames by name. If a CDN
were to cache the HTML shell for a year, a browser could load a stale shell pointing at
`index-a1b2c3.js` after a new deploy has pruned that exact file from `/assets/`, producing
a hard 404 for real users with no way to recover short of a manual cache purge. Configure
the CDN to cache `/` for a short TTL (or not at all — respecting the origin's default,
uncached response) while long-caching `/assets/*` — this is a page-rule / cache-key
distinction on most CDNs, not a code change.

## `/api/stream/:trackId` (audio bytes)

This route is proxying two things with very different lifetimes:

- **The origin's internal `STREAM_CACHE` entry** (see `server/src/lib/streamCache.ts`) —
  the actual yt-dlp-resolved CDN URL, IP-bound and short-lived. It's kept for 5 minutes
  (`STREAM_CACHE_TTL_MS`) before the origin re-resolves it.
- **The audio bytes themselves**, keyed by `trackId` (and `Range` header, for partial
  requests) — these are stable forever. The same song resolves to the same audio content
  every time `/api/stream/:trackId` is requested, regardless of which upstream CDN URL the
  origin currently has cached internally. The 5-minute internal TTL is about avoiding
  repeated yt-dlp invocations, not about the bytes changing.

Because of that gap, an edge cache can safely hold a copy of a given `(trackId, Range)`
response far longer than the origin's own 5-minute internal TTL — 24 hours or more is
reasonable, since re-fetching the same trackId a day later still gets byte-identical
audio.

This only becomes viable with the change in this PR: `/api/stream/:trackId` now sets its
own `Cache-Control: public, max-age=86400` on every 200/206 response (not on error
responses), rather than passing through whatever caching header the upstream video CDN
happened to send — which, for a googlevideo/VK CDN URL, is commonly `no-cache` or absent,
since the upstream URL itself is short-lived and IP-bound in a way the *content* is not.
Point a CDN at this route and configure its cache key to include the `Range` header
(distinct byte ranges of the same trackId are distinct cacheable objects) and it can now
serve repeat playback/seeks for a given track entirely from the edge, without hitting the
origin (and therefore without needing yt-dlp to re-resolve anything) for up to 24h per
range.

**Caveat: verify partial-content (byte-range) caching support against current provider
docs before relying on this.** CDN support for caching `206 Partial Content` responses on
a range-keyed basis is inconsistent and has historically varied by provider and plan tier
— e.g. Cloudflare's free/pro tiers have had documented limitations around range-request
caching in the past, whereas providers more oriented at media delivery (Bunny.net,
Fastly) have historically had more complete support. Treat none of this as gospel: CDN
feature support changes fast, so re-check the specific provider's current documentation
for byte-range / partial-content caching behaviour before depending on it in production,
rather than assuming today's `Cache-Control` header alone is sufficient to guarantee
correct range-cache behaviour on every provider.
