# Scraping Guide

How to run, maintain, and extend the exercise data scrapers.

## Quick Reference

### Running scrapers

```bash
# Run all active scrapers + post-processing
npm run scrape

# Run a single scraper
node scripts/scrape-learnimprov.mjs
node scripts/scrape-improwiki.mjs
```

### Command-line flags

| Flag            | Scraper                | Effect                                   |
| --------------- | ---------------------- | ---------------------------------------- |
| `--force`       | learnimprov, improwiki | Bypass HTML cache, re-fetch from network |
| `--clear-cache` | learnimprov            | Delete progress cache before running     |

### Pipeline

`scrape-all.mjs` runs these steps in order:

1. `scrape-learnimprov.mjs` — fetch from learnimprov.com (CC BY-SA 4.0)
2. `scrape-improwiki.mjs` — fetch from improwiki.com (CC BY-SA 3.0 DE)
3. `normalize-tags.mjs` — deduplicate, filter low-use tags, remove blacklisted tags
4. `apply-inferred-tags.mjs` — merge curated tags from `src/data/inferred-tags.json`
5. `cleanup-scraped-data.mjs` — extract clean HTML from raw, filter non-exercises, report missing summaries

Summaries are generated on-demand by Claude, not by a script.

### Post-processing scripts (standalone)

```bash
node scripts/normalize-tags.mjs        # Re-normalize tags from rawTags
node scripts/apply-inferred-tags.mjs   # Re-apply curated inferred tags
node scripts/cleanup-scraped-data.mjs   # Re-clean descriptions
```

---

## Architecture

### Data flow

```
Source site
  → fetchPage() with retry + HTML cache (.scrape-cache/)
  → Parse HTML with cheerio
  → Extract: id, name, description_raw, tags, sourceUrl
  → Write to src/data/{source}-exercises.json

Post-processing:
  → normalize-tags.mjs (clean tags from rawTags field)
  → apply-inferred-tags.mjs (merge curated tags from inferred-tags.json)
  → cleanup-scraped-data.mjs (extract clean description from description_raw)
```

### Shared utilities (`scraper-utils.mjs`)

All scrapers use these shared functions:

| Export                                                      | Purpose                                                  |
| ----------------------------------------------------------- | -------------------------------------------------------- |
| `fetchPage(url, retries, headers, cacheFile, forceRefetch)` | HTTP fetch with retry, exponential backoff, HTML caching |
| `sleep(ms)`                                                 | Rate limiting between requests                           |
| `loadCache(filename)` / `saveCache(filename, map)`          | Progress cache for resume on crash                       |
| `clearCache(filename)`                                      | Delete progress cache                                    |
| `loadExistingData(path)`                                    | Load existing JSON for incremental mode                  |
| `sanitizeTags(tags)`                                        | Remove whitespace, deduplicate                           |
| `deriveTagsFromContent(text, keywords)`                     | Tag extraction from description text                     |
| `standardTagKeywords`                                       | Shared tag keyword definitions                           |

### HTML caching

Raw HTTP responses are cached in `.scrape-cache/` (gitignored). This avoids
re-hitting source sites when iterating on parsing logic. Use `--force` to
bypass the cache and re-fetch from the network.

### Resume capability

Scrapers save progress to `.scrape-cache/{source}-progress.json` every 10
exercises. If a scrape is interrupted, re-running picks up where it left off.
Use `--clear-cache` to force a fresh start.

### Feature flags (learnimprov only)

```javascript
const ENABLE_PAGINATION = true; // Follow "Next Page" links on category indexes
const ENABLE_SITEMAP = true; // Check sitemap.xml for additional exercise URLs
```

These supplement the primary WordPress REST API approach. Pagination and sitemap
URLs are merged with API results and deduplicated.

---

## How each scraper works

### learnimprov.com

**Index method**: WordPress REST API (`/wp-json/wp/v2/posts?categories={id}`)

1. Fetches WordPress category and tag ID→name mappings via API
2. For each category (`warm-up`, `exercise`), fetches all posts via paginated API
3. For each post, fetches the full HTML page for `description_raw`
4. Optionally checks sitemap.xml and pagination for coverage gaps
5. Deduplicates exercises that appear in multiple categories (merges tags)

**Categories scraped**: `warm-up`, `exercise`
**Deliberately excluded**: handles, long-forms, ask-fors (different content types)

**Rate limiting**: 1 second between page fetches, 500ms between API calls

### improwiki.com

**Index method**: HTML index pages

1. Fetches index pages (`/en/improv-exercises`, `/en/improv-games`, etc.)
2. Extracts exercise links from the HTML
3. For each link, fetches the full page for `description_raw`
4. Filters out non-exercise content (groups, theaters, glossary entries)

**Rate limiting**: 500ms between fetches

---

## Adding a New Source

### 1. Pre-check

Before writing any code:

- [ ] **License**: Must be CC-licensed, public domain, or explicitly open
- [ ] **robots.txt**: Check and respect disallowed paths
- [ ] **Data quality**: Exercises should have descriptions, not just titles
- [ ] **Overlap**: Check for duplicates with existing sources

