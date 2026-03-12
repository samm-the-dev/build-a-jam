# Build-a-Jam - Claude Context

## Universal Guidance

<!-- @import: Claude Code includes this file's content -->

@.toolbox/ai-context/CLAUDE.md

> _[View shared context](.toolbox/ai-context/CLAUDE.md) — git practices, testing, PR workflows, accessibility_

---

**Project-specific context below:**

## Project Purpose

Build-a-Jam is both a **functional tool** and a **learning project**:

- **Primary goal**: Help improv performers find and organize warm-up exercises
- **Secondary goal**: Serve as a hands-on learning project for transitioning from Angular to React

## Target Platform

**Mobile-first design**: This app is primarily used on phones and tablets during
improv practice sessions. Design decisions should prioritize:

- Touch-friendly tap targets (no hover-dependent interactions as primary UX)
- Vertical space efficiency (every pixel counts on mobile)
- Simple, scannable layouts over information density
- Keyboard shortcuts are nice-to-have, not essential

When evaluating features, ask: "Does this help someone running a session on their phone?"

## Developer Context

**User background**: Experienced Angular developer learning React for job opportunities

**Learning approach**: The user learns best by:

- Building real features (not just reading concepts)
- Seeing Angular vs React pattern comparisons
- Understanding the "why" behind React's design decisions

**Topics covered so far**:

- JSX, components, props, state (`useState`)
- Events, lists, conditional rendering
- Lifting state up pattern
- `useEffect` (side effects, lifecycle, intervals)
- Forms and controlled components
- `useReducer` + Context for shared state management
- Custom hooks (`useTemplateSaver`, `useTheme`, `useExerciseFilter`)
- `useRef` (synchronous flags, DOM refs for gesture handling)
- `useCallback` (stable callbacks in custom hooks)
- React Router (routes, params, navigation)
- localStorage persistence via async StorageProvider
- Third-party library integration (shadcn/ui, Radix UI, Sonner, Tiptap)
- Drag-and-drop with @dnd-kit (session queue reordering)
- Imperative DOM manipulation (swipe-to-dismiss gesture via refs)
- PWA features (install prompt, wake lock)
- Web Share API with clipboard fallback
- Testing with Vitest (unit tests for utilities)
- Deployment pipeline (GitHub Actions → GitHub Pages)

**Next topics to explore**:

- `useMemo` (performance optimization)
- Component testing (React Testing Library)

## Code Patterns & Conventions

### Component Structure

- **Functional components only** - no class components
- **TypeScript interfaces** for all props
- **Extensive comments** comparing Angular patterns to React equivalents
- **Descriptive variable names** - prioritize clarity over brevity

### State Management Philosophy

- Component-local state (`useState`) for UI concerns (tag filters, form inputs)
- `useReducer` + Context for shared workflow state (SessionContext)
- Async `StorageProvider` interface for persistence — localStorage today,
  Google Drive or other backends later
- No external state management library (Redux, Zustand) unless needed

### Styling Approach

- Tailwind CSS via `src/index.css` (PostCSS + autoprefixer)
- shadcn/ui for reusable primitives (Card, Badge, Dialog, AlertDialog, Sonner) — components live in `src/components/ui/`
- Light/dark theme via CSS custom properties + `useTheme` hook (`:root` = light, `.dark` = dark)

## Tech Stack Decisions

### Why React 19?

- Latest stable version with new features
- Modern hooks API is the standard
- Server Components available but not needed yet

### Why Vite over Create React App?

- Much faster dev server startup
- Better HMR (Hot Module Replacement)
- Lighter, more modern tooling
- CRA is no longer maintained

### Why TypeScript?

- User already familiar from Angular
- Catches errors early
- Better IDE support
- Industry standard for React apps

### Why Tailwind + shadcn/ui?

- Tailwind: utility-first, fast iteration, no separate CSS files to manage
- shadcn/ui: copy-paste component library (you own the code, can customize freely)
- Good balance of productivity and learning — no magic, just classes

## Development Workflow

### When adding new features:

1. **Explain the concept** - Compare to Angular equivalent
2. **Show the code** - Include inline comments
3. **Run and test** - Let user see it working
4. **Iterate** - Encourage experimentation

### Code comments should:

- Compare Angular patterns to React patterns
- Explain WHY React does things differently
- Link concepts to learning objectives
- Don't over-explain basic JavaScript/TypeScript

### Branch protection

`main` has branch protection — direct pushes are blocked. **Always create a
feature branch before committing.** Never commit to `main` locally.

