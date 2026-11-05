# PRD — Dog Breed Explorer (master-detail app)

Status: Draft v5 (item page; in sync with `architecture.md` Draft v4) · Date: 2026-11-05
Technical decisions (structure, state, data flow) are documented separately in `architecture.md`.

## 1. Overview

A client-side web app for dog hobbyists to explore dog breeds and sub-breeds, build a personal **Pack** (the dogs they have or like) and keep a **Wishlist** of breeds they want. All data comes from the free Dog CEO API. The Pack and Wishlist are saved in the browser across sessions, with no login, no user profiles and no backend. The master list links every breed and sub-breed to its own item page.

> Project history: the app was first planned around ChickenAPI. It was dropped because that API sends no CORS headers and the project does not allow a proxy or backend workaround. Dog CEO was verified to work from a browser (see section 5).

## 2. Goals and non-goals

### Goals
- Browse every breed and sub-breed in a single master list.
- Open any breed or sub-breed on its own item page, reached from the master list and addressable by URL (deep-linkable, working back/forward buttons).
- Build a Pack (the same sub-breed may be added more than once) and a Wishlist.
- Keep the Pack and Wishlist between sessions (saved in this browser).
- Navigate with links in a sidebar.
- Sort the breed list by breed name and filter it by name.
- Stay usable on narrow screens, with a collapsible sidebar.
- Always show the state of API calls and tell the user when the API cannot be reached.

### Non-goals (out of scope for v1)
- Filtering by anything other than name, sorting by anything other than breed name, and server-side search.
- Login, passwords, user profiles or accounts, sync between devices, or any backend or proxy.
- Breed information beyond what the API provides (origin, temperament, size and so on).
- Editing or submitting breed data.
- Anything on the item page beyond name, breed tag, one random image and the two action buttons, and any details shown inside the master list (the list only links to each item).

## 3. Target users

Dog enthusiasts and hobbyists who like exploring the variety of breeds and building a personal collection of the ones they keep, like or want. No expertise is assumed.

## 4. Scope and requirements

### 4.1 Pages and navigation
| Page | Route | Purpose |
|---|---|---|
| Breeds (master) | `/breeds` | List of all breed and sub-breed elements; each name is a link to its item page |
| Breed item | `/breeds/:breed` or `/breeds/:breed/:sub` | One element's own page: name, tag, random image, Add to Pack, Add to Wishlist. Not in the sidebar; reached from the master list or by its URL |
| My Pack | `/pack` | The user's pack |
| Wishlist | `/wishlist` | The user's wishlist |

- **FR-NAV-0** Routing uses **React Router**. `/` redirects to `/breeds`. `/breeds` renders the master list, and the two `/breeds/...` routes below it render the item page. Examples: `/breeds/akita` (breed without sub-breeds) and `/breeds/hound/afghan` (sub-breed).
- **FR-NAV-1** A persistent sidebar contains links to the three pages (Breeds, My Pack, Wishlist) and marks the active one. The Breeds link stays marked while an item page is open. The item page has no sidebar link of its own.
- **FR-NAV-2** Pack and Wishlist are separate pages, not panels on the master page.
- **FR-NAV-3** The sidebar is **collapsible** and **expanded by default** on every screen size. Collapsed on a wide screen it shrinks to an icon rail. On a narrow screen it opens as a drawer over the content and closes when a link is chosen, on `Escape`, or on a tap outside it.

