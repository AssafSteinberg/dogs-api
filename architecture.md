# Architecture — Dog Breed Explorer

Status: Draft v3 (in sync with `PRD.md` Draft v4) · Date: 2026-11-05 · Companion to `PRD.md` (requirement IDs such as FR-D-1a refer to it).

This document records the key implementation decisions. Items marked **[Decision]** were chosen here and are open to change before `tasks.md` is written.

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| UI | React 19 + Vite 8 (already scaffolded) | Required by the project |
| Language | TypeScript 7, `strict: true` | PRD: strictly TypeScript, no `any` |
| Routing | `react-router` (current major, declarative `<BrowserRouter>`) | Required: expansion lives in the URL |
| Server data | Own small hooks + module-level cache | Only two read-only GET endpoints; a data library would be heavier than the problem |
| App state | React Context + `useReducer` | Pack and Wishlist are small, synchronous and shared across pages |
| Persistence | `localStorage`, versioned keys | No backend allowed; sufficient for IDs only |
| Validation | Hand-written type guards at the API and storage boundaries **[Decision]** | Two tiny shapes; avoids adding a validation dependency |
| Styling | CSS Modules (built into Vite) + CSS variables | No UI library; scoped styles; responsive without extra tooling |
| Lint | Oxlint (already configured) | Add `typescript/no-explicit-any` as `error` |
| Async code | `async`/`await` only | Required: no `new Promise(...)` and no `.then()`/`.catch()` chains (see 6.1) |
| Tests | Vitest + `@vitest/ui` + React Testing Library + jsdom | Logic tests and UI tests in one runner; the UI dashboard (`@vitest/ui`) is for inspecting runs (section 10) |

### TypeScript and lint settings to apply
- `tsconfig.app.json`: add `"strict": true` explicitly (it is not set today) and `"noUncheckedIndexedAccess": true`.
- Keep `erasableSyntaxOnly: true` (already on): **no enums, no namespaces, no constructor parameter properties**. Use string-literal unions and plain objects.
- `.oxlintrc.json`: add `"typescript/no-explicit-any": "error"`, and the Oxlint promise rule that prefers `await` over `.then()` if the installed Oxlint version provides it; otherwise the async/await rule is enforced in review.
- API and `localStorage` data enters as `unknown` and is narrowed by guards; nothing is cast with `as` to a domain type.

## 2. Domain model

The API speaks in breeds and sub-breeds; the UI works with **leaves** (PRD FR-M-1): a sub-breed, or a breed that has no sub-breeds.

```ts
type LeafId = string & { readonly __brand: 'LeafId' }   // "hound/afghan" or "akita"

interface Leaf {
  id: LeafId
  breed: string        // API key, lowercase: "hound"
  sub: string | null   // API key: "afghan", or null for a breed without sub-breeds
}
```

- **The LeafId is also the URL path and the API path.** `hound/afghan` maps to `/breeds/hound/afghan` in the app and `/breed/hound/afghan/images/random` in the API; `akita` maps to `/breeds/akita` and `/breed/akita/images/random`. One identifier, three uses.
- The same ID is what the Pack and Wishlist store (PRD FR-U-2).
- **Display:** the name is the capitalised `sub` (or `breed` when `sub` is null) and the **tag** is the capitalised `breed`, shown only when `sub !== null` (FR-M-2). Display strings are derived in one module, never stored.
- Brand helpers (`toLeafId`, `parseLeafId`) are the only place that builds or splits a `LeafId`.

### Flattening
`/breeds/list/all` returns `{ message: Record<string, string[]>, status }`. A pure function `flattenBreeds(record): Leaf[]` produces the 165 leaves ordered by breed, then sub-breed (FR-M-3). It also returns an index `Map<LeafId, Leaf>` for O(1) lookups by URL, Pack and Wishlist.

## 3. Folder structure

