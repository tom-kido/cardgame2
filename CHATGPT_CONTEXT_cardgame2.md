# ChatGPT Context: cardgame2 (GitHub Pages project)

This file summarizes the current state, environment, and known details of the **cardgame2** repository so ChatGPT can quickly understand context at the start of a new conversation.

---

## Project Overview
- **Repository:** https://github.com/tom-kido/cardgame2  
- **Live (GitHub Pages):** https://tom-kido.github.io/cardgame2/
- **Purpose:** Browser-based card game prototype (currently simple card flip).  
- **Stack:** Vanilla **HTML / CSS / JavaScript** (no framework).  
- **Hosting:** Static hosting on **GitHub Pages**.

## Current Behavior (as observed on the live site)
- Displays a grid/list of card backs.
- Clicking a card flips it to show the front image.
- No full game loop yet (e.g., scoring, turns, win/lose).

## Repository Structure (relevant files so far)
Top-level (representative):
- `index.html`
- `cardgame.css`
- Image assets (e.g., `card_back.png`, `card_front.png`)
- `src/` (JavaScript source)

Known JS files under `src/` (shared by the user as raw links):
- `src/constants.js`
  - URL: https://raw.githubusercontent.com/tom-kido/cardgame2/refs/heads/main/src/constants.js
  - **Note:** Card image URLs were pointing to **`/cardgame/`** (likely from another project). For this repo deployed at `/cardgame2/`, absolute paths with `/cardgame/` can cause broken links on Pages; prefer paths that work both locally and on Pages (e.g., relative paths or base-URL–aware resolution).
  - Includes display/layout tunables such as `CARD_W`, `CARD_H`, `SNAP_RANGE_DEFAULT`, `HAND_OVERLAP_P1`, `HAND_OVERLAP_P2`.
- `src/scene.js`
  - URL: https://raw.githubusercontent.com/tom-kido/cardgame2/refs/heads/main/src/scene.js
- `src/main.js`
  - URL: https://raw.githubusercontent.com/tom-kido/cardgame2/refs/heads/main/src/main.js
- `src/dom.js`
  - URL: https://raw.githubusercontent.com/tom-kido/cardgame2/refs/heads/main/src/dom.js

> If additional files exist in `src/`, assume vanilla modules and a simple DOM-driven architecture unless otherwise noted in the session.

## Environment & Running Locally
- You can open `index.html` directly in a browser for basic static behavior.
- If ES Modules or CORS-sensitive features are used, open via a simple HTTP server, e.g.:
  - `npx serve` (Node), or
  - `python -m http.server` (Python)

## Key Notes & Pitfalls Discovered So Far
1. **Asset Paths / Base URL**
   - Image constants previously referenced `/cardgame/…` which doesn’t match this repo’s Pages base path `/cardgame2/`. Use relative paths or compute URLs against the current location to avoid 404s after renaming or moving the repo.
2. **Display vs. Logic Units**
   - `CARD_W`, `CARD_H`, `SNAP_RANGE_*`, `HAND_OVERLAP_*` appear to be UI-centric parameters. Keep units and intent clear (px vs. ratio) to maintain consistent behavior if card sizes change.
3. **Game State Scope (General)**
   - Current live behavior suggests simple flip interactions; full game rules (turns, scoring, deck/hands, AI) are not yet implemented.

## How to Collaborate with ChatGPT (suggested prompt add-ons)
- Provide **target file(s) and raw URLs** for any code you want reviewed or modified.
- State whether you want **minimal/diff-style edits** or a **refactor**.
- Mention the **deployment target** (GitHub Pages) and **path constraints** (base path).
- If adding features, specify desired **game rules** and **UI interactions** clearly.

---

*End of context. Paste this block at the start of a chat to brief ChatGPT quickly about the project.*
