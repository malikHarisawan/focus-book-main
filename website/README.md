# FocusBook — Landing page

The marketing / download page for FocusBook. A single self-contained `index.html`
(no build step, no dependencies) ready to host on Vercel's free tier.

## Deploy to Vercel

### Option A — from the dashboard (easiest)

1. Push this repo to GitHub (it already is).
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. When Vercel asks for the **Root Directory**, choose `website`.
4. Framework preset: **Other** (it's a static site — no build command needed).
5. Click **Deploy**. You'll get a free `*.vercel.app` URL in a few seconds.

### Option B — from the CLI

```bash
npm i -g vercel
cd website
vercel          # first run links/creates the project
vercel --prod   # promote to production
```

## Editing the download links

The download buttons point at your GitHub Releases:

- **App installer:** `https://github.com/malikHarisawan/focus-book-main/releases/latest`
  — publish a release with `focusbook-setup.exe` attached (the artifact name from
  `electron-builder.yml`) and the button just works.
- **Extension:** links to the `extension/` folder in the repo with load-unpacked
  instructions shown inline on the page.

Search `index.html` for `github.com/malikHarisawan/focus-book-main` to change them.

## Custom domain

In the Vercel project → **Settings → Domains**, add your domain and follow the DNS
instructions. HTTPS is provisioned automatically.

## Notes

- The page is a single file — everything (CSS, JS, SVG icons, the animated product
  mock) is inline. No external requests, no fonts loaded over the network.
- Light and dark themes both ship; there's a toggle in the nav, and it also follows
  the visitor's OS preference by default.