```
src/
  main.tsx                      createRoot + <BrowserRouter>
  app/
    App.tsx                     providers + routes
    AppLayout.tsx               sidebar + <Outlet/>, banners
  api/
    dogApi.ts                   fetchBreedList(), fetchRandomImage(leaf)
    guards.ts                   parseBreedList(unknown), parseImageResponse(unknown)
    errors.ts                   ApiError (network / http / shape)
  domain/
    leaf.ts                     Leaf, LeafId, flattenBreeds, display helpers
  state/
    storage.ts                  safe localStorage read/write + schema versioning
    collection.tsx              CollectionProvider (pack + wishlist)
    reducer.ts                  pure reducer + actions
    notifications.tsx           NotificationsProvider + useNotify() (red pop-ups)
  features/
    breeds/
      BreedsProvider.tsx        loads the list once; exposes leaves + index + status
      BreedsPage.tsx            reads route params + query, owns the "expanded" decision
      BreedsToolbar.tsx         filter input + sort direction control
      listView.ts               pure: applyFilterAndSort(leaves, query, direction)
      BreedList.tsx
      BreedItem.tsx             one row: name, tag, toggle button
      BreedDetails.tsx          image + actions
      useBreedImage.ts          per-leaf image hook with session cache
    pack/PackPage.tsx
    wishlist/WishlistPage.tsx
  components/
    Sidebar.tsx                 collapsible nav
    Tag.tsx
    ApiStatus.tsx               Loading / Failed / Done indicator
    AsyncState.tsx              loading / failed + retry
    Toast.tsx                   red pop-up rendered by NotificationsProvider
  styles/                       global.css, variables.css
tests/                          Vitest tests (see section 10)
  setup.ts                      jest-dom matchers, fetch mock helpers
  fixtures/                     small copies of real API responses
```

Rules: `domain/` and `api/` import no React; `features/` may import from `domain`, `api`, `state` and `components`, never from another feature; `state/reducer.ts` is pure.

## 4. Routing

Declarative `react-router` with a single layout route:

```
<BrowserRouter>
  <Routes>
    <Route element={<AppLayout />}>
      <Route index element={<Navigate to="/breeds" replace />} />
      <Route path="breeds/:breed?/:sub?" element={<BreedsPage />} />
      <Route path="pack" element={<PackPage />} />
      <Route path="wishlist" element={<WishlistPage />} />
      <Route path="*" element={<Navigate to="/breeds" replace />} />
    </Route>
  </Routes>
</BrowserRouter>
```

- The optional params make `/breeds`, `/breeds/:breed` and `/breeds/:breed/:sub` one route, so the list stays mounted and its scroll position is kept when only the expansion changes.
- `/breeds/hound` is a valid *route* but not a valid *leaf* (hound has sub-breeds); the page resolves it the same way as any unknown ID (below).
- Sidebar links use `<NavLink>`; the Breeds link points to `/breeds` and stays active for every `/breeds/...` URL (`end` is not set).
- **Hosting requirement:** browser-history routing needs the host to serve `index.html` for unknown paths. Vite dev and `vite preview` do this by default; the production host is not chosen yet (PRD open item) and must support it.

## 5. Expansion logic (FR-D-1, 1a, 1b, 6)

The URL is the single source of truth. There is **no `expanded` React state**.

1. `BreedsPage` reads `{ breed, sub }` from `useParams()` and builds a candidate ID.
2. It looks the candidate up in the leaf index.
   - Found → that leaf is *expanded*.
   - No params → nothing is expanded.
   - Params but not found → nothing is expanded and the red pop-up (6.5) names the missing element, e.g. `"hound/nothing" was not found` (FR-D-1b). The pop-up is shown once per URL.
   - List not loaded yet → the loading state is shown; lookup happens after the load.
3. `BreedItem` renders a `<button aria-expanded aria-controls>`. Clicking it calls `navigate('/breeds/<id>')` to expand, or `navigate('/breeds')` when it is already the expanded one. Because `navigate` pushes history entries, back/forward step through expansion states (acceptance criterion 3).
4. When the expanded leaf changes (including the first render from a deep link), an effect calls `scrollIntoView({ block: 'nearest' })` on its row.
5. Only one leaf can match the URL, so only one row is expanded at a time (FR-D-6).

Because the `BreedDetails` of a collapsed row is not rendered, no image is requested until a row is expanded (FR-D-2).

## 5A. Sorting and filtering the master list (FR-M-5 to FR-M-8)

A toolbar above the list (`BreedsToolbar`) has a **filter text box** and a **sort direction toggle** (A→Z / Z→A). Both apply only to the Breeds page.

