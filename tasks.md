# Implementation Plan — Dog Breed Explorer

Status: v5, approved (milestone v1.1 added: the expanding panel becomes an item page) · Date: 2026-11-05
Sources of truth: `PRD.md` (Draft v5) and `architecture.md` (Draft v4). Requirement IDs (FR-…) refer to the PRD; section numbers refer to `architecture.md`.
**Implementation starts only when this file is approved.**

## 1. Working agreement

1. **One task at a time**, in the order below. Each task is one function, component or small feature.
2. **Branches:** `dev` is always based on an up-to-date `main`. **Each task gets one feature branch created from an up-to-date `dev`**: `task/NN-short-name` (e.g. `task/05-dog-api-client`).
3. **Red → Green** inside every task:
   1. Write the task's tests (a few, listed in the task).
   2. Run `npm test`. **The new tests must fail** for the right reason (missing module or missing behaviour, not a typo). Show the failing output.
   3. Implement the feature, with the smallest change that satisfies the tests and the PRD/architecture.
   4. Run `npm test`, `npm run lint` and `npm run build`. **All must pass**, including every test from earlier tasks.
4. **A task ends with a stop.** I report in three sentences what changed (per `AGENTS.md`), then wait.
5. **Moving to the next task requires all tests up to that stage to pass**, unless you explicitly permit otherwise.
6. **Permission gates:**
   - I **ask before every commit**. I commit only the files of the current task, with a short message.
   - I **never merge** without your explicit order. You merge manually or tell me to. **Task branches are merged into `dev`, one at a time**, and the next task branch starts from `dev` after that merge. **`dev` is merged into `main` only between milestones**, on your order; afterwards `dev` is brought up to date with `main`.
   - Documentation (`PRD.md`, `architecture.md`, `tasks.md`, `PROMPTS.md`) is the only thing committed directly to `main`. All code goes through task branches into `dev`, and reaches `main` only through a milestone merge.
7. **No improvisation.** No new features, dependencies, libraries, technologies or external services beyond `PRD.md` and `architecture.md`. If a task cannot be completed within them, I **stop and ask** instead of working around it. Allowed dependencies are exactly those named in `architecture.md` section 1 and 10.1; each is installed in the task that first needs it.
8. If a test, PRD item or architecture item looks wrong or contradictory, I stop and ask. Documents are changed only on your instruction.
9. Code rules apply to every task: strict TypeScript with no `any` and no unchecked casts; `async`/`await` only (no `new Promise`, no `.then()`); the folder structure and boundaries of architecture section 3; styles in CSS Modules using the shared variables; each component built to work at 320 px wide.

### Definition of done (every task)
- Task tests were seen red, then green.
- `npm test`, `npm run lint` and `npm run build` pass with zero errors; no earlier test was skipped or deleted.
- Only files belonging to the task changed.
- The task's "Done when" line is true.

### Milestones (version / deployment gates)
A milestone is cleared only when `npm test` (at least 5 tests, all passing), `npm run lint` and `npm run build` all pass, **and you approve**. Tagging or deploying is done only on your instruction.

| Milestone | After task | Meaning |
|---|---|---|
| **v0.1 Core logic** | T08 | All pure logic done and tested |
| **v0.2 Shell and data** | T15 | App shell, routing, data providers |
| **v0.3 Browse** | T19 | Complete Breeds page |
| **v0.4 Collections** | T21 | Pack and Wishlist pages |
| **v1.0 Release candidate** | T23 | Responsive pass and PRD acceptance walkthrough done |
| **v1.1 Item page** | T26 | The master list links to item pages instead of expanding; verified in a real browser |

## 2. Tasks

Test files live in `tests/`, named after the unit (e.g. `tests/leaf.test.ts`). "Fixture" means a small copy of a real API response in `tests/fixtures/`.

---

### Milestone v0.1 — Core logic

