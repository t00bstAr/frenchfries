# The Frenchfries Game

The whole game is one file, `index.html`. Vs computer and pass-the-phone work straight away. Online play uses Supabase Realtime, so it needs a free Supabase project. You don't need a database, tables or a server of your own.

## 1. Create the Supabase project (about 5 minutes)

1. Go to supabase.com, sign up and click **New project**. Any name and region works (pick one close to you, e.g. Frankfurt or Stockholm). Wait a minute while it starts.
2. Open **Project Settings → API** (in newer dashboards: **Project Settings → API Keys**).
3. Copy two values:
   - **Project URL**: looks like `https://abcdefgh.supabase.co`
   - **anon public key** (newer dashboards call it the **publishable key**): a long string
4. Open **Realtime → Settings** and make sure public channels are allowed, meaning "Private channels only" is **off**. That's the default for new projects.

The anon/publishable key is designed to be public, so it's fine for it to sit in a web page. Never paste the `service_role` or secret key into this file.

## 2. Add the keys to the game

Open `index.html`, find the `ONLINE PLAY SETTINGS` block near the top, and replace the two placeholders:

```js
window.FFG_CONFIG = {
  SUPABASE_URL: 'https://abcdefgh.supabase.co',
  SUPABASE_ANON_KEY: 'your-long-anon-key'
};
```

## 3. Try it on your computer

Open a terminal in this folder and run:

```
npx serve -s .
```

(`-s` sends every address to `index.html`, so links like `/join/1234` work. `python3 -m http.server 8000` also works, but only from the start page.)

Open the address it prints in two browser windows, pick **Online** in both, host in one and join from the other. Under "Open games", the status line should read "Connected · 1 other screen here".

## Addresses

Each screen has its own address: `/` (start), `/profile`, `/new` (set up a game), `/play` (a game on one phone) and `/game/1234` (an online game). The host's lobby shows a QR code for `/join/1234`. Scanning it opens the game and joins straight away, asking for a name first if that phone hasn't set up a player yet. On Netlify, `netlify.toml` routes all of these to `index.html`.

## 4. Put it on Netlify

The simplest way:
1. Go to app.netlify.com/drop.
2. Drag this whole folder onto the page.
3. You get a link like `https://random-name-123.netlify.app`. Rename it under **Site configuration → Change site name**, e.g. `frenchfries-game.netlify.app`.

To update later, open the site in Netlify, go to **Deploys**, and drag the folder in again.

The nicer long-term way: put the folder in a GitHub repo and choose **Add new site → Import from Git** in Netlify. Every push then deploys automatically. There's no build command, and the publish directory is the repo root.

## 5. On your phone

Open the Netlify link in Safari or Chrome, then **Share → Add to Home Screen** (Android Chrome also offers **Install app**). It opens full screen like an app, with its own icon, and the selfie button opens the front camera directly.

## Sharing and the app icon

Links to the game show a preview card with `og-image.png`. The app icons live in `icons/` and are listed in `manifest.webmanifest`. The `og:image` and `og:url` tags in `index.html` point to `https://frenchfries-game.netlify.app`, so change them if the site moves. To redraw the share image and icons, run `node tools/make-assets.js`.

## How online play works

- Everyone who has the site open joins a shared lobby channel on Supabase. A host's phone announces an open game there, which is how "Open games" fills up.
- Each game has its own channel (`ffg-room-<code>`). The host's phone is the referee: it holds the game (fry positions, trick fries, turns, score) and shares it with everyone. Guests share their name, a small selfie, live drag positions and "I pulled fry 7". The host checks it's really their turn and updates the game.
- Nothing is stored. When everyone closes the page, the game is gone. If the host closes the page, the game ends for everyone.
- Game codes aren't secret. Anyone with the link can see and join an open game, which is fine for a party game.

Supabase's free plan comfortably covers games with friends. If it ever gets popular, look at the connection and message limits on Supabase's pricing page.