- **State lives in the query string**, next to the path that holds the expansion: `/breeds/hound/afghan?q=ha&sort=desc`. Defaults (`q` empty, `sort=asc`) are omitted from the URL. This keeps the view shareable and reload-safe, and it uses the same "URL is the source of truth" rule as section 5. **[Decision]**
- **Filter:** a case-insensitive "contains" match, with the text trimmed, against the leaf's breed name *and* its sub-breed name. Typing `hound` therefore keeps every hound sub-breed, and typing `afg` keeps `hound / afghan`. An empty filter shows everything. The list shows a count ("12 of 165") and a "No breeds match" message when empty, with a clear button.
- **Sort:** by **breed name**, ascending or descending, using `localeCompare`. Leaves of the same breed stay together (FR-M-3), and their sub-breeds are ordered in the same direction. A breed without sub-breeds sorts among the breeds by its own name.
- **Order of operations:** filter first, then sort, in one pure function `applyFilterAndSort(leaves, query, direction): Leaf[]` (`listView.ts`), memoised on its three inputs.
- **Typing does not create history entries:** filter changes use `navigate(..., { replace: true })` (debounced a short moment), while expanding a row pushes an entry as before. Sort toggling replaces too.
- **Expansion and filtering interact:** clicking a row keeps the current `?q=&sort=` (the navigation helper always carries the query string). If a deep link expands a leaf that the filter hides, that leaf is **pinned**: it stays visible, expanded, at its sorted position, so a shared link never appears broken.
- The toolbar is disabled while the list is loading or failed.

## 6. Data layer

### 6.1 API client (`api/dogApi.ts`)
- **Async/await only.** Every API function is an `async` function that `await`s `fetch` and `response.json()`, and errors are handled with `try/catch/finally`. There is no `new Promise(...)` and no `.then()`/`.catch()` chaining anywhere in the code base. Callers (hooks) also use `async` functions inside effects; effects themselves stay synchronous and start an `async` function.
- Base URL constant `https://dog.ceo/api`. Calls use `fetch` directly and take an `AbortSignal`.
- Every response is read as `unknown` and passed through a guard in `guards.ts`:
  - Breed list: `status === 'success'` and `message` is an object whose values are arrays of strings.
  - Image: `status === 'success'` and `message` is a string URL.
- Failures are normalised into one `ApiError` with a `kind`: `'network' | 'http' | 'shape'`. The Dog CEO 404 JSON body (unknown breed) becomes `kind: 'http'` with the status code.
- Image endpoint is chosen from the leaf: `sub` present → `/breed/{breed}/{sub}/images/random`; otherwise `/breed/{breed}/images/random`. **A sub-breed must never use the breed endpoint**, because that returns a random sub-breed's image (PRD section 5).

### 6.2 Breed list (`BreedsProvider`)
- Fetched once when the app mounts (not per page), so the Breeds, Pack and Wishlist pages share it and a refresh on `/pack` still works.
- Exposes `{ status: 'loading' | 'failed' | 'done', leaves, index, retry }`. These three values are the app-wide **API call status** vocabulary (6.4).
- The request is aborted on unmount. In development, React `StrictMode` runs effects twice; the aborted first request must not surface as an error.
- On failure it calls `notify` (6.5) in addition to showing the inline error with Retry.

### 6.3 Random image (`useBreedImage`)
- A module-level `Map<LeafId, string>` holds resolved URLs for the session; a second `Map<LeafId, Promise<string>>` de-duplicates in-flight requests (the stored value is the promise returned by the `async` fetch function, which is awaited by every caller). Together they satisfy FR-D-4: the first expand fetches, later expands reuse the same image, and a double effect run does not fetch twice.
- Hook state: `{ status: 'loading' | 'failed' | 'done', url, retry }`. A failed fetch is *not* cached, so retry makes a new request (FR-D-5).
- The cache is intentionally in memory only: a page reload gives a new random image, and no image data is ever stored (FR-U-2).
- **Failure messages name the breed.** Both failure paths, the API request failing and the `<img>` `onError` (the URL resolved but the file would not load), show the same message built from the display name: `Couldn't load an image of Afghan (hound)` for a sub-breed, or `Couldn't load an image of Akita` for a breed without sub-breeds, with a Retry button. The `<img>` `alt` text uses the same name.