#### T01 · Test tooling and strict config · `task/01-test-tooling`
- **Scope:** install `vitest`, `@vitest/ui`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`. Add scripts `test` (`vitest run`) and `test:ui` (`vitest --ui`). Add the `test` block to `vite.config.ts` (jsdom, `tests/setup.ts`). Create `tests/setup.ts` (jest-dom matchers, `scrollIntoView` stub). Set `strict` and `noUncheckedIndexedAccess` in `tsconfig.app.json`. Add `typescript/no-explicit-any` to `.oxlintrc.json` (and the promise rule if this Oxlint version has it). Include `tests/` in the type-check.
- **Tests (red first):** `tests/smoke.test.ts`: (1) a trivial assertion passes under jsdom (`document` exists); (2) a jest-dom matcher works on a rendered element.
- **Red looks like:** `npm test` fails because the script and setup do not exist.
- **Done when:** `npm test` runs the smoke tests green; `npm run test:ui` starts the dashboard; lint and build pass with the stricter config (template code is fixed minimally only if the stricter config requires it).

#### T02 · Leaf IDs and display names · `task/02-leaf-domain`
- **Scope:** `src/domain/leaf.ts`: `Leaf`, `LeafId`, `toLeafId(breed, sub)`, `parseLeafId(id)`, `leafName(leaf)`, `leafTag(leaf)` (architecture section 2).
- **Tests (red first):** (1) `toLeafId('hound','afghan')` is `hound/afghan` and `toLeafId('akita', null)` is `akita`; (2) `parseLeafId` round-trips both forms and rejects malformed input; (3) `leafName` capitalises the sub-breed or breed; (4) `leafTag` returns `Hound` for a sub-breed and `null` for a breed without sub-breeds (FR-M-2).
- **Done when:** tests green; module imports no React.

#### T03 · Flatten the breed list · `task/03-flatten-breeds`
- **Scope:** `flattenBreeds(record)` in `src/domain/leaf.ts` returning the ordered `Leaf[]` and the `Map<LeafId, Leaf>` index. Add the fixture `tests/fixtures/breeds-list-all.json` (copy of the real response).
- **Tests (red first):** (1) the full fixture gives 165 leaves, 99 with a sub-breed and 66 without (FR-M-1); (2) leaves are ordered by breed, then sub-breed; (3) the index returns the right leaf for `hound/afghan` and `akita` and `undefined` for `hound` (FR-D-1b); (4) an empty record gives an empty list.
- **Done when:** tests green.

#### T04 · API response guards and ApiError · `task/04-api-guards`
- **Scope:** `src/api/errors.ts` (`ApiError` with `kind: 'network' | 'http' | 'shape'`, status code optional; a class without parameter properties) and `src/api/guards.ts` (`parseBreedList`, `parseImageResponse`; input `unknown`, no `as` casts).
- **Tests (red first):** (1) valid list and image bodies are accepted; (2) wrong shapes are rejected (non-object `message`, non-string array items, missing `status`); (3) `status: "error"` bodies are rejected; (4) rejections are `ApiError` with `kind: 'shape'`.
- **Done when:** tests green.

#### T05 · Dog CEO API client · `task/05-dog-api-client`
- **Scope:** `src/api/dogApi.ts`: `fetchBreedList(signal)` and `fetchRandomImage(leaf, signal)`, `async`/`await` with `try/catch`, using the guards (architecture 6.1).
- **Tests (red first, `fetch` stubbed):** (1) the list call requests `/breeds/list/all` and returns parsed data; (2) a sub-breed leaf requests `/breed/hound/afghan/images/random` and a breed-only leaf requests `/breed/akita/images/random` (never the breed endpoint for a sub-breed); (3) a rejected `fetch` becomes `ApiError` `kind: 'network'`; (4) HTTP 404 and 500 become `kind: 'http'` with the status code; (5) an aborted request is distinguishable from a failure.
- **Also:** `tests/dog-api.live.test.ts` calls the real API and runs only with `npm run test:live` (a separate Vitest project), so it is not part of the `npm test` milestone gate.
- **Done when:** tests green; no `new Promise` or `.then` in the code.

#### T06 · Filter and sort · `task/06-filter-sort`
- **Scope:** `src/features/breeds/listView.ts`: `applyFilterAndSort(leaves, query, direction)` (architecture 5A, FR-M-5, FR-M-6). Pure, no React.
- **Tests (red first):** (1) filter is a case-insensitive trimmed "contains" on breed and sub-breed (`hound` keeps every hound; `afg` keeps `hound/afghan`); (2) an empty query returns everything; (3) `asc` and `desc` order by breed name and keep a breed's sub-breeds together in the same direction; (4) filter happens before sort; (5) the input array is not mutated.
- **Done when:** tests green.

#### T07 · Safe storage · `task/07-storage`
- **Scope:** `src/state/storage.ts`: versioned read/write of the keys in architecture 7.1, guards for stored data, `try/catch` everywhere.
- **Tests (red first):** (1) write then read returns the same collection data; (2) corrupt JSON returns the empty default; (3) a wrong schema version returns the empty default; (4) a throwing `localStorage` (read and write) does not throw and reports unavailable; (5) stored pack counts that are not positive integers are discarded.
- **Done when:** tests green; this is the only module that touches `localStorage`.

#### T08 · Collection reducer · `task/08-collection-reducer`
- **Scope:** `src/state/reducer.ts`: state `{ pack: Record<LeafId, number>, wishlist: LeafId[] }`, actions `addToPack`, `removeFromPack`, `addToWishlist`, `removeFromWishlist` (architecture 7.1–7.2).
- **Tests (red first):** (1) adding the same leaf to the pack three times gives count 3 (FR-P-1); (2) removing lowers the count by one and deletes the key at zero (FR-P-3); (3) adding to the wishlist twice keeps one entry (FR-W-1); (4) removing something absent changes nothing; (5) pack and wishlist are independent; (6) the reducer never mutates its input.
- **Done when:** tests green. **Milestone v0.1 gate.**

---

### Milestone v0.2 — Shell and data

#### T09 · Notifications and the red pop-up · `task/09-notifications-toast`
- **Scope:** `src/state/notifications.tsx` (`NotificationsProvider`, `useNotify()` with `notify(message)`, `dismiss(id)` and `clear()`, de-duplication by message, clear-on-API-success; the `source: 'api' | 'route'` it first had was removed when the item page replaced the unknown-URL pop-up) and `src/components/Toast.tsx` (red, bottom of the screen, `role="alert"`, dismiss button). Architecture 6.5.
- **Tests (red first):** (1) `notify` shows a red alert with the message; (2) the same message twice shows one pop-up (FR-D-9); (3) the dismiss button removes it; (4) `clear()` (an API success) removes the pop-ups.
- **Done when:** tests green.

#### T10 · API status indicator · `task/10-api-status`
- **Scope:** `src/components/ApiStatus.tsx`: `loading` / `failed` / `done` with icon, text label and colour, `role="status"` (architecture 6.4, FR-D-8).
- **Tests (red first):** (1) each status renders its label (Loading…, Failed, Done); (2) it is exposed as a status region; (3) each state has an icon in addition to the label (not colour alone).
- **Done when:** tests green. The fade of `done` is CSS only.

#### T11 · Breed list provider · `task/11-breeds-provider`
- **Scope:** `src/features/breeds/BreedsProvider.tsx` and the `useBreeds()` hook: loads the list once on mount, exposes `{ status, leaves, index, retry }`, aborts on unmount, ignores an aborted request (as in the StrictMode double run), notifies on failure (architecture 6.2, FR-M-4).
- **Tests (red first):** (1) starts in `loading`, then `done` with 165 leaves; (2) a network failure gives `failed` and triggers the red pop-up; (3) `retry` after a failure reaches `done`; (4) under StrictMode the aborted first request causes no error and no pop-up, and the list still loads.
- **Done when:** tests green.

#### T12 · Random image hook · `task/12-use-breed-image`
- **Scope:** `src/features/breeds/useBreedImage.ts`: session cache, `{ status, url, retry }`, failures not cached, notify on outage (architecture 6.3, FR-D-2, FR-D-4, FR-D-5).
- **Tests (red first):** (1) the first use fetches and returns the URL; (2) a second use of the same leaf returns the same URL without another request; (3) a failure gives `failed`, is not cached, and `retry` fetches again; (4) a 404 sets `failed` but raises no outage pop-up, while a network error does.
- **Done when:** tests green.

#### T13 · Routing and layout shell · `task/13-router-layout`
- **Scope:** install `react-router`. `main.tsx` with `BrowserRouter`; `src/app/App.tsx` and `AppLayout.tsx` with the route table of architecture section 4 (placeholder Breeds/Pack/Wishlist pages), the `/` and `*` redirects, `Sidebar` with the three `NavLink`s, `<nav>` and `<main>` landmarks. Mount `NotificationsProvider`, `Toast` and `BreedsProvider`. Replace the Vite template screen.
- **Tests (red first, `MemoryRouter`):** (1) `/` redirects to `/breeds`; (2) `/pack` and `/wishlist` render their pages; (3) an unknown path redirects to `/breeds`; (4) the three links exist and the active one is marked (FR-NAV-1); (5) `/breeds/hound/afghan` still renders the Breeds page.
- **Done when:** tests green; `npm run dev` shows the shell.

#### T14 · Collapsible sidebar · `task/14-sidebar-collapse`
- **Scope:** collapse/expand toggle with `aria-expanded` and `aria-controls`; **expanded by default**; icon rail when collapsed on wide screens; drawer with backdrop on narrow screens that closes on link click, `Escape` and backdrop click; focus handling (architecture 8.1, FR-NAV-3).
- **Tests (red first):** (1) starts expanded; (2) the toggle collapses and expands and updates `aria-expanded`; (3) `Escape` closes the open drawer; (4) choosing a link closes the drawer in narrow mode (narrow mode is simulated by stubbing `matchMedia`).
- **Done when:** tests green; visual behaviour is verified in T22.

#### T15 · Collection provider · `task/15-collection-provider`
- **Scope:** `src/state/collection.tsx`: `CollectionProvider` using the reducer, loading the collection once on mount and saving it after every change through `storage.ts`; narrow hooks `usePack()` and `useWishlist()` (architecture 7.2, FR-U-1, U-2).
- **Tests (red first):** (1) actions update state and persist to the `dogs-api:v1:collection` key; (2) remounting restores the same Pack and Wishlist (acceptance 5); (3) empty or corrupt storage starts with an empty Pack and Wishlist; (4) only LeafIds and counts are stored (no names or images).
- **Done when:** tests green. **Milestone v0.2 gate.**

---

### Milestone v0.3 — Browse

> **Superseded in part:** the expand-in-place behaviour described in T16 to T19 was replaced by a separate item page in milestone v1.1 (T24 and T25). These entries are kept as the history of how the first version was built.

#### T16 · Breed list row · `task/16-breed-item`
- **Scope:** `BreedItem` (memoised): name, tag chip for sub-breeds only, wishlist marker, toggle `<button>` with `aria-expanded` and `aria-controls`, calling an `onToggle` prop (FR-M-2, FR-W-4, FR-D-7).
- **Tests (red first):** (1) a sub-breed row shows its name and the breed tag; (2) a breed-only row shows no tag; (3) the toggle reflects `expanded` in `aria-expanded` and calls `onToggle` on click and on keyboard Enter/Space; (4) a wishlisted leaf shows the marker.
- **Done when:** tests green.

#### T17 · Breeds page, list and URL expansion · `task/17-breeds-page`
- **Scope:** `BreedList` and `BreedsPage`: loading/failed states with `ApiStatus` and retry, render rows, resolve the expanded leaf from the URL params, toggle by `navigate` (push), keep the query string, scroll the expanded row into view, red `source: 'route'` pop-up for an unknown element, cleared on URL change (architecture sections 4–5, FR-D-1, 1a, 1b, 6, M-4).
- **Tests (red first, `MemoryRouter`):** (1) 165 rows render, 99 with a tag and 66 without (acceptance 1); (2) clicking `afghan` navigates to `/breeds/hound/afghan`, clicking again returns to `/breeds`, `akita` gives `/breeds/akita`; (3) opening `/breeds/hound/afghan` directly shows that row expanded and no other; (4) `/breeds/hound/nothing` and `/breeds/hound` show the collapsed list and the red pop-up naming the element, which disappears on navigating away; (5) a failed list load shows Failed, the retry button, and the outage pop-up.
- **Done when:** tests green. Row details are an empty placeholder until T18.

#### T18 · Breed details · `task/18-breed-details`
- **Scope:** `BreedDetails`: name, tag, image via `useBreedImage`, per-image `ApiStatus`, failure message naming the breed with Retry (for a failed request and for `<img>` `onError`), alt text, Add to Pack and Add to Wishlist buttons with the "On wishlist" state (architecture 6.3, 8; FR-D-2 to D-5, P-1, W-1).
- **Tests (red first):** (1) expanding shows the image for the right leaf and the Done status; (2) collapsing and re-expanding shows the same image URL; (3) a failed request shows `Couldn't load an image of Afghan Hound` and Retry, and `<img>` `onError` shows the same message; (4) Add to Pack twice makes the count 2; (5) Add to Wishlist flips to "On wishlist" and a second click does not duplicate it.
- **Done when:** tests green.

