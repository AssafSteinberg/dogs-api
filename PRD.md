# PRD — Dog Breed Explorer (master-detail app)

Status: Draft v1 · Date: 2026-11-05
Technical decisions (structure, state, data flow) are documented separately in `architecture.md`.

## 1. Overview

A client-side web app for dog hobbyists to explore dog breeds and sub-breeds, build a personal **Pack** (the dogs they have or like) and keep a **Wishlist** of breeds they want. All data comes from the free Dog CEO API. Everything a user creates is saved per user across sessions, with no login and no backend.

> Project history: the app was first planned around ChickenAPI. It was dropped because that API sends no CORS headers and the project does not allow a proxy or backend workaround. Dog CEO was verified to work from a browser (see section 5).

## 2. Goals and non-goals

### Goals
- Browse every breed and sub-breed in a single master list.
- Expand and collapse an item in place to see its details, with the expanded item reflected in the URL (deep-linkable, working back/forward buttons).
- Build a Pack (the same sub-breed may be added more than once) and a Wishlist.
- Keep each user's Pack and Wishlist between sessions.
- Navigate with links in a sidebar.

### Non-goals (out of scope for v1)
- Search, filtering and sorting of the breed list.
- Login, passwords, sync between devices, or any backend or proxy.
- Breed information beyond what the API provides (origin, temperament, size and so on).
- Editing or submitting breed data.
- A separate detail page: details are always shown inline in the master list, even when opened through a URL.

## 3. Target users

Dog enthusiasts and hobbyists who like exploring the variety of breeds and building a personal collection of the ones they keep, like or want. No expertise is assumed. Several people may share one browser (a household), so profiles are supported.

## 4. Scope and requirements

### 4.1 Pages and navigation
| Page | Route | Purpose |
|---|---|---|
| Breeds (master) | `/breeds` | List of all breed and sub-breed elements, all collapsed |
| Breeds, one element expanded | `/breeds/:breed` or `/breeds/:breed/:sub` | The same list with that element expanded |
| My Pack | `/pack` | The user's pack |
| Wishlist | `/wishlist` | The user's wishlist |

- **FR-NAV-0** Routing uses **React Router**. `/` redirects to `/breeds`. The two `/breeds/...` routes render the same master page. Examples: `/breeds/akita` (breed without sub-breeds) and `/breeds/hound/afghan` (sub-breed).
- **FR-NAV-1** A persistent sidebar contains links to the three pages and marks the active one.
- **FR-NAV-2** The sidebar also shows the current profile and a way to switch or create profiles (see 4.5).
- **FR-NAV-3** Pack and Wishlist are separate pages, not panels on the master page.

### 4.2 Master list (Breeds page)
- **FR-M-1** One list element per **leaf**: each sub-breed of a breed that has sub-breeds, and each breed that has none. With the current API data this is 165 elements (99 sub-breeds plus 66 breeds without sub-breeds).
- **FR-M-2** Every element shows its display name. **Only sub-breed elements** also show a **breed tag** chip naming the breed they belong to (e.g. "afghan" tagged "hound"). An element for a breed without sub-breeds (e.g. "akita") has **no tag**.
- **FR-M-3** Elements of the same breed are kept together (list ordered by breed, then sub-breed), so the tag chips group sub-breeds visually. There are no section headers.
- **FR-M-4** The list loads from one request when the page opens, with a loading state and an error state with a retry action.

### 4.3 Details (inline expand and collapse)
- **FR-D-1** Clicking an element expands its details in place; clicking again, or the close control, collapses it.
- **FR-D-1a** Expanding an element updates the URL to that element's route (see 4.1); collapsing it returns the URL to `/breeds`. Opening such a URL directly, or reloading, shows the list with that element expanded (and scrolled into view). Back and forward move between expansion states.
- **FR-D-1b** A URL naming an element that does not exist (e.g. `/breeds/hound/nothing`, or `/breeds/hound`, which is not an element because hound has sub-breeds) shows the collapsed list with a "not found" message and does not crash.
- **FR-D-2** The details show one **random image** of that sub-breed (or of the breed, if it has no sub-breeds), fetched from the matching Dog CEO endpoint when the element is first expanded.
- **FR-D-3** The details show the name, the breed tag (sub-breeds only, per FR-M-2) and the action buttons: **Add to Pack** and **Add to Wishlist**.
- **FR-D-4** The image is fetched on first expand only and kept for the rest of the session, so collapsing and re-expanding shows the same image.
- **FR-D-5** The image has its own loading and error state with a retry action. A failed image never breaks the list.
- **FR-D-6** Only **one** element is expanded at a time, because the URL names a single element. Expanding another collapses the current one.
- **FR-D-7** Expansion is fully keyboard-accessible.

