# Send to Logseq

A small Firefox extension that sends the current page to Logseq, either as a
link block on today's journal or as a freshly created page (which it also
links from the journal).

## One-time setup in Logseq

1. Open Logseq desktop.
2. Settings → Features → enable **HTTP APIs server**.
3. Click the `</>` icon in the title bar to open the HTTP API panel.
4. Click **Start server** (defaults to `http://127.0.0.1:12315`).
5. Click **Authorize new token**, give it a name, and copy the token.

## Install the extension

The packaged extension is `send-to-logseq-0.1.0.xpi`. You have three options
for installing it, in order of effort:

### 1. Temporary install (easiest, gone on Firefox restart)

1. Visit `about:debugging` in Firefox.
2. Click **This Firefox** → **Load Temporary Add-on…**
3. Pick the `.xpi` file (or `manifest.json` if you're loading from source).
4. Click the puzzle-piece icon in the toolbar → pin "Send to Logseq".
5. Right-click the toolbar icon → **Options** (or open via `about:addons`).
   Paste the token, click **Test connection**, then **Save**.

The extension disappears when you restart Firefox. Use this while you're
iterating or just trying it out.

### 2. Permanent install via Mozilla signing (recommended for keeping it)

Firefox release/beta won't permanently install unsigned add-ons. The
free way to get yours signed without publicly listing it on AMO:

1. Go to <https://addons.mozilla.org/developers/addon/submit/>
   (sign in / make a free developer account).
2. Choose **"On your own"** (self-distribution) when asked how you want
   to distribute.
3. Upload `send-to-logseq-0.1.0.xpi`. Validation typically completes in
   under a minute.
4. Download the signed `.xpi` Mozilla returns.
5. In Firefox, open `about:addons` → gear icon → **Install Add-on From File…**
   and pick the signed file. It now persists across restarts.

The extension stays unlisted (not findable via AMO search). Submitting
each new version means another signing round-trip; AMO requires unique
`version` strings in `manifest.json`.

### 3. Developer Edition / Nightly with signatures disabled

If you run Firefox Developer Edition, Nightly, or an Unbranded build,
set `xpinstall.signatures.required` to `false` in `about:config`, then
install the unsigned `.xpi` directly. **This does not work on regular
Firefox release or beta** — Mozilla removed that escape hatch years ago.

## Usage

Click the toolbar icon while on any page:

- **Append link to today's journal** — adds a `[Title](URL)` block to today's
  journal page.
- **Create as a new page** — creates (or reuses) a page named after the
  page title, adds the URL and your optional note as blocks, and appends
  a `[[Page Name]]` link to today's journal.
  On a freshly created page, a properties block is added at the top:

  ```
  source:: <url>
  date:: [[<today, in Logseq's date format>]]
  tags::
  ```

  `tags::` is left empty so you can fill it in. If the page already
  exists, the properties block is not re-added — your existing tags
  won't be clobbered.

## What gets called on the Logseq API

- `logseq.App.getUserConfigs` — to read your `preferredDateFormat` so today's
  journal page name matches what Logseq expects.
- `logseq.App.getCurrentGraph` — used by the "Test connection" button.
- `logseq.Editor.appendBlockInPage` — adds blocks.
- `logseq.Editor.createPage` — creates the destination page when needed
  (idempotent; returns the existing page if it's already there).

## Notes & caveats

- **Local only.** The extension only talks to `127.0.0.1` / `localhost`.
  Logseq's HTTP API doesn't bind elsewhere by default, and exposing it is a
  bad idea.
- **Token in plain storage.** The token lives in `browser.storage.local`,
  which is unencrypted. Fine for personal use; not OK if you share your
  Firefox profile with anyone untrusted.
- **DB-version Logseq.** This was built against the classic file-based graph.
  The same Editor APIs exist in the DB version but page naming and property
  semantics may differ — verify before relying on it.
- **Page name collisions.** Creating a page that already exists is a no-op,
  and the extension then appends to it. If you want different behavior
  (skip / error), edit `createPageAndLink` in `lib/logseq.js`.
- **Date format.** The extension reads Logseq's `preferredDateFormat` each
  time you click. If you use an unusual format and today's journal isn't
  found, set an override in the options page. Supported tokens:
  `yyyy yy MMMM MMM MM M do dd d EEEE EEE`.
- **Slashes in titles.** A page title containing `/` would create a Logseq
  hierarchy. The extension replaces `/` and `\` with `-` to avoid surprise
  hierarchies. Adjust `sanitizePageName` in `lib/logseq.js` if you want
  hierarchies for specific cases.

## Troubleshooting

- **"Could not reach Logseq at ..."** — Logseq isn't running, or the HTTP
  API server isn't started. Toggle it in the `</>` panel.
- **"Logseq rejected the token (401)"** — Re-authorize a new token in
  Logseq and paste it into the options page. Tokens can be revoked from
  the same panel.
- **"Connected, but no current graph reported"** — Open a graph in Logseq
  first.
- **Nothing appears on today's journal** — Logseq probably has a date
  format your override doesn't match. Clear the override (so it reads
  from Logseq) or fix it to match.

## File layout

```
send-to-logseq/
├── manifest.json
├── package.json                   build / lint scripts
├── popup.html / popup.js          UI shown when you click the toolbar icon
├── options.html / options.js      Settings page
├── lib/logseq.js                  API client + high-level flows
└── icons/
    ├── icon.svg                   source
    └── icon-{16,32,48,96,128}.png rendered for manifest
```

## Rebuilding from source

```sh
npm install               # one-time, installs web-ext
npm run icons             # regenerate PNGs from icon.svg (needs librsvg)
npm run lint              # validate manifest + code
npm run build             # produce a .zip you can rename to .xpi
npm run run               # launch a fresh Firefox with the extension loaded
```

Bump the `version` in both `manifest.json` and `package.json` before
each rebuild if you plan to re-sign via AMO; signing rejects duplicate
versions.

## License

Copyright (C) 2026 Frank Hirtz

This program is free software: you can redistribute it and/or modify it
under the terms of the GNU General Public License as published by the
Free Software Foundation, either version 3 of the License, or (at your
option) any later version.

This program is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
Public License for more details.

The full license text is in the [LICENSE](LICENSE) file.