#### T19 · Sort and filter toolbar · `task/19-breeds-toolbar`
- **Scope:** `BreedsToolbar`: filter input (debounced), sort toggle, count "N of 165", clear button, "no breeds match" message, list `ApiStatus` badge, disabled while loading/failed; query-string state with `replace` navigation; a deep-linked leaf hidden by the filter stays visible (architecture 5A, FR-M-5 to M-8).
- **Tests (red first):** (1) typing narrows the list and sets `?q=`; (2) the sort toggle reverses the order and sets `?sort=desc`; defaults are omitted from the URL; (3) opening `/breeds?q=ha&sort=desc` applies both; (4) expanding a row keeps `?q=&sort=`; (5) a filter with no results shows the message and the clear button restores the list; (6) an expanded leaf hidden by the filter stays visible.
- **Done when:** tests green. **Milestone v0.3 gate.**

---

### Milestone v0.4 — Collections

#### T20 · Pack page · `task/20-pack-page`
- **Scope:** `PackPage`: one row per leaf with its count and tag (sub-breeds only), remove-one button, empty state with a link to `/breeds`, "No longer available" row with remove for IDs missing from the API (FR-P-2 to P-4, U-3). **Also:** `storage.ts` logs a one-time `console.warn` when the browser cannot store (replaces the dropped banner task; FR-U-4).
- **Tests (red first):** (1) a leaf added three times shows one row with a count of 3; (2) remove lowers the count and the row disappears at zero; (3) the empty state links to `/breeds`; (4) an unknown stored ID shows "No longer available" with a working remove and makes no image request.
- **Done when:** tests green.