### 4.2 Master list (Breeds page)
- **FR-M-1** One list element per **leaf**: each sub-breed of a breed that has sub-breeds, and each breed that has none. With the current API data this is 165 elements (99 sub-breeds plus 66 breeds without sub-breeds).
- **FR-M-2** Every element shows its full display name: a sub-breed is shown as the sub-breed followed by its breed ("Blood Hound"), and a breed without sub-breeds as the breed alone ("Akita"). **Only sub-breed elements** also show a **breed tag** chip naming the breed they belong to, unchanged by the full name ("Blood Hound" tagged "Hound"). An element for a breed without sub-breeds has **no tag**. The element's name is a link to its item page (FR-D-1).
- **FR-M-3** Elements of the same breed are kept together (list ordered by breed, then sub-breed, in the chosen sort direction, see FR-M-5), so the tag chips group sub-breeds visually. There are no section headers.
- **FR-M-4** The list loads from one request when the page opens, with a loading state and an error state with a retry action.
- **FR-M-5** The user can **sort** the list by breed name, ascending or descending. Sub-breeds of one breed stay together and follow the same direction. Default: ascending.
- **FR-M-6** The user can **filter** the list by name: a case-insensitive "contains" match on the breed name or the sub-breed name.
- **FR-M-7** Sort and filter are reflected in the URL (query string, e.g. `?q=ha&sort=desc`) so a view can be shared and survives a reload. They are not carried to an item page: the browser's Back button returns to the filtered list. Typing in the filter or changing the sort does not add browser-history entries. The result count is shown (e.g. "12 of 165"), and an empty result shows a "no breeds match" message with a way to clear the filter. The controls are disabled while the list is loading or has failed.

### 4.3 Item page
The master list does not expand anything: it only links to each element. Each element has its own page, which shows what the old expanding panel showed, and nothing more. (FR-M-8, FR-D-6 and FR-D-10 of earlier drafts belonged to the expanding panel and no longer exist.)
- **FR-D-1** In the master list the name of each element is a **link** to that element's item page. The item page is not in the sidebar: it is reached only by following a link in the master list, or by opening its URL.
- **FR-D-1a** The item page has its own URL: `/breeds/:breed/:sub` for a sub-breed and `/breeds/:breed` for a breed without sub-breeds (see 4.1). Opening it directly, or reloading, shows the page. Back and forward move between the list and item pages. The list's filter and sort are not carried into the item URL.
- **FR-D-1b** A URL naming an element that does not exist (e.g. `/breeds/hound/nothing`, or `/breeds/hound`, which is not an element because hound has sub-breeds) shows a **static 404 page**: plain text saying the page was not found, with no pop-up and nothing else, and does not crash.
- **FR-D-2** The page shows one **random image** of that sub-breed (or of the breed, if it has no sub-breeds), fetched from the matching Dog CEO endpoint when the page is opened.
- **FR-D-3** The page shows the name as its main heading, the breed tag (sub-breeds only, per FR-M-2) and the action buttons: **Add to Pack** and **Add to Wishlist**. Nothing else.
- **FR-D-4** The image is fetched the first time the page is opened and kept for the rest of the session, so opening the same page again shows the same image.
- **FR-D-5** The image has its own loading and failure state with a retry action. A failure message names the breed or sub-breed (e.g. "Couldn't load an image of Afghan Hound"). A failed image never breaks the page.
- **FR-D-7** The links to the item pages and every control on the item page are fully keyboard-accessible.
- **FR-D-8** Every API call (the breed list, and each image) shows a visible status: **Loading**, **Failed** or **Done**. Each state has an icon and a text label, not colour alone, and is announced to assistive technology.
- **FR-D-9** When the API cannot be reached (no connection, a server error, or an unusable response), a **red pop-up at the bottom of the screen** tells the user. Repeated failures show one pop-up. It can be dismissed, and it clears itself when a later API call succeeds. A "breed not found" (404) for a single image is not an outage and gets only the inline message from FR-D-5.
- **FR-D-11** An item page needs the breed list to name its element. While the list is loading the page shows the Loading status; if the list cannot be loaded it shows Failed with a Retry button.

