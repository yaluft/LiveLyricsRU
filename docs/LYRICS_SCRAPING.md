Lyrics scraping and integration — notes and legal considerations

This project may optionally try to fetch lyrics from public websites when no
licensed source is available. Important considerations before enabling scraping:

- Legal: Lyrics are typically copyright-protected. Scraping and exposing full
  lyrics may violate site terms or copyright law in many jurisdictions. Do not
  ship scraping-enabled features without explicit legal review and licensing.

- Rate limits and abuse: Use caching, backoff, and request throttling. Avoid
  automated high-volume scraping of third-party sites.

- Attribution: When using scraped content, include source attribution and a
  clear UI hint that the content was scraped and may be inaccurate.

- Fallbacks: Treat scraped lyrics as best-effort; prefer licensed sources
  (Musixmatch, official APIs) and fall back to AI-generated drafts or user
  pasted LRCs.

- Opt-in: Expose scraping only behind a feature flag or admin setting. Do not
  enable it by default for public deployments.

Implementation notes:
- A minimal scraper exists at server/src/services/genius.ts. It is fragile and
  intended only as a demonstration. Prefer official APIs or commercial
  integrations for production.

- If you plan to enable automatic scraping, add integration tests and a
  robust caching layer, and record all external requests for audit.