#### T21 · Wishlist page · `task/21-wishlist-page`
- **Scope:** `WishlistPage`: list of wishlisted leaves with tag (sub-breeds only), remove, empty state with a link to `/breeds`, "No longer available" handling (FR-W-2, W-3, U-3).
- **Tests (red first):** (1) wishlisted leaves are listed; (2) remove deletes the entry; (3) the empty state links to `/breeds`; (4) an unknown stored ID shows "No longer available" with remove; (5) a leaf may appear on both pages independently.
- **Done when:** tests green. **Milestone v0.4 gate.**

---

### Milestone v1.0 — Release candidate

#### T22 · Narrow-screen verification and fixes · `task/22-responsive-pass`
- **Type:** verification task; the layout is CSS and cannot be tested in jsdom (architecture 10.2). There is no new feature.
- **Scope:** check every page at 320, 375, 768 and desktop widths in the browser's responsive mode against architecture 8.1 and PRD acceptance 11: no horizontal scroll, 44 px tap targets, sidebar drawer behaviour, pop-up fits the screen, images scale. Fix layout defects found, in CSS only.
- **Checks (instead of red tests):** a written checklist of each page × width, reported to you with pass/fail. Existing tests stay green.
- **Done when:** the checklist is all pass and you have seen it.

#### T23 · Template cleanup and acceptance walkthrough · `task/23-cleanup-acceptance`
- **Scope:** remove unused Vite template leftovers (`App.css`, unused assets, template text), confirm no `any`, no `new Promise`/`.then` and no unused dependency. Walk through acceptance criteria 1–12 of the PRD and report each with evidence. No new features.
- **Tests:** none new; `npm test` (at least 5 tests), `npm run lint` and `npm run build` must pass.
- **Done when:** every acceptance criterion is reported as met, or the gaps are listed for your decision. **Milestone v1.0 gate.**