### 4.4 Pack and Wishlist
**My Pack**
- **FR-P-1** From an element's details, the user can add that (sub-)breed to the Pack **any number of times**; the same sub-breed can appear several times.
- **FR-P-2** The Pack page lists the entries the user added, shows the breed tag on sub-breed entries (none for breeds without sub-breeds), and shows a count per (sub-)breed when it was added more than once. *(Per-entry or grouped display is an `architecture.md` decision; both satisfy this requirement.)*
- **FR-P-3** The user can remove an entry (one at a time) from the Pack page.
- **FR-P-4** The Pack page shows an empty state with a link to the Breeds page.

**Wishlist**
- **FR-W-1** From an element's details, the user can add that (sub-)breed to the Wishlist. A (sub-)breed can be on the Wishlist only once. Adding it again is a no-op and the button shows its on-the-list state.
- **FR-W-2** The user can remove an entry from the Wishlist page.
- **FR-W-3** The Wishlist page shows an empty state with a link to the Breeds page.
- **FR-W-4** Whether a (sub-)breed is on the Wishlist is visible from the master list and its details.

Pack and Wishlist are independent: a breed may be in both.

### 4.5 Profiles and persistence
- **FR-U-1** On first visit the user creates a profile by entering a name. No password.
- **FR-U-2** A user can switch between existing profiles and create new ones from the sidebar.
- **FR-U-3** Each profile's Pack and Wishlist are saved in the browser (`localStorage`) and restored on the next visit.
- **FR-U-4** The last-used profile is selected automatically on return.
- **FR-U-5** Only identifiers (breed and sub-breed keys) are stored, not images or API data.
- **FR-U-6** Profiles are local to one browser and are not private. This is stated in the UI.
- **FR-U-7** If stored data is missing, unreadable or refers to a (sub-)breed the API no longer returns, the app recovers without crashing (empty data, or the unknown entry shown as unavailable).

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
- The API provides **names and images only**. There is no description, origin, temperament or size, so the details view is intentionally small.
- Using `/breed/{breed}/images/random` for a breed that **has** sub-breeds returns an image of a random sub-breed. The app must therefore always use the sub-breed endpoint for sub-breeds.
- The random image is different on every request; consistency comes from fetching once per session (FR-D-4).
- Names are lowercase API keys. The display format (capitalisation, e.g. "Afghan hound") is decided in `architecture.md`.

## 6. Non-functional requirements
- **Language and stack:** React + Vite + React Router, **strictly TypeScript** (no `any`; API responses are typed and validated at the boundary).
- **Performance:** the master list renders 165 elements without noticeable lag; images are fetched only on expand and shown lazily.
- **Resilience:** network failures show a message and a retry; they never leave a blank page.
- **Accessibility:** semantic landmarks (nav, main), keyboard operation of the sidebar, expand/collapse (with `aria-expanded`) and all buttons, alt text on images, visible focus.
- **Responsive:** usable on desktop and mobile widths (the sidebar can collapse on narrow screens).
- **Browser support:** current evergreen browsers.
- **Privacy:** no personal data leaves the device; the only network calls are to `dog.ceo` and `images.dog.ceo`.

## 7. Success criteria (acceptance)
1. The Breeds page lists 165 elements from one API call: the 99 sub-breed elements each carry a breed tag, and the 66 elements for breeds without sub-breeds have none.
2. Expanding an element shows a random image of that sub-breed (or breed) and the two action buttons; collapsing hides it; re-expanding shows the same image.
3. The URL follows the expansion: expanding `afghan` gives `/breeds/hound/afghan`, expanding `akita` gives `/breeds/akita`, collapsing returns to `/breeds`. Loading either URL directly (or reloading) shows that element expanded, and the browser back button reverses the last expansion.
4. Adding the same sub-breed to the Pack three times results in three Pack entries (or a count of 3); the Wishlist only ever holds it once.
5. After a full browser restart, the same profile shows the same Pack and Wishlist; a second profile sees its own.
6. Breeds, Pack and Wishlist are reachable by sidebar links, with the active page marked.
7. With the network offline, the app shows error states with retry on both the list and the images.
8. `tsc` and the linter pass with no errors, and the app contains no `any`.

## 8. Open questions and risks
| # | Item | Proposed handling |
|---|---|---|
| 1 | Details contain only a name and an image because of the API | Accepted for v1 |
| 2 | The URL scheme (path-based, one expanded element, FR-D-6) | Assumed; a query-string scheme would allow several at once. Confirm |
| 3 | Pack display: one row per entry vs grouped with a count (FR-P-2) | Decide in `architecture.md` |
| 4 | Should the Pack and Wishlist pages show the sub-breed image? | Not required for v1; would cost one image request per entry |
| 5 | A "new random image" button on the details | Out of scope for v1 |
| 6 | The API is community-run with no SLA and may change or be unavailable | Defensive parsing, error states, `localStorage` holds IDs only |
| 7 | `localStorage` can be cleared by the user or blocked in private browsing | Recover gracefully (FR-U-7) and tell the user |

## 9. Next steps
1. Review and approve this PRD.
2. Write `architecture.md` (project structure, types, state management, routing, API layer, persistence).
3. Write `tasks.md`, an ordered task-by-task implementation plan, before any coding starts.