### 6.4 API call status indicator (FR-D-8)
- Every API-backed region shows its status with the shared `ApiStatus` component, which renders one of three visible states, each with an icon, a text label and a colour (never colour alone):

| Status | Label | Look |
|---|---|---|
| `loading` | Loading… | Spinner, neutral colour |
| `failed` | Failed | Cross, red |
| `done` | Done | Check mark, green |

- Where it appears: (a) a small badge in the Breeds toolbar for the breed-list call, (b) a badge inside each expanded row's details for that row's image call. `done` stays visible briefly (about 2 s) and then fades to a quiet check mark so it does not clutter the list; `loading` and `failed` remain until the state changes.
- The component is announced to assistive technology through `role="status"` (`aria-live="polite"`), so the three states are not only visual.

### 6.5 Unreachable-API notification (red pop-up) (FR-D-9, FR-D-10)
- `state/notifications.tsx` provides `NotificationsProvider` and `useNotify()`. A notification is `{ id, kind: 'error', source: 'api' | 'route', message }`.
- `Toast` renders the active notifications as a **red pop-up fixed to the bottom of the screen**, centred, full width minus a gutter on narrow screens. It has `role="alert"` and a dismiss (×) button, and it does not cover the sidebar toggle.
- **When it fires:** when an API call fails with `kind: 'network'` (cannot reach the API), `'shape'` (unusable response) or an `'http'` status of 5xx. Message example: `Can't reach the dog.ceo API. Check your connection and try again.` An `'http'` 404 for one breed's image is *not* an outage; it shows only the inline message from 6.3.
- Repeated failures are **de-duplicated** by message, so ten failing image calls show one pop-up. It stays until dismissed or, for `source: 'api'` only, until a later API call succeeds, which clears it. `source: 'route'` pop-ups clear when the URL changes.
- The same component is used for the unknown-URL message (section 5, FR-D-1b) with a different message; it is the app's single pop-up mechanism.

## 7. Application state and persistence

### 7.1 Stored shape
One `localStorage` key, prefixed with a schema version. There are no user profiles: the collection belongs to the browser.

```
dogs-api:v1:collection   → { pack: Record<LeafId, number>, wishlist: LeafId[] }
```

- `pack` is a **count per leaf**, not a list of entries **[Decision]**. This resolves PRD open question #3: the Pack page shows one row per leaf with its count, and "remove" decrements by one (FR-P-2, FR-P-3). Counts are integers ≥ 1; a count reaching 0 deletes the key.
- `wishlist` is an array used as an ordered set: adding an existing ID is a no-op (FR-W-1).
- Pack and Wishlist are independent: a leaf may be in both.

### 7.2 Provider
- `CollectionProvider` loads `dogs-api:v1:collection` once on mount. It uses a pure reducer (`state/reducer.ts`) with actions `addToPack(id)`, `removeFromPack(id)`, `addToWishlist(id)`, `removeFromWishlist(id)`, and writes through to storage after each change (FR-U-1).
- Components read through narrow hooks (`usePack()`, `useWishlist()`), not the raw context.
- There is no sign-in step or gate: the app renders the requested URL immediately, so deep links always work.