---

### Milestone v1.1 — Item page

The master list stops expanding. Each breed name is a link to its own page, and that page shows exactly what the expanding panel showed, with the name as the page's `h1` and nothing else (PRD 4.3, architecture 4 and 5). These tasks work on `dev`, and nothing is merged into `main` until you order the milestone merge.

#### T24 · Item page and routes · `task/24-item-page`
- **Scope:** new `BreedPage.tsx`; in `App.tsx` the route `breeds` renders `BreedsPage` and `breeds/:breed/:sub?` renders `BreedPage`. `BreedPage` finds the element from the URL: Loading while the list loads and Failed with Retry if it fails (`AsyncState`, FR-D-11); found → `BreedDetails`; not found (`/breeds/hound/nothing`, `/breeds/hound`, `/breeds/nosuchbreed`) → a **static 404 page**, plain text, no pop-up (FR-D-1b). `BreedDetails` is unchanged except that the element's name becomes an `h1` and its unused `id` is removed (`detailsId.ts` goes in T25, with the row's `aria-controls`). `BreedsPage` stops reading `:breed/:sub` and loses the expansion, scroll-into-view, pinned-leaf and not-found-pop-up code; until T25 a row's toggle simply navigates to `/breeds/<id>`.
- **Tests (red first, `MemoryRouter` with the real `App`):** (1) `/breeds/hound/afghan` shows the item page: `h1` "Afghan Hound", the tag "Hound", the image, Add to Pack and Add to Wishlist, and no list; `/breeds/akita` the same without a tag; (2) while the list loads the page shows Loading, and if it fails Failed with Retry, and Retry brings the page; (3) `/breeds/hound/nothing`, `/breeds/hound` and `/breeds/nosuchbreed` show the static 404 text only: no pop-up, no list, no image request; (4) opening the same item page twice shows the same image with one image request (FR-D-4); (5) Add to Pack twice shows "In your pack: 2" and Add to Wishlist flips to "On wishlist" with no duplicate on a second click; (6) the sidebar's Breeds link is marked current on an item page and the sidebar has no link to an item page; (7) `/breeds` shows the list and no item page.
- **Done when:** tests green. The tests that described expanding are removed or rewritten because that behaviour no longer exists.