### 4.4 Pack and Wishlist
**My Pack**
- **FR-P-1** From an element's item page, the user can add that (sub-)breed to the Pack **any number of times**; the same sub-breed can appear several times.
- **FR-P-2** The Pack page shows **one row per (sub-)breed with a count** (e.g. "Afghan Hound × 3"), with the breed tag on sub-breed rows (none for breeds without sub-breeds).
- **FR-P-3** The user can remove from the Pack page one at a time: each removal lowers the count by one, and the row disappears when the count reaches zero.
- **FR-P-4** The Pack page shows an empty state with a link to the Breeds page.

**Wishlist**
- **FR-W-1** From an element's item page, the user can add that (sub-)breed to the Wishlist. A (sub-)breed can be on the Wishlist only once. Adding it again is a no-op and the button shows its on-the-list state.
- **FR-W-2** The user can remove an entry from the Wishlist page.
- **FR-W-3** The Wishlist page shows an empty state with a link to the Breeds page.
- **FR-W-4** Whether a (sub-)breed is on the Wishlist is visible from the master list and its item page.

Pack and Wishlist are independent: a breed may be in both.

### 4.5 Persistence
There are no user profiles or sign-in: the app opens straight onto the Breeds page, and whoever uses the browser sees the same Pack and Wishlist.
- **FR-U-1** The Pack and Wishlist are saved in the browser (`localStorage`) and restored on the next visit.
- **FR-U-2** Only identifiers (breed and sub-breed keys) are stored, not images or API data.
- **FR-U-3** If stored data is missing, unreadable or refers to a (sub-)breed the API no longer returns, the app recovers without crashing: unreadable data is reset to empty, and an unknown entry is shown as "No longer available" with a remove button.
- **FR-U-4** If the browser blocks storage entirely, the app keeps working for the visit and logs a warning to the browser console saying the Pack and Wishlist will not be saved.

## 5. Data source: Dog CEO API

Docs: https://dog.ceo/dog-api/documentation/ · base URL `https://dog.ceo/api`

Verified on 2026-11-05:
- No authentication and no API key.
- `Access-Control-Allow-Origin: *` on the API and on the image host (`images.dog.ceo`), and preflight returns 204. A browser app can call it directly.
- No rate-limit headers; 30 rapid sequential requests all succeeded.

| Need | Endpoint | Notes |
|---|---|---|
| All breeds and sub-breeds | `GET /breeds/list/all` | `{ message: { breed: string[] }, status }`. 108 breeds, 42 with sub-breeds, 99 sub-breeds |
| Random image, sub-breed | `GET /breed/{breed}/{sub}/images/random` | `{ message: url, status }` |
| Random image, breed with no sub-breeds | `GET /breed/{breed}/images/random` | Same shape |
| Unknown breed | any of the above | HTTP 404 with `{ status: "error", message, code: 404 }` |

Limitations that shape the product:
- The API provides **names and images only**. There is no description, origin, temperament or size, so the item page is intentionally small.
- Using `/breed/{breed}/images/random` for a breed that **has** sub-breeds returns an image of a random sub-breed. The app must therefore always use the sub-breed endpoint for sub-breeds.
- The random image is different on every request; consistency comes from fetching once per session (FR-D-4).
- Names are lowercase API keys. For display, the element name is the capitalised sub-breed followed by the capitalised breed ("Afghan Hound"), or the capitalised breed alone when it has no sub-breeds ("Akita"). The tag is the capitalised breed, shown on sub-breed elements only: "Afghan Hound" tagged "Hound", "Akita" with no tag. This simple pattern reads naturally for most sub-breeds; a few (e.g. "Wild African", "Shepherd German") read backwards and are accepted as they are for v1.

