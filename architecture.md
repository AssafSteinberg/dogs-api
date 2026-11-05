# Architecture — Dog Breed Explorer

Status: Draft v1 · Date: 2026-11-05 · Companion to `PRD.md` (requirement IDs such as FR-D-1a refer to it).

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
| Tests | Vitest for pure logic **[Decision]**, proposed in `tasks.md` | Flattening, parsing, the reducer and storage are logic-heavy and easy to test; UI tests are optional |

### TypeScript and lint settings to apply
- `tsconfig.app.json`: add `"strict": true` explicitly (it is not set today) and `"noUncheckedIndexedAccess": true`.
- Keep `erasableSyntaxOnly: true` (already on): **no enums, no namespaces, no constructor parameter properties**. Use string-literal unions and plain objects.
- `.oxlintrc.json`: add `"typescript/no-explicit-any": "error"`.
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
- The same ID is what the Pack and Wishlist store (PRD FR-U-5).
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
    AppLayout.tsx               sidebar + <Outlet/>, profile gate
  api/
    dogApi.ts                   fetchBreedList(), fetchRandomImage(leaf)
    guards.ts                   parseBreedList(unknown), parseImageResponse(unknown)
    errors.ts                   ApiError (network / http / shape)
  domain/
    leaf.ts                     Leaf, LeafId, flattenBreeds, display helpers
  state/
    storage.ts                  safe localStorage read/write + schema versioning
    profiles.tsx                ProfilesProvider (profile list, active profile)
    collection.tsx              CollectionProvider (pack + wishlist for the active profile)
    reducer.ts                  pure reducer + actions
  features/
    breeds/
      BreedsProvider.tsx        loads the list once; exposes leaves + index + status
      BreedsPage.tsx            reads route params, owns the "expanded" decision
      BreedList.tsx
      BreedItem.tsx             one row: name, tag, toggle button
      BreedDetails.tsx          image + actions
      useBreedImage.ts          per-leaf image hook with session cache
    pack/PackPage.tsx
    wishlist/WishlistPage.tsx
    profiles/
      ProfileSwitcher.tsx
      CreateProfileForm.tsx
  components/
    Sidebar.tsx
    Tag.tsx
    AsyncState.tsx              loading / error + retry
  styles/                       global.css, variables.css
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
   - Params but not found → nothing is expanded and a "not found" notice is shown (FR-D-1b).
   - List not loaded yet → the loading state is shown; lookup happens after the load.
3. `BreedItem` renders a `<button aria-expanded aria-controls>`. Clicking it calls `navigate('/breeds/<id>')` to expand, or `navigate('/breeds')` when it is already the expanded one. Because `navigate` pushes history entries, back/forward step through expansion states (acceptance criterion 3).
4. When the expanded leaf changes (including the first render from a deep link), an effect calls `scrollIntoView({ block: 'nearest' })` on its row.
5. Only one leaf can match the URL, so only one row is expanded at a time (FR-D-6).

Because the `BreedDetails` of a collapsed row is not rendered, no image is requested until a row is expanded (FR-D-2).

## 6. Data layer

### 6.1 API client (`api/dogApi.ts`)
- Base URL constant `https://dog.ceo/api`. Calls use `fetch` directly and take an `AbortSignal`.
- Every response is read as `unknown` and passed through a guard in `guards.ts`:
  - Breed list: `status === 'success'` and `message` is an object whose values are arrays of strings.
  - Image: `status === 'success'` and `message` is a string URL.
- Failures are normalised into one `ApiError` with a `kind`: `'network' | 'http' | 'shape'`. The Dog CEO 404 JSON body (unknown breed) becomes `kind: 'http'` with the status code.
- Image endpoint is chosen from the leaf: `sub` present → `/breed/{breed}/{sub}/images/random`; otherwise `/breed/{breed}/images/random`. **A sub-breed must never use the breed endpoint**, because that returns a random sub-breed's image (PRD section 5).

### 6.2 Breed list (`BreedsProvider`)
- Fetched once when the app mounts (not per page), so the Breeds, Pack and Wishlist pages share it and a refresh on `/pack` still works.
- Exposes `{ status: 'loading' | 'error' | 'ready', leaves, index, retry }`.
- The request is aborted on unmount. In development, React `StrictMode` runs effects twice; the aborted first request must not surface as an error.

### 6.3 Random image (`useBreedImage`)
- A module-level `Map<LeafId, string>` holds resolved URLs for the session; a second `Map<LeafId, Promise<string>>` de-duplicates in-flight requests. Together they satisfy FR-D-4: the first expand fetches, later expands reuse the same image, and a double effect run does not fetch twice.
- Hook state: `{ status: 'loading' | 'error' | 'ready', url, retry }`. A failed fetch is *not* cached, so retry makes a new request (FR-D-5).
- The cache is intentionally in memory only: a page reload gives a new random image, and no image data is ever stored (FR-U-5).
- The `<img>` itself also has an `onError` fallback (the URL resolved but the file failed to load) that shows the same retry state.

## 7. Application state and persistence

### 7.1 Stored shape
Two kinds of `localStorage` keys, all prefixed with a schema version:

```
dogs-api:v1:profiles          → { activeId: string | null, profiles: { id: string, name: string }[] }
dogs-api:v1:collection:<id>   → { pack: Record<LeafId, number>, wishlist: LeafId[] }
```

