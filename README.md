# Dog Breed Explorer

A small web app for dog lovers: browse every dog breed and sub-breed, look at a random photo of each, build a **Pack** of the dogs you keep or like, and keep a **Wishlist** of breeds you want.

Built with React, Vite and strict TypeScript. All data comes from the free [Dog CEO API](https://dog.ceo/dog-api/documentation/). There is no backend and no login: your Pack and Wishlist are saved in your browser.

## Overview

**Who it is for.** Dog enthusiasts and hobbyists who like exploring the variety of breeds and building a personal collection of the ones they keep, like or want.

**How it works.** It is a master-detail app:

| Page | Route | What it shows |
|---|---|---|
| Breeds (master) | `/breeds` | Every breed and sub-breed in one list. Each element expands in place to show its details. |
| My Pack | `/pack` | The dogs you added, with how many of each. |
| Wishlist | `/wishlist` | The breeds you want. |

Pages are reached through links in a collapsible sidebar. The app is one page and all navigation is tracked by the URL (`/breeds/hound/afghan`), so every view can be bookmarked or shared.

**Project documents.** For educational purposes, the app was designed and built from these, which are kept in the repository:

- [`PRD.md`](PRD.md): what the product does and the acceptance criteria.
- [`architecture.md`](architecture.md): how it is built and why.
- [`tasks.md`](tasks.md): the task-by-task plan it was implemented from.

## Key features

- **Complete breed list.** 165 different breeds and sub-breeds. A sub-breed is shown by its full name ("Blood Hound") with a small tag for its breed ("Hound"); a breed without sub-breeds has no tag.
- **Details in place.** Click an element to expand it: a random photo from the Dog CEO API, plus **Add to Pack** and **Add to Wishlist**. One element is open at a time. Re-opening it shows the same photo.
- **The URL is the state.** `/breeds/hound/afghan` opens that element; reloading, sharing the link and the browser's back and forward buttons all work.
- **Filter and sort.** Filter by breed or sub-breed name and sort A→Z or Z→A. Both are kept in the URL (`?q=hound&sort=desc`).
- **Pack.** Add the same dog as many times as you like; the Pack page shows one row per dog with a count and lets you remove them one at a time.
- **Wishlist.** Each breed can be on the list once. Remove entries from the Wishlist page.
- **Saved between visits.** Both lists are stored in your browser (`localStorage`). Only ids and counts are stored, never images or API data. If a stored breed disappears from the API it is shown as "No longer available" so you can remove it.
- **Always shows what the network is doing.** Every API call shows **Loading**, **Failed** or **Done**. A failed photo names the breed ("Couldn't load an image of Afghan Hound") and offers **Retry**. When the API cannot be reached, a red pop-up appears at the bottom of the screen.
- **Works on narrow screens.** Usable from 320 px wide. The sidebar can be collapsed; on a phone it opens as a drawer over the page. Tap targets are at least 44 px.
- **Accessible.** Keyboard operation throughout, `aria-expanded` on every toggle, status and alert announcements for screen readers, and alt text on photos.

## How to run?

**You need** [Node.js](https://nodejs.org/) 22.22 or newer (it was developed on Node 24) and npm. An internet connection is required, because the app calls the Dog CEO API directly from the browser.

```bash
git clone https://github.com/AssafSteinberg/dogs-api.git
cd dogs-api
npm install
npm run dev
```

Then open the address printed in the terminal (normally <http://localhost:5173>).

| Command | What it does |
|---|---|
| `npm run dev` | Starts the development server with hot reload. |
| `npm run build` | Type-checks (strict TypeScript) and builds the production bundle into `dist/`. |
| `npm run preview` | Serves the production build locally, to try it before deploying. |
| `npm run lint` | Runs [Oxlint](https://oxc.rs). |
| `npm test` | Runs the offline test suite once. |
| `npm run test:ui` | Opens the Vitest dashboard for the offline suite. |
| `npm run test:live` | Runs the few tests that call the real Dog CEO API. |

**Deploying.** The result of `npm run build` is a static site, and no server code is needed. The app uses normal browser URLs (not `#` URLs), so the host must serve `index.html` for any path it does not recognise. Otherwise opening or reloading a link such as `/breeds/hound/afghan` returns a 404.

**Resetting.** To start with an empty Pack and Wishlist, clear this site's data in your browser (the key is `dogs-api:v1:collection`).

## Tests overview

Tests use [Vitest](https://vitest.dev/) with [Testing Library](https://testing-library.com/) and jsdom. They are split into two projects:

- **Offline suite (`npm test`): 270 tests in 22 files.** Never touches the network; the API is replaced with small copies of real responses. This, together with `npm run lint` and `npm run build`, is the gate every change had to pass.
- **Live suite (`npm run test:live`): 10 tests in 3 files.** Calls the real Dog CEO API, so it needs internet and is not part of the gate.

What the offline suite covers:

| Area | Examples |
|---|---|
| Pure logic | Breed and sub-breed ids and names, flattening the API response into the 165 elements, filter and sort, the Pack and Wishlist reducer. |
| API layer | The client and its error kinds (network, HTTP, unexpected shape), response validation. |
| Saved data | Reading and writing `localStorage`, corrupt or blocked storage, the one-time console warning when the browser cannot store. |
| Providers and hooks | Loading the breed list once (including React StrictMode), the random-image cache and Retry, notifications and the red pop-up, the Pack and Wishlist state. |
| Components and pages | Routing and redirects, the collapsible sidebar and drawer, the list rows, expansion driven by the URL, the details, the filter and sort toolbar, the Pack and Wishlist pages. |

Every feature was written test-first on its own branch: the tests were written and seen failing, then the feature was built until they passed.

A note on what the tests cannot show: they run in Node, which does not enforce browser CORS rules, and jsdom does not lay out pages. Before release, the built app was therefore also checked in a real Chrome against the real API: CORS, the 165-element list, expansion and deep links, Pack and Wishlist persistence across a browser restart, error states, and no horizontal scrolling at 320, 375, 768 and 1280 px.

## Dog API reference

The app uses the free **[Dog CEO Dog API](https://dog.ceo/dog-api/)** ([documentation](https://dog.ceo/dog-api/documentation/)). It needs no API key, and it allows browser requests from any origin (CORS), which is what makes a purely client-side app possible. It was checked on 2026-11-05.

Base URL: `https://dog.ceo/api`

| What the app needs | Endpoint | Response |
|---|---|---|
| All breeds and their sub-breeds | `GET /breeds/list/all` | `{ "message": { "hound": ["afghan", "basset", ...], "akita": [], ... }, "status": "success" }` |
| A random image of a sub-breed | `GET /breed/{breed}/{sub}/images/random` | `{ "message": "https://images.dog.ceo/breeds/hound-afghan/....jpg", "status": "success" }` |
| A random image of a breed without sub-breeds | `GET /breed/{breed}/images/random` | Same shape |

An unknown breed answers with HTTP 404 and `{ "status": "error", "message": "...", "code": 404 }`.

Things worth knowing:

- **Community-run.** There is no service guarantee, which is why the app shows clear error states and keeps working when a request fails. The API's status page is at <https://status.dog.ceo>.
- **Where the photos come from.** The Dog API credits the [Stanford Dogs Dataset](http://vision.stanford.edu/aditya86/ImageNetDogs/) as its original source of images.

## Shoutout

- **The Dog CEO Dog API** and its maintainer, [Elliott Landsborough](https://github.com/ElliottLandsborough/dog-ceo-api), and contributors, for running a free, open and friendly API that anyone can build on without signing up for anything. If you find it useful, the [About page](https://dog.ceo/dog-api/about) explains how to help with the hosting costs.
- **The Stanford Dogs Dataset** and the people behind it, for the photographs.
- **The open-source tools** this project stands on: [React](https://react.dev/), [Vite](https://vite.dev/), [React Router](https://reactrouter.com/), [TypeScript](https://www.typescriptlang.org/), [Vitest](https://vitest.dev/), [Testing Library](https://testing-library.com/) and [Oxlint](https://oxc.rs).