#### T25 · Breed rows are links · `task/25-row-links`
- **Scope:** `BreedItem`: the toggle `<button>` becomes a `<Link to="/breeds/<id>">` holding the name, the tag (sub-breeds only) and the wishlist marker. The chevron, `aria-expanded`, `aria-controls`, the `children` slot and the `onToggle` prop are removed. The link carries **no** query string. `BreedList` and `BreedsPage` lose the toggle plumbing. Nothing is added.
- **Tests (red first):** (1) each row is a link with the right `href` (`/breeds/hound/afghan`, `/breeds/akita`) and no `aria-expanded`; (2) the name and tag are as before, and a breed without sub-breeds has no tag; (3) following a link with a click, and with Enter, opens the item page, and Back returns to the list; (4) from `/breeds?q=ha&sort=desc` a row link goes to the plain item URL, and Back restores the filtered, sorted list; (5) a wishlisted element shows the marker; (6) a re-render of the list with the same props does not re-render its rows (kept from T16).
- **Done when:** tests green.

#### T26 · Real-browser verification · `task/26-verify-item-page`
- **Type:** verification task, with fixes only if a defect is found. No new feature.
- **Scope:** with throwaway scripts outside the repo, re-run in real Chrome against the real API (a) the responsive check on the list, an item page, the Pack and the Wishlist at 320, 375, 768 and 1280 px (no horizontal scroll, 44 px tap targets, sidebar behaviour, images scale), and (b) the acceptance walkthrough adapted to the item page (criteria 1 to 12). Also check and **report** what Back does to the list's scroll position (PRD risk 9); fixing it would be an addition, so it is not done without your say-so.
- **Checks (instead of red tests):** a written checklist, reported to you with pass/fail. Existing tests stay green.
- **Done when:** the checklist is all pass and you have seen it. **Milestone v1.1 gate.**

## 3. Not in this plan
- **Deployment.** The production host is undecided (PRD open item 8). A deployment task is added only after you choose a host; it would need the "serve `index.html` for unknown paths" rule.
- A visible storage-unavailable banner: dropped; the app logs a console warning instead (FR-U-4).
- Anything outside the PRD's scope: accounts or a backend, extra filters, images on the Pack and Wishlist pages, a "new random image" button, cross-tab sync.
- Extras on the item page: a back link, breadcrumbs, scroll restoration, carrying the filter to the item page. The page shows exactly what the old panel showed.

## 4. Test coverage map
The 12 tests required by `architecture.md` section 10.2 are all covered by the tasks above (the tasks contain more):

| Architecture test | Task |
|---|---|
| 1 flattenBreeds | T03 |
| 2 API guards | T04 |
| 3 filter and sort | T06 |
| 4 reducer | T08 |
| 5 storage | T07 |
| 6 tags and row links | T17, T25 |
| 7 item page and URL | T24, T25 |
| 8 image failure and pop-up | T12, T18, T24 |
| 9 unknown item URL (static 404) | T24 |
| 10 filter and sort UI | T19 |
| 11 pack count and wishlist button | T18, T20 |
| 12 sidebar toggle | T14 |
