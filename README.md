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

The packaged extension is `dist/send-to-logseq-0.2.0.xpi`. You have three
options for installing it, in order of effort:

### 1. Temporary install (easiest, gone on Firefox restart)

1. Visit `about:debugging` in Firefox.
2. Click **This Firefox** → **Load Temporary Add-on…**
3. Pick the `.xpi` file (or `manifest.json` if you're loading from source).
4. Click the puzzle-piece icon in the toolbar → pin "Send to Logseq".
5. Right-click the toolbar icon → **Options** (or open via `about:addons`).
   Paste the token, click **Test connection**, then **Save**.

### 2. Permanent install via Mozilla signing

1. Go to <https://addons.mozilla.org/developers/addon/submit/>
2. Choose **"On your own"** (self-distribution).
3. Upload the `.xpi`. Validation typically completes in under a minute.
4. Download the signed `.xpi` Mozilla returns.
5. In Firefox, `about:addons` → gear icon → **Install Add-on From File…**

### 3. Developer Edition / Nightly with signatures disabled

Set `xpinstall.signatures.required` to `false` in `about:config`, then
install the unsigned `.xpi` directly.

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
  exists, the properties block is not re-added.

  **Append to title (optional):** text you enter in this field is appended
  to the end of the page name with a space separator. Useful for grouping
  captures: setting it to `- reading` makes each capture create a page like
  `How WireGuard works - reading`. The field remembers its last value so
  you don't have to retype it for a session of similar captures; clear it
  to go back to plain titles.

## What gets called on the Logseq API

- `logseq.App.getUserConfigs` — reads your `preferredDateFormat`.
- `logseq.App.getCurrentGraph` — used by the "Test connection" button.
- `logseq.Editor.getPage` — checks if a page already exists before adding
  the properties block.
- `logseq.Editor.appendBlockInPage` — adds blocks.
- `logseq.Editor.createPage` — creates destination pages when needed.

## Notes & caveats

- **Local only.** The extension only talks to `127.0.0.1` / `localhost`.
- **Token in plain storage.** The token lives in `browser.storage.local`,
  which is unencrypted.
- **DB-version Logseq.** Built against the classic file-based graph.
  The same Editor APIs exist in the DB version but semantics may differ.
- **Date format.** Reads Logseq's `preferredDateFormat` each time.
  Supported override tokens: `yyyy yy MMMM MMM MM M do dd d EEEE EEE`.
- **Slashes in titles.** `/` and `\` are replaced with `-` to avoid
  accidental hierarchies.

## File layout

```
send-to-logseq/
├── LICENSE                        GPL-3.0-or-later
├── README.md
├── manifest.json
├── package.json                   build / lint scripts
├── popup.html / popup.js          UI shown when you click the toolbar icon
├── options.html / options.js      Settings page
├── lib/logseq.js                  API client + high-level flows
├── icons/
│   ├── icon.svg                   source
│   └── icon-{16,32,48,64,96,128}.png rendered for manifest
└── dist/
    └── send-to-logseq-0.2.0.xpi   the built extension
```

## Rebuilding from source

```sh
npm install               # one-time, installs web-ext
npm run icons             # regenerate PNGs from icon.svg (needs librsvg)
npm run lint              # validate manifest + code
npm run build             # produce the .xpi
npm run run               # launch a fresh Firefox with the extension loaded
```

Bump the `version` in both `manifest.json` and `package.json` before
each rebuild if you plan to re-sign via AMO.

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