### 7.3 Storage safety (FR-U-3, FR-U-4)
`state/storage.ts` is the only code that touches `localStorage`:
- Every read and write is in `try/catch` (blocked storage, quota, private mode).
- Reads parse JSON as `unknown` and run guards. Invalid or unknown-version data is discarded and replaced with an empty value, never partially trusted.
- If storage is unavailable, the provider falls back to in-memory state and the UI shows a banner: "Your pack won't be saved in this browser" (PRD risk #7).
- A stored ID that is no longer in the breed index is kept in storage but rendered on its page as "No longer available" with a remove button; it is never passed to the image API.
- Cross-tab live sync via the `storage` event is out of scope; the other tab sees changes on its next load.

## 8. Components and responsibilities

| Component | Responsibility |
|---|---|
| `AppLayout` | Sidebar, `<main>` landmark, storage-unavailable banner |
| `Sidebar` | `<nav>` with `NavLink`s to Breeds, Pack, Wishlist; collapsible (8.1) |
| `BreedsPage` | Waits for the list, resolves the expanded leaf from the URL, applies filter/sort (5A), raises the not-found pop-up |
| `BreedsToolbar` | Filter box, sort toggle, result count, breed-list `ApiStatus` badge |
| `BreedList` / `BreedItem` | Renders the rows; the toggle button; the `Tag` when `sub !== null` |
| `BreedDetails` | Name, tag, image (`useBreedImage`), image `ApiStatus` badge, Add to Pack and Add to Wishlist |
| `PackPage` / `WishlistPage` | Lists stored leaves resolved through the index, remove actions, empty state with a link to `/breeds` |
| `ApiStatus` / `AsyncState` | Loading / Failed / Done indicator (6.4); inline failure + Retry |
| `Toast` | Red bottom pop-up for API-unreachable and unknown-URL messages (6.5) |

- **Buttons reflect state:** Add to Wishlist shows "On wishlist" (and offers remove) when the leaf is present (FR-W-4); the list rows show a small wishlist marker as well.
- **Performance:** 165 plain rows need no virtualisation. `BreedItem` is memoised and receives only primitive props plus an `expanded` boolean, so a URL change re-renders two rows, not 165.
- **Accessibility:** disclosure pattern (`button` with `aria-expanded` and `aria-controls` pointing at the details region), `<nav>`/`<main>` landmarks, `alt` text built from the display name, visible focus styles, and focus stays on the toggle after expand/collapse (FR-D-7). The image area reserves its size to avoid layout shift.

### 8.1 Layout and narrow screens (FR-NAV-3)
The app must be fully usable from about 320 px wide up.

- **Layout:** a CSS grid with two areas, sidebar and main. Wide screens (above 768 px) show the sidebar as a column beside the content. Narrow screens (768 px and below) turn the sidebar into an **overlay drawer** over the content, with a slim top bar that holds the toggle button and the app name.
- **Collapsible sidebar:** a toggle button (`aria-expanded`, `aria-controls` the nav, labelled "Collapse menu" / "Expand menu") collapses and expands it on every screen size. **The default is expanded.** The state is plain component state, so each page load starts expanded.
- **Wide screens, collapsed:** the sidebar shrinks to an icon rail (links keep their `aria-label`s) so the content gets the space. **Narrow screens, collapsed:** the drawer is hidden and only the top bar remains.
- **Narrow screens, expanded:** the drawer covers the content with a dimmed backdrop. It closes on a link click, on `Escape`, and on a backdrop click, so landing on a page never leaves it covering the content. Focus moves to the first link when it opens and returns to the toggle when it closes.
- **Content:** the rows, toolbar, Pack/Wishlist lists and forms are a single column on narrow screens. The toolbar controls wrap, tap targets are at least 44 × 44 px, text does not rely on fixed widths, and there is **no horizontal page scroll**. Images scale to the container width (`max-width: 100%`) with a reserved aspect ratio.
- **Pop-up:** the red `Toast` spans the screen width minus a gutter on narrow screens and sits above any on-screen browser chrome (`env(safe-area-inset-bottom)`).
- Breakpoints, sizes and colours are CSS variables in `styles/variables.css`. The `<meta name="viewport">` tag from the Vite template stays.

## 9. Error handling summary

| Situation | Behaviour |
|---|---|
| Breed list request fails | `ApiStatus` shows Failed; page-level error with Retry; red pop-up (6.5); sidebar and other pages stay usable |
| Image request or file fails | `ApiStatus` shows Failed; error inside that row's details naming the breed, with Retry (6.3); red pop-up if the API is unreachable (6.5); list unaffected |
| URL names an unknown leaf | Collapsed list + red pop-up naming the missing element, same component as 6.5 (FR-D-1b) |
| `localStorage` blocked or corrupt | In-memory fallback + banner; corrupt values reset (FR-U-3) |
| Stored ID missing from the API | Shown as "No longer available" with remove |
| Request aborted (unmount / StrictMode) | Ignored silently |

## 10. Build, quality gates and testing

### 10.1 Scripts and tooling
Dev dependencies to add: `vitest`, `@vitest/ui`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`.

| Script | Command | Purpose |
|---|---|---|
| `npm test` | `vitest run --project unit` | One-shot, non-interactive, **offline** run; exits non-zero on any failure. This is the milestone gate |
| `npm run test:ui` | `vitest --ui --project unit` | Opens the `@vitest/ui` dashboard to browse, filter and re-run the offline tests while developing |
| `npm run test:live` | `vitest run --project live` | Runs the few tests that call the **real** Dog CEO API (`*.live.test.ts`). Needs internet; not part of the milestone gate |

- Vitest is configured in `vite.config.ts` (`test: { environment: 'jsdom', setupFiles: 'tests/setup.ts', globals: false }`). `tests/setup.ts` registers the jest-dom matchers and stubs `Element.prototype.scrollIntoView`, which jsdom does not implement.
- Tests run against `MemoryRouter` with `initialEntries` for deep links. `fetch` is replaced per test with `vi.stubGlobal('fetch', ...)`. **The offline suite never calls the real API**; fixtures in `tests/fixtures/` are small copies of real responses. The only tests that use the real API are the `*.live.test.ts` files, run on demand with `npm run test:live` (Vitest project `live`; `npm test` runs project `unit`). Live tests assert on stable facts (e.g. hound has an afghan sub-breed) rather than exact counts. They run in Node, so they cannot prove CORS behaviour; that is confirmed in the browser.

### 10.2 Test suite and milestone gate
**A version or deployment milestone is cleared only when `npm test`, `npm run lint` and `npm run build` all pass.** The suite grows with the work, and **at least 5 tests must exist and pass from the first milestone on**. The planned suite, with UI tests marked:

| # | Test | Type |
|---|---|---|
| 1 | `flattenBreeds` yields 165 leaves from the full fixture; 99 have a sub-breed, 66 do not | Logic |
| 2 | API guards accept a valid list/image response and reject malformed and `status: "error"` bodies | Logic |
| 3 | `applyFilterAndSort` filters by breed or sub-breed name (case-insensitive) and sorts asc/desc keeping breeds together | Logic |
| 4 | Reducer: pack counts increase and decrease, a wishlist add is idempotent | Logic |
| 5 | `storage.ts` recovers from corrupt JSON, a wrong version and a throwing `localStorage` | Logic |
| 6 | Breeds page: sub-breed rows show a breed tag; breeds without sub-breeds show none | UI |
| 7 | Clicking a row expands it and changes the URL to `/breeds/hound/afghan`; clicking again returns to `/breeds`; a deep link renders the row expanded | UI |
| 8 | Image failure shows `Couldn't load an image of Afghan (hound)` with Retry, and the red pop-up appears when `fetch` rejects | UI |
| 9 | Unknown URL (`/breeds/hound/nothing`) shows the collapsed list and the red pop-up naming it | UI |
| 10 | Typing in the filter narrows the list and updates `?q=`; the sort toggle reverses the order | UI |
| 11 | Pack: adding the same sub-breed twice shows a count of 2; the wishlist button flips to "On wishlist" | UI |
| 12 | The sidebar toggle collapses and expands the nav (`aria-expanded`), and starts expanded | UI |

- UI tests use Testing Library queries by role and name, so they double as accessibility checks.
- Narrow-screen layout (8.1) is CSS and is verified manually in the browser's responsive mode against the acceptance criteria; jsdom does not lay out pages.

## 11. Decisions

All decisions from the first draft were confirmed:

1. Hand-written guards instead of a schema library (section 1).
2. Pack stored as counts per leaf (section 7.1), which settles PRD open question #3 as "grouped with a count".
3. Own hooks and cache instead of a data-fetching library (sections 6.2–6.3).
4. Vitest, now extended to UI tests with `@vitest/ui` (section 10).
5. CSS Modules, no component library (section 1).
6. Hosting (section 4) must rewrite unknown paths to `index.html`.

Added in this revision, to confirm:

7. Sort and filter state is kept in the **query string** (`?q=&sort=`), and a deep-linked element hidden by the filter is pinned visible (section 5A).
8. The unknown-URL message reuses the **same red pop-up** as the API failure message (sections 5 and 6.5).
9. The sidebar is expanded by default on every screen size, and on narrow screens it closes itself after you pick a link (section 8.1).