### Git commits should:

- Be descriptive about what was learned
- Include "Co-Authored-By: Claude <noreply@anthropic.com>"
- Atomic commits per feature/concept

### PR workflow

PR review, Copilot triage, wrap-up checklist, and accessibility guidelines are in
the imported guidance above.

**Project-specific CI:** Accessibility audit runs via `npm run audit:a11y`.

## Important Context

### This is a learning project

- **Prioritize educational value** over production optimization
- **Add comments liberally** - they're teaching tools
- **Show alternatives** - mention different ways to solve problems
- **Encourage experimentation** - suggest modifications user could try

### Application flow

The app follows a three-stage **Prep → Session → Notes** structure that mirrors
how an actual improv practice session works.

**Routes:**
| Path | Component | Purpose |
|---|---|---|
| `/` | `HomePage` | Browse/filter exercise library |
| `/prep` | `PrepPage` | Build a session queue |
| `/session/:id` | `SessionPage` | Run through exercises with timer |
| `/notes/:id` | `NotesPage` | Post-session reflections |
| `/favorites` | `FavoritesPage` | Starred exercises and saved templates |
| `/history` | `HistoryPage` | Past completed sessions |
| `/credits` | `CreditsPage` | Licensing & attribution |

**1. Prep Screen** (`/prep`)

- Add exercises from the library to a session queue
- Set duration per exercise (duration lives on `SessionExercise`, not on
  `Exercise` — the same exercise can be 5 min or 15 min depending on context)
- Add breaks between exercises
- Drag-and-drop reorder via @dnd-kit
- See total session time estimate
- Save session as template (reusable from Favorites page)

**2. Session Screen** (`/session/:id`)

- Current exercise name and instructions displayed prominently
- Timer counting up with target duration
- "Next Exercise" button to progress through the queue
- Progress bar (e.g. "Exercise 3 of 7")
- Pause/resume functionality
- Collapsible queue panel with live editing (add, remove, reorder, add breaks)

**3. Notes Screen** (`/notes/:id`)

