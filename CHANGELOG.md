# Changelog

## Mobile playability (2026-10-27)

### Added
- Tall-screen layout: on phones taller than 9:16 the canvas grows upward to fill the screen, and the extra space shows a lit cabinet marquee. The playfield geometry is unchanged. Rotation, browser-bar resizes and split screen re-fit live.
- The cabinet is anchored to the bottom of the screen, inside the safe area, so the control strip is always within thumb reach.
- Home-screen install: web app manifest (fullscreen, portrait), 192/512 icons, apple-touch-icon, iOS standalone metadata.
- iOS hardening: audio unlocks and resumes from native `touchend`/`click`, including a silent-buffer unlock for older iOS. Pinch, double-tap zoom and long-press menus are blocked.
- GitHub Pages workflow: test, build and deploy on push to `main`.

### Verified
- Production build in Chromium with emulated touch at iPhone SE, iPhone 15, Pixel 7, 360×640 Android and iPad mini sizes. The canvas fills the screen with no gap at the bottom, renders at device resolution, a real touch starts the game and fires a shot, and there are no console errors. Rotating to landscape and back re-fits correctly.
- Still not tested on a physical phone.

## Pass 1: prove the loop (2026-10-27)

### Added
- TypeScript + Phaser 4.2.1 portrait prototype (Vite 8, Vitest 5), 360×640 logical canvas, safe-area aware, rendered at device resolution.
- One styled toy cabinet; crates, paint pots and bells; FIRST POP, BANK SHOT and DOMINO PAINT templates with seeded mirror/jitter variation, validation and a safe fallback.
- Drag-to-steer aiming with a two-segment preview; fixed-speed launch; relative-drag catcher; controlled return with landing marker; manual catch with perfect-catch bonus; miss → results → one-tap retry.
- Swept collision on a fixed 1/120 s step (up to 8 ordered contacts per step); queued, deterministic paint-blast chains.
- First-shot tutorial, pause menu (resume / restart / home / sound / calm motion / replay tutorial), results screen, local best score, coins per run (no shop).
- Code-synthesized sound palette with pentatonic pitch climb per shot and a 5-voice debris cap; optional haptics on catch and blasts.
- 49 Vitest checks.

### Deliberate interpretations of the brief
- If a shot clears every destructible target, the return starts 0.35 s later instead of waiting out the full 3.5 s.
- A paint blast deals one damage to each destructible in range; bells and walls are unaffected.
- The forgiving 1.2 s first return applies to the first shot of every run, not only the very first run.
- Data schema extended deliberately (`tuning.json` schemaVersion 2) with the brief's layout and control constants: launch X, corridor, control strip, aim gains/angles, blast delay and similar.

### Verified
- Unit/integration: the 12 focused correctness checks, state machine paths, stale-pointer and pause/resume launch safety, secondary-finger rejection, relative regrip, edge catches, refill timing and caps, retry cleanup, 20 consecutive retries, save backup recovery, storage failure, and determinism at 120/60/30 fps.
- Browser (headless Chromium via Playwright, emulated 390×844 touch phone, real CDP touch events): home → play → tutorial → aim → launch → paint-pot chain → return → catch → relaunch → miss → results → retry → pause/resume; landscape layout; production build; storage denied (notice shown, play continues); reload keeps best/coins/tutorial flag with no double payout; 20 retries with no growth in display objects or listeners; second finger ignored while aiming; no console errors.

### Fixed during review
- Phaser's smoothed frame delta is capped at its 60 fps target, so the game ran in slow motion below 60 fps. The simulation now uses the raw frame time, which keeps a 30 fps device playing at real speed.
- Paint pots vanished for the 0.12 s before their blast. They now swell, then burst.
- FIRST POP's pot sat at the edge of blast reach, so the teaching tap shot sometimes chained and sometimes didn't. Moved up so it reliably clears the bottom row.

### Not tested / known limitations
- **No real phone was available.** Touch was emulated in desktop Chromium. Safe-area insets, notches, iOS Safari audio unlock, haptics and real-device frame rate are unverified.
- **Performance is unmeasured.** The container renders WebGL in software at about 20 fps, which says nothing about phones. The game stays correct at that rate, but 60 fps on representative phones is unverified.
- **Sound was not listened to.** Audio runs only after a user gesture, and no audio output was available here.
- **Fun and fairness are untested.** Nobody has played it yet; the tuning values are still the brief's hypotheses.
- Bumper, jar and armoured tin are defined in data but not placed (Pass 2/3). No collection or shop screen yet (Pass 3).
- The JS bundle is about 1.4 MB (376 KB gzipped), mostly Phaser.
