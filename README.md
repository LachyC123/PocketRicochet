# Pocket Ricochet

A one-thumb portrait arcade game: aim and release one rubber ball into a toy cabinet, watch the chain reaction, then slide the catcher to save the ball and earn another shot. Miss and the run ends.

**Status: Pass 1 prototype** (prove the loop). The design brief this is built from lives in [`Pocket_Ricochet/`](Pocket_Ricochet/00_START_HERE.md), extracted from the uploaded development-pack ZIP.

## Play on a phone

- **Hosted (GitHub Pages):** `.github/workflows/deploy-pages.yml` tests, builds and publishes the game on every push to `main`. One-time setup: in the repository's **Settings → Pages**, set **Source** to **GitHub Actions**. The game is then at `https://<owner>.github.io/<repo>/`. GitHub Pages needs a public repository or a paid plan.
- **Install it:** open the link in Safari (iPhone) or Chrome (Android) and choose **Add to Home Screen**. It then launches full screen in portrait, with its own icon.
- **From your computer:** run `npm run dev` and open the printed **Network** URL on a phone on the same Wi-Fi.

On phones taller than 9:16, the canvas grows upward and fills the space with a cabinet marquee. The playfield and controls never change size, and the cabinet stays anchored to the bottom so the control strip sits under your thumb. Pinch-zoom, double-tap zoom and long-press menus are blocked. Sound starts on your first tap; iPhone's silent switch mutes it.

## Run it

Requires Node 20.19+ or 22.12+.

```bash
npm ci            # install exact versions from package-lock.json
npm run dev       # dev server on http://localhost:5173 (also on your LAN for phone testing)
npm test          # focused rule checks (Vitest)
npm run build     # typecheck + production bundle in dist/
npm run preview   # serve the production bundle
```

To try it on a phone, run `npm run dev` and open the printed **Network** URL on a phone on the same Wi-Fi.

## Controls

All input happens in the dark **control strip** under the cabinet.

| Phase | Gesture |
|---|---|
| Aim | Touch the strip and drag. The drag steers an aim point above the ball. A dotted guide shows the path to the first hit and one bounce. Drag distance never changes power. |
| Shoot | Lift your thumb. A tap without dragging shoots straight up. |
| Catch | During flight, touch anywhere in the strip and slide. The catcher follows your relative movement, so regripping never makes it jump. |
| Next shot | After a catch, lift and touch again. A finger still down from catching never fires a shot. |

The shot always ends within about 3.5 s. The ball then becomes a translucent blue **return orb** that ignores targets and drops along a clean arc. A blue **landing marker** appears for the final 0.45 s (the whole return on the first shot of a run). Desktop mouse works the same way. Esc pauses.

## Rules implemented (Pass 1)

- **Crate:** 10 pts. **Paint pot:** 15 pts, and its blast (radius 64) destroys anything nearby, including other pots. **Bell:** arms ×2 for the next destruction, once per bell per shot. A second bell refreshes the ×2; it doesn't stack.
- **Chain multiplier:** within a shot, destructions 1–3 score ×1, 4–6 score ×2, and so on, capped at ×5.
- **Banking:** a catch banks the shot's points. A **perfect catch** (centre 40% of the catcher, marked with ticks) adds +25, unmultiplied. A miss loses only the pending shot.
- **Difficulty:** the catcher shrinks from 100 to a floor of 72, and returns speed up from 0.9 s to a floor of 0.65 s by catch 15. The first return of a run is a forgiving 1.2 s.
- **Board:** after every third catch, up to 2 new objects arrive (cap 18). A full clear brings in a fresh validated layout after the catch, never mid-flight.
- **Coins:** results show coins earned (floor(score/100), capped at 25, +1 for at least one catch). Each run pays out once. There is no shop yet.
- **First-shot tutorial:** "Drag to aim. Lift to shoot." → "Slide to catch." → "Caught! Shoot again." Pause → *Replay tutorial* shows it again.

## Project layout

```
src/
  data/        tuning.json, objects.json (validated on load; unknown fields rejected), config.ts
  game/        rules and simulation, no rendering
    session.ts       state machine, fixed 1/120 s step, run lifecycle
    ball.ts          swept-circle flight with ordered multi-contact resolution
    geometry.ts      continuous collision primitives
    interactions.ts  hits, bells, queued blasts: each destruction scored exactly once
    scoring.ts       shot/run scoring, coins, difficulty curves
    generation.ts    seeded PRNG, templates 1–3, layout validation, refill placement
    input.ts         one-pointer gesture model and aim mapping
  save/        versioned localStorage save with backup and idempotent run settlement
  scenes/      GameScene: Phaser presentation, which reads the session and reacts to its events
  ui/          code-drawn art, pooled effects, synthesized sound, buttons
tests/         Vitest checks (49)
public/        web app manifest and home-screen icons
docs/pass1/    gameplay screenshots from the Pass 1 review
```

All art is drawn in code and all sound is synthesized with WebAudio at runtime. There are no third-party assets, so there's nothing to license or attribute.

`?qa=1` in the URL exposes the session on `window.__pocketRicochet`. It exists for automated browser checks and is not needed to play.

## Tests

`npm test` covers the twelve focused checks in `06_BUILD_PASSES_AND_QA.md`, plus state transitions, the input contract, data validation, generation validity and frame-rate determinism. The same seed and shot give identical results at 120, 60 and 30 fps.

See [CHANGELOG.md](CHANGELOG.md) for what was verified in a browser and what was not.