### 2. Investigate index URLs

Try in order of preference:

| Method             | How to test                                     | Reliability                         |
| ------------------ | ----------------------------------------------- | ----------------------------------- |
| WordPress REST API | `curl -sI https://site.com/wp-json/wp/v2/posts` | Best — structured JSON, pagination  |
| Sitemap            | `curl -s https://site.com/sitemap.xml`          | Good — comprehensive coverage       |
| RSS/Atom feed      | `curl -s https://site.com/feed/`                | Limited — usually only recent posts |
| HTML scraping      | Manual inspection                               | Fragile — breaks on redesign        |

### 3. Create the scraper

Copy the closest existing scraper as a starting point. Every scraper must have:

- **Rate limiting**: 500ms+ between requests (`sleep(FETCH_DELAY_MS)`)
- **Retry logic**: Use `fetchPage()` from scraper-utils (retries 3x with backoff)
- **Resume capability**: `loadCache`/`saveCache` every 10 exercises
- **Respectful headers**: Use `fetchPage()` which sets browser-like User-Agent
- **Attribution metadata**: Include source, license, licenseUrl, scrapedAt

### 4. Register it

Add to `scrape-all.mjs`:

```javascript
const SCRAPER_SCRIPTS = [
  // ... existing scrapers
  { file: 'scrape-newsource.mjs', label: 'newsource.com' },
];
```

Add to `cleanup-scraped-data.mjs` DATA_FILES array.

### 5. Document

- Add license details to `LICENSE-DATA`
- Add source entry to the Scraped Data section of `CLAUDE.md`

---

## Disabled sources

These scrapers exist but are commented out in `scrape-all.mjs`:

| Script                          | Source                 | Why disabled                                        |
| ------------------------------- | ---------------------- | --------------------------------------------------- |
| `scrape-improvencyclopedia.mjs` | improvencyclopedia.org | "Free for non-commercial use" — not an open license |
| `import-improvdb.mjs`           | ImprovDB (GitHub)      | No LICENSE file in repo                             |

Contact the respective site owners before enabling.

---

## Error handling

- **Network errors**: `fetchPage()` retries 3 times with exponential backoff
- **404 errors**: Exercise skipped, scraping continues
- **Cache errors**: Warning logged, scraper continues without cache
- **Sitemap errors**: Warning logged, falls back to API/HTML scraping

---

## Anti-patterns

- Scraping without checking robots.txt or license
- No rate limiting (hammering servers)
- No caching (re-fetching everything on every run)
- Missing attribution metadata
- Hardcoding pagination page numbers instead of detecting them

---

## Working with exercise tags

**CRITICAL PRINCIPLE**: Always research domain-specific improv terminology before
making decisions about tags. Many terms that seem generic or meaningless are
actually established pedagogical categories.

### Before removing or renaming tags

1. **Research first** — Use WebSearch/WebFetch to look up the tag in context
   - Search: `improv "[tag]" exercises learnimprov improwiki`
   - Check: learnimprov.com, improwiki.com, improvencyclopedia.org
2. **Verify meaning** — Determine if it's a legitimate category or truly generic
3. **Document findings** — Add comments in cleanup scripts explaining the decision

### Examples of tags that seemed generic but were legitimate

- **"problem"** → "problem-solving" (learnimprov category for ensemble/teamwork exercises)
- **"less"** → "restraint" (learnimprov category for minimalist/simplicity-focused exercises)
- **"group"** → Keep as-is (ImprovWiki/Encyclopedia category for ensemble participation)

### Truly generic tags to remove

- **"exercise"** — Too broad, applies to almost everything
- **"game"** — Redundant (anything not tagged "warm-up" is implicitly a game)
- **"other"** — Not descriptive

### Tag normalizations

- Singular/plural: prefer the form most commonly used in the data
- Verify both forms aren't distinct categories before consolidating

---

## Inferred tags

Some tags can't come from source data — they represent improv concepts that
exercises teach but that source sites don't categorize. These are curated in
`src/data/inferred-tags.json` and applied by `apply-inferred-tags.mjs`.

### Current inferred tags

- **heightening** — Sequential amplification of a pattern. Indicators: each
  player amplifies the previous contribution, emotional intensity scaling,
  progressive escalation, "build on what came before" mechanics.
- **grounding** — Making scenes feel real and justified. Indicators: establishing
  base reality, justifying unusual choices, emotional truth, character depth,
  detailed physical environment creation.
- **game of the scene** — Finding and playing the emergent comedic pattern (UCB
  concept). Distinct from short-form "games" where rules are given externally.
  Indicators: pattern-building, "if this is true what else is true", organic
  emergence of comedy from base reality.

### Adding new inferred tags

1. Research the concept thoroughly
2. Define clear indicators and counter-indicators
3. Classify exercises by reading descriptions and summaries
4. Add the tag definition and exercise IDs to `inferred-tags.json`
5. Run `node scripts/apply-inferred-tags.mjs` to apply