## 6. Non-functional requirements
- **Language and stack:** React + Vite + React Router, **strictly TypeScript** (no `any`; API responses are typed and validated at the boundary).
- **Performance:** the master list renders 165 elements without noticeable lag; images are fetched only when an item page is opened.
- **Resilience:** network failures show a message and a retry; they never leave a blank page.
- **Accessibility:** semantic landmarks (nav, main), keyboard operation of the sidebar, the list links and all buttons (the sidebar toggle keeps `aria-expanded`), alt text on images, visible focus, API status and pop-ups announced to assistive technology (`role="status"` / `role="alert"`).
- **Responsive:** fully usable from 320 px wide up, with no horizontal page scroll, tap targets of at least 44 × 44 px, and the pop-up fitting the screen width; the sidebar is collapsible (FR-NAV-3).
- **Hosting:** the app uses browser-history URLs, so the production host must serve `index.html` for unknown paths (no server code is needed).
- **Code style:** asynchronous code uses `async`/`await` only (no explicit promise construction or `.then()` chains).
- **Testing:** `npm test` runs automated logic and UI tests (Vitest, with `@vitest/ui` available for inspection). At least 5 tests must pass for each version or deployment milestone.
- **Browser support:** current evergreen browsers.
- **Privacy:** no personal data leaves the device; the only network calls are to `dog.ceo` and `images.dog.ceo`.

## 7. Success criteria (acceptance)
1. The Breeds page lists 165 elements from one API call: the 99 sub-breed elements each carry a breed tag, and the 66 elements for breeds without sub-breeds have none.
2. An element's item page shows its name as the main heading, its tag (sub-breeds only), a random image of that sub-breed (or breed) and the two action buttons; opening the same page again shows the same image.
3. Each name in the list is a link: afghan hound's goes to `/breeds/hound/afghan`, akita's to `/breeds/akita`. Loading either URL directly (or reloading) shows that item page, the browser back button returns to the list, and the item page has no link in the sidebar.
4. Adding the same sub-breed to the Pack three times results in one Pack row with a count of 3; removing lowers it by one; the Wishlist only ever holds it once.
5. After a full browser restart, the Pack and Wishlist are exactly as they were left.
6. Breeds, Pack and Wishlist are reachable by sidebar links, with the active page marked.
7. With the network offline, the app shows the Failed status and an error with retry on both the list and the images, and the image error names the breed.
8. `tsc` and the linter pass with no errors, and the app contains no `any`.
9. Typing in the filter narrows the list by breed or sub-breed name and the sort toggle reverses the order; both are visible in the URL and survive a reload.
10. API calls show Loading, Failed or Done; with the network offline a red pop-up appears at the bottom of the screen, and an unknown item URL shows a static 404 page.
11. At 320 px width nothing overflows horizontally, and the sidebar can be collapsed and expanded (expanded on first load).
12. `npm test` passes with at least 5 tests.

## 8. Open questions and risks
| # | Item | Proposed handling |
|---|---|---|
| 1 | The item page contains only a name and an image because of the API | Accepted |
| 2 | The item page URL scheme (path-based, `/breeds/:breed/:sub`, FR-D-1a) | Adopted in `architecture.md` section 4; unchanged from the earlier expanding design, so old shared links still work |
| 3 | Pack display: one row per entry vs grouped with a count (FR-P-2) | **Resolved:** grouped with a count (`architecture.md` 7.1) |
| 4 | Should the Pack and Wishlist pages show the sub-breed image? | Not required for v1; would cost one image request per entry |
| 5 | A "new random image" button on the item page | Out of scope |
| 6 | The API is community-run with no SLA and may change or be unavailable | Defensive parsing, error states, `localStorage` holds IDs only |
| 7 | `localStorage` can be cleared by the user or blocked in private browsing | Recover gracefully (FR-U-3), log a console warning (FR-U-4) |
| 8 | The production host is not chosen and must rewrite unknown paths to `index.html` | Decide before the first deployment milestone |
| 9 | Pressing Back from an item page may return to the top of the long list instead of the previous scroll position | Not handled: restoring it would be an addition. Checked in the browser during verification (T26) and reported |

## 9. Next steps
1. Review and approve this PRD together with `architecture.md`.
2. Write `tasks.md`, an ordered task-by-task implementation plan, before any coding starts.
