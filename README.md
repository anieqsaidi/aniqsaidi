# ASTRO TERMINAL — a retro-terminal blog template

An [Astro](https://astro.build) template styled after 1980s CRT terminals:
an amber (or green) phosphor CRT screen with scanlines, glow, and the
authentic IBM VGA 8×16 font (with Cyrillic support).

## Features

- **Two themes**: amber (default) and green "phosphor". Toggle with the
  THEME button or the `T` key; the choice is remembered.
- **CRT effects**: scanlines, vignette, a rolling scan bar, and a subtle
  flicker (all disabled under `prefers-reduced-motion`).
- **Power-on screen**: on the first visit of a session, a mainframe-style
  boot sequence with a POST log plays; dismiss it with any key or click.
  It won't show again for the rest of the session. The fictional vendor
  name (`SITE_VENDOR`, `SITE_SYSTEM`, `SITE_MODEL`) lives in
  `src/consts.ts` — change it to your own.
- **Hacking 404**: the "file not found" page is a password-guessing
  minigame (hex addresses, hidden words, attempts, likeness). The real
  links are always available, so it's an easter egg, not a dead end.
- **Private mode (optional)**: the same minigame as a gate over the whole
  site (see below).
- **Content-collections blog**: posts are plain Markdown files; hero
  images and in-post images are optimized by Astro automatically and
  tinted to match the current theme.
- **Archive by year, tags, RSS, and an "about" page.**
- **Terminal sound**: hovering menu rows, links and the minigame grid
  plays a short blip; selecting, failing and unlocking have their own
  signals. Toggle with the `SND` button (the choice is remembered). On
  phones sound starts **off** — there is no hovering there, which is most of
  what it exists for — but an explicit choice always wins over that default.
  Signals are synthesized with the Web Audio API — low square tones run
  through a lowpass filter, so they sound like a speaker inside the case
  rather than a clean UI chime. The one exception is the "access denied"
  buzz, a CC0 sample from Kenney's
  [Interface Sounds](https://kenney.nl/assets/interface-sounds) pack
  (see `public/sounds/CREDITS.txt`). Any signal can be swapped for a file
  of your own: drop it in `public/sounds/` and add it to `SFX_SAMPLES` in
  `src/consts.ts` — remove the entry and the synth takes over again. Just
  use audio you have the rights to.
- **Lightweight on phones**: below 640px the terminal drops what hurts on a
  small screen — scanlines (they alias into moire on dense displays), the
  vignette, the flicker animation, text glow, the boot screen and the outer
  frame border. The `THEME` and `SND` buttons move from the header to the
  footer, where they scroll away with the content instead of costing a
  permanent nav line. The minigame swaps its character grid for a list of
  tappable 48px rows, since the grid means ~344 targets of about 9x15px. Post rows,
  nav links and buttons all get touch-sized hit areas, and wide tables scroll
  inside themselves instead of dragging the page sideways.
- **Keyboard shortcuts**: `H` — home, `A` — archive, `T` — theme
  (they also work on a Russian keyboard layout). Desktop only, naturally.

## Adding a post

Create a Markdown file in `src/content/blog/`:

```md
---
title: 'Post title'
description: 'Short summary for lists and RSS.'
pubDate: 2026-07-23
tags: ['tag1', 'tag2']
heroImage: './images/photo.png' # optional
draft: false                    # true — hide from the build
---

Post body. Images: ![caption](./images/photo.png)
```

Put images in `src/content/blog/images/`.

## Private mode

`src/consts.ts` has a flag:

```ts
export const PRIVATE_MODE = false; // true — enable the gate
```

When `true`, the whole site is covered by the hacking minigame at the
start of every new session. Crack the password and access stays open for
the rest of the session (an `unlocked` flag in `sessionStorage`);
navigating between pages no longer shows the gate. A new tab/session
brings the gate back. Fail all attempts and a `[ RETRY ]` button
regenerates the board.

> **Note:** the site is static, so this is a cosmetic client-side lock
> "for the vibe", **not real protection** — the content is still present
> in the HTML (visible via `curl`, view-source, or with JS disabled). For
> real privacy you need server-side rendering/auth (Astro in SSR mode with
> middleware and a session).

## Making it yours

- `src/consts.ts` — site title, tagline, description, version, and the
  `PRIVATE_MODE` flag.
- `astro.config.mjs` — set `site` (your site's URL, required for RSS).
- `src/pages/about.astro` — fill in your "personal file".
- `src/styles/terminal.css` — theme colors, effects, typography.

## Structure

```text
/
├── public/
│   └── fonts/                  # IBM VGA font (woff) + license
├── src/
│   ├── components/             # Frame, PostItem, header, footer, HackGate
│   ├── content/blog/           # posts (.md) and their images
│   ├── layouts/Layout.astro    # base layout + themes + hotkeys + power-on
│   ├── pages/                  # home, archive, posts, tags, about, 404, rss
│   ├── scripts/hackGame.ts     # hacking minigame (404 and private gate)
│   ├── scripts/sfx.ts          # Web Audio terminal sound (synth + optional samples)
│   ├── styles/terminal.css     # all the terminal styling
│   ├── consts.ts               # site settings (+ PRIVATE_MODE)
│   └── content.config.ts       # blog collection schema
└── astro.config.mjs
```

## Commands

| Command           | Action                                    |
| :---------------- | :---------------------------------------- |
| `npm install`     | Install dependencies                      |
| `npm run dev`     | Dev server at `localhost:4321`            |
| `npm run build`   | Build the site into `./dist/`             |
| `npm run preview` | Preview the built site before deploying   |

## Google Analytics

Create a GA4 web data stream for the production domain, then set its
measurement ID in the production environment:

```env
PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

The Google tag is included on public production pages only. It is omitted
from `/admin` and from the development server, preventing local and admin
activity from contaminating portfolio traffic reports. Standard page views
are collected automatically after the production site is rebuilt and deployed.

## Font license

The font is "WebPlus IBM VGA 8x16" from
[The Ultimate Oldschool PC Font Pack](https://int10h.org/oldschool-pc-fonts/)
(VileR, int10h.org), licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
License text: `public/fonts/FONT-LICENSE.txt`.