**Inferred tags survive re-scraping** — they live in a separate file and are
merged after normalization. The script warns about exercise IDs that no longer
exist in the data.

---

## Data quality checks

When reviewing scraped data, watch for:

### Non-exercise content (EXCLUDE ENTIRE ENTRY)

- Improv groups, theaters, or organizations
- Tutorial articles or blog posts
- General improv theory/philosophy
- **Action:** Filter out by checking tags like "improv groups", "theater", "theatre"
- **Where:** Individual scrapers filter entries before adding to dataset

### Unhelpful tags (REMOVE TAG ONLY, KEEP EXERCISE)

- "other" — too generic
- "exercise" — redundant
- "game" — too broad
- Tags used by fewer than 3 exercises (noise)
- **Action:** Strip these tags, keep the exercises
- **Where:** `normalize-tags.mjs` removes blacklisted + low-usage tags

### Missing or low-quality content

- Empty descriptions
- Descriptions that are just the title repeated
- License footers or site navigation scraped as content
- **Where:** `cleanup-scraped-data.mjs` removes noise sections

### Duplicates

- Same exercise under different names
- Check `alternativeNames` field for known synonyms
- **Handle manually** if discovered (merge entries, update IDs)

---

## AI-Generated Concise Descriptions

Scraped exercise descriptions are verbose (median ~1000-1600 chars, some 5000+)
and poorly formatted for mobile. The `generate-descriptions.mjs` script uses
Claude to rewrite them into concise, mobile-friendly versions while preserving
the original text.

### How it works

**Field layout on Exercise:**

| Field                 | Content                                            |
| --------------------- | -------------------------------------------------- |
| `description`         | Concise AI-generated description (light HTML)      |
| `descriptionOriginal` | Full scraped description (preserved for reference) |
| `description_raw`     | Original HTML from source before cleaning          |

The script renames `description` to `descriptionOriginal` (idempotent), then
generates a new `description` using the Anthropic API.

### Running the generator

```bash
# Rename only (no API calls) — useful to verify field layout
node scripts/generate-descriptions.mjs --rename-only

# Generate for all exercises (requires ANTHROPIC_API_KEY)
node scripts/generate-descriptions.mjs --format html

# Sample mode — generate 5 per source for review
node scripts/generate-descriptions.mjs --sample --format both

# Dry run — show what would be generated without calling the API
node scripts/generate-descriptions.mjs --dry-run

# Compare mode — write both plain and HTML to temporary fields for UI review
node scripts/generate-descriptions.mjs --compare --sample
```

### Format chosen: Light HTML

After comparing plain text and light HTML side by side in the app, light HTML
was chosen for its scannability on mobile. The format is:

- A brief intro sentence in a `<p>` tag
- Key steps as a short `<ol>` or `<ul>` (3-5 items max)
- Total length: 300-600 characters
- Allowed tags: `<p>`, `<ol>`, `<ul>`, `<li>` only (sanitized)

### Generation parameters

| Parameter   | Value                       | Rationale                              |
| ----------- | --------------------------- | -------------------------------------- |
| Model       | `claude-haiku-4-5-20251001` | Fast, cheap (~$0.10 for 317 exercises) |
| Temperature | 0.3                         | Consistent, factual output             |
| Batch size  | 5 parallel requests         | Respects rate limits                   |
| Batch delay | 1000ms                      | Avoids throttling                      |
| Max tokens  | 1024                        | More than enough for concise output    |

### What the prompt emphasizes

The system prompt instructs the model to:

1. **Preserve player formation and setup details** — circle, line, pairs, stage
   positions, who leaves/enters the room, any special spatial arrangement. These
   are critical for a session leader to run the exercise.
2. **Not repeat the exercise name** — the app already displays it prominently.
3. **Not duplicate the summary** — the app shows a separate one-line summary.
4. **Use only allowed HTML tags** — output is sanitized as a safety belt.

### Short description threshold

Exercises with descriptions under 150 characters (plain text after stripping
HTML) are kept as-is — they're already concise enough. This avoids AI-inflating
already-brief descriptions.

### Re-running after a re-scrape

If exercises are re-scraped, descriptions will need regenerating:

1. The scraper overwrites `description` and `description_raw`
2. `descriptionOriginal` is NOT overwritten (it was renamed, not a scraper field)
3. Run `generate-descriptions.mjs --format html` again
4. The script detects `descriptionOriginal` already exists and skips the rename
5. New AI descriptions are generated from the (now updated) `descriptionOriginal`

**Caveat:** If a re-scrape adds new exercises, those won't have
`descriptionOriginal` yet. The script handles this — it renames `description` to
`descriptionOriginal` for any exercise that doesn't already have the field.

### Licensing implications

AI-rewritten descriptions are "adaptations" under CC BY-SA. The original
content's license (CC BY-SA 4.0 for learnimprov, CC BY-SA 3.0 DE for improwiki)
still applies. The `attribution.modified` field in each JSON file and
`LICENSE-DATA` must note that descriptions were AI-rewritten. The original text
is preserved in `descriptionOriginal` for attribution compliance.