- List of exercises that were run
- Free-text area for post-session reflections (what worked, what didn't)
- Save to session history (persisted in localStorage)
- Future: star rating, "worked well" / "need to revisit" tags

**State management:** SessionContext (`useReducer` + React Context) holds the
current session, exercise queue, and history. All state persists to localStorage
via an async `StorageProvider` abstraction (can be swapped for Google Drive
or other backends later).

### Data model

See `src/types.ts` for the full type definitions. Key types:

- **`Exercise`** — library item: name, tags, description, optional
  `alternativeNames`, `isCustom` flag. No duration (that's context-dependent).
  IDs are prefixed by source (e.g. `learnimprov:zip-zap-zop`,
  `improwiki:new-choice`, `custom:my-exercise-a1b2`).
- **`SessionExercise`** — an exercise placed in a session queue with a
  duration, order, `slotId` (for drag-and-drop stability), and optional notes.
- **`Session`** — ordered list of `SessionExercise` items. Can be a one-off
  plan or a reusable template (`isTemplate`).
- **`CompletedSession`** — what actually happened, with post-session notes.

### Improv exercise context

Common tags for exercises (from source data, applied by `normalize-tags.mjs`):

- **warm-up** - Ice breakers, energy builders, group focus
- **environment** - Building physical locations/settings (the "Where")
- **object work** - Miming and interacting with individual imaginary objects
- **characters** - Character creation, physicality, voices
- **listening** - Agreement, "yes and", paying attention
- **teamwork** - Ensemble participation, group awareness, trust
- **problem-solving** - Teamwork and lateral thinking
- **accepting** - "Yes, and" — receiving and building on offers
- **focus** - Concentration, attention exercises

Inferred tags (curated in `src/data/inferred-tags.json`, applied by
`apply-inferred-tags.mjs`):

- **heightening** - Sequential amplification of a pattern; "do it again, but more"
- **grounding** - Making scenes feel real, justified, emotionally true; base reality
- **game of the scene** - Finding and playing the emergent comedic pattern (UCB concept)

### Future feature ideas

- Random exercise selector (fun utility feature)
- Import/export exercises (teaches file handling)
- Google Drive sync (teaches OAuth, async storage backends)
- Star ratings on completed exercises (teaches forms, data enrichment)
- "Worked well" / "need to revisit" tags on session notes

## Licensing

The project uses a **dual-license** structure:

- **Application code** (`.ts`, `.tsx`, `.mjs`, `.css`, configs): **MIT License** — see `LICENSE`
- **Exercise data** (`src/data/*.json`): sourced from third parties under their own licenses — see `LICENSE-DATA`

The CC BY-SA ShareAlike obligation applies only to the exercise data, not to
the application code. Displaying CC BY-SA content in an app is a "collection",
not an "adaptation", so the app code stays MIT.

## Scraped Data & Attribution

Exercise data in `src/data/learnimprov-exercises.json` is scraped from
[learnimprov.com](https://www.learnimprov.com/) and licensed under
**[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)**.

When working with this data you **must**:

- **Preserve attribution** — keep the `attribution` block in the JSON intact.
  Every exercise also carries a `sourceUrl` back to its original page.
- **Note changes** — each exercise JSON file has a single
  `attribution.modified` string (e.g. `"2026-01-31: Cleaned descriptions,
normalized tags"`). The cleanup script regenerates this automatically.
  Before committing, review this field to make sure it accurately describes
  the transformations that were applied. If you made additional manual changes
  (e.g. rewrote descriptions, added summaries), update the string to reflect
  that.
- **ShareAlike** — any file that contains adapted material must remain under
  CC BY-SA 4.0 (or a compatible licence). Do not re-licence scraped content
  under a more restrictive terms.
- **Keep `LICENSE-DATA`** — the repo-level `LICENSE-DATA` file documents these
  obligations. Do not remove it.

Exercise data in `src/data/improwiki-exercises.json` is scraped from
[improwiki.com](https://improwiki.com/en) and licensed under
**[CC BY-SA 3.0 DE](https://creativecommons.org/licenses/by-sa/3.0/de/deed.en)**.
The same rules above (preserve attribution, note changes, ShareAlike) apply.
CC BY-SA 3.0 DE is forward-compatible with CC BY-SA 4.0.

**Disabled sources** (scraper scripts exist but are commented out in
`scrape-all.mjs` until licensing is resolved):

- **improvencyclopedia.org** — "free for non-commercial use", not an open
  license. Contact site owner before enabling.
- **ImprovDB** (github.com/aberonni/improvdb) — no LICENSE file in repo.
  Contact developer before enabling.

### Scraper scripts

Run `npm run scrape` to execute active scrapers via `scripts/scrape-all.mjs`.
Individual scrapers can also be run directly with `node scripts/<name>.mjs`.

| Script                          | Source                 | Output                              | Status   |
| ------------------------------- | ---------------------- | ----------------------------------- | -------- |
| `scrape-learnimprov.mjs`        | learnimprov.com        | `learnimprov-exercises.json`        | Active   |
| `scrape-improwiki.mjs`          | improwiki.com          | `improwiki-exercises.json`          | Active   |
| `scrape-improvencyclopedia.mjs` | improvencyclopedia.org | `improvencyclopedia-exercises.json` | Disabled |
| `import-improvdb.mjs`           | ImprovDB (GitHub)      | `improvdb-exercises.json`           | Disabled |

See `LICENSE-DATA` for full licensing details per source.

### Working with scraped data

See **[scripts/SCRAPING-GUIDE.md](scripts/SCRAPING-GUIDE.md)** for the complete
scraping reference: running scrapers, architecture, tag handling, inferred tags,
data quality checks, and adding new sources.

## Things to Avoid

- Don't add complex state management too early
- Don't over-engineer - keep it simple
- Don't skip explaining concepts that differ from Angular
- Don't use class components (unless specifically teaching them)
- Don't add dependencies without explaining why
- Don't sacrifice clarity for brevity in teaching comments

## Things to Emphasize

- Functional programming concepts
- React's unidirectional data flow
- How React differs from Angular's two-way binding
- Why immutability matters
- Component composition patterns
- Hooks and their rules

## Communication Style

When working with this user:

- Be encouraging but not over-the-top
- Technical and clear
- Compare to Angular when relevant
- Explain design decisions
- Suggest experiments they could try
- Balance teaching with doing

## Questions to Ask

When user requests a feature, consider asking:

- "Would you like me to explain the concept first, or dive straight into code?"
- "Want to see the Angular equivalent of this pattern?"
- "Should we refactor this later, or is it good enough for learning?"

## Success Metrics

User is learning well when they:

- Understand WHY React does things differently from Angular
- Can explain hooks and component patterns
- Feel confident experimenting on their own
- Start thinking in "React patterns"
- Build features independently

This is a journey from Angular to React proficiency. Keep it practical, hands-on, and fun!