- `pack` is a **count per leaf**, not a list of entries **[Decision]**. This resolves PRD open question #3: the Pack page shows one row per leaf with its count, and "remove" decrements by one (FR-P-2, FR-P-3). Counts are integers ≥ 1; a count reaching 0 deletes the key.
- `wishlist` is an array used as an ordered set: adding an existing ID is a no-op (FR-W-1).
- Profile IDs come from `crypto.randomUUID()`. Names are trimmed, 1–30 characters, and unique ignoring case (FR-U-1).
- Pack and Wishlist are independent: a leaf may be in both.

### 7.2 Providers
- `ProfilesProvider` holds the profile list and active profile; it writes `dogs-api:v1:profiles` whenever they change. Actions: `createProfile(name)`, `switchProfile(id)`.
- `CollectionProvider` sits below it and loads `collection:<activeId>` whenever the active profile changes. It uses a pure reducer (`state/reducer.ts`) with actions `addToPack(id)`, `removeFromPack(id)`, `addToWishlist(id)`, `removeFromWishlist(id)`, and writes through to storage after each change.
- Components read through narrow hooks (`usePack()`, `useWishlist()`, `useProfiles()`), not the raw context.

### 7.3 Profile gate (FR-U-1, U-4)
`AppLayout` renders `CreateProfileForm` instead of the `<Outlet/>` when there is no active profile. With an active profile stored, it restores it silently. The sidebar's `ProfileSwitcher` lists profiles and offers "New profile". Deep links work for returning users; a first-time visitor to `/breeds/hound/afghan` creates a profile first and then lands on that URL (the URL is preserved while the form is shown).

### 7.4 Storage safety (FR-U-7)
`state/storage.ts` is the only code that touches `localStorage`:
- Every read and write is in `try/catch` (blocked storage, quota, private mode).
- Reads parse JSON as `unknown` and run guards. Invalid or unknown-version data is discarded and replaced with an empty value, never partially trusted.
- If storage is unavailable, the providers fall back to in-memory state and the UI shows a banner: "Your pack won't be saved in this browser" (PRD risk #7).
- A stored ID that is no longer in the breed index is kept in storage but rendered on its page as "No longer available" with a remove button; it is never passed to the image API.
- Cross-tab live sync via the `storage` event is out of scope; the other tab sees changes on its next load.

## 8. Components and responsibilities

| Component | Responsibility |
|---|---|
| `AppLayout` | Profile gate, sidebar, `<main>` landmark, storage-unavailable banner |
| `Sidebar` | `<nav>` with `NavLink`s to Breeds, Pack, Wishlist; hosts `ProfileSwitcher`; collapses on narrow screens |
| `BreedsPage` | Waits for the list, resolves the expanded leaf from the URL, shows the not-found notice |
| `BreedList` / `BreedItem` | Renders the 165 rows; the toggle button; the `Tag` when `sub !== null` |
| `BreedDetails` | Name, tag, image (`useBreedImage`), Add to Pack and Add to Wishlist |
| `PackPage` / `WishlistPage` | Lists stored leaves resolved through the index, remove actions, empty state with a link to `/breeds` |
| `AsyncState` | One shared loading / error + retry presentation |

- **Buttons reflect state:** Add to Wishlist shows "On wishlist" (and offers remove) when the leaf is present (FR-W-4); the list rows show a small wishlist marker as well.
- **Performance:** 165 plain rows need no virtualisation. `BreedItem` is memoised and receives only primitive props plus an `expanded` boolean, so a URL change re-renders two rows, not 165.
- **Accessibility:** disclosure pattern (`button` with `aria-expanded` and `aria-controls` pointing at the details region), `<nav>`/`<main>` landmarks, `alt` text built from the display name, visible focus styles, and focus stays on the toggle after expand/collapse (FR-D-7). The image area reserves its size to avoid layout shift.

## 9. Error handling summary

| Situation | Behaviour |
|---|---|
| Breed list request fails | Page-level error with Retry; sidebar and other pages stay usable |
| Image request or file fails | Error inside that row's details with Retry; list unaffected |
| URL names an unknown leaf | Collapsed list + "not found" notice (FR-D-1b) |
| `localStorage` blocked or corrupt | In-memory fallback + banner; corrupt values reset (FR-U-7) |
| Stored ID missing from the API | Shown as "No longer available" with remove |
| Request aborted (unmount / StrictMode) | Ignored silently |

## 10. Build, quality gates and testing

- `npm run build` (`tsc -b && vite build`) and `npm run lint` must pass with zero errors (acceptance criterion 8).
- **Tests (Vitest, pure logic) [Decision]:** `flattenBreeds` (counts: 165 leaves, 99 tagged), the API guards (valid, malformed and error bodies), `toLeafId`/`parseLeafId`, the reducer (pack counts, wishlist idempotence), and `storage.ts` (corrupt JSON, wrong version, throwing storage). UI behaviour (URL expansion, back button, deep link) is verified manually against the acceptance criteria unless component tests are added later.
- The API is never called from tests; fixtures are small copies of real responses.

## 11. Decisions to confirm

1. **Hand-written guards instead of a schema library** (section 1). Alternative: `zod`, one extra dependency.
2. **Pack stored as counts per leaf** (section 7.1), which settles PRD open question #3 as "grouped with a count".
3. **Own hooks and cache instead of a data-fetching library** (sections 6.2–6.3).
4. **Vitest for pure logic** as part of the plan (section 10); nothing is installed yet.
5. **CSS Modules, no component library** (section 1).
6. **Hosting** (section 4) still needs a host that rewrites unknown paths to `index.html`.
