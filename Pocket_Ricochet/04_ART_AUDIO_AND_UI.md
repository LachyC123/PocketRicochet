# Art, audio and UI

## Identity: a tiny tactile arcade cabinet
Build a playful, physical-looking 2D toy cabinet. Warm cream backing, deep navy frame, coral-red ball, teal catcher and lemon-yellow bells. Targets have chunky outlines, soft offset shadows and rounded highlights.
Palette: cream #FFF2D7, ink #203047, coral #F3695C, teal #38B8AE, yellow #F4C94F.
Use a restrained background so the ball remains the highest-contrast moving object.
Visual quality comes from coherent proportions, material hints and animation; avoid unrelated asset packs and excessive neon bloom.
Provide original vector artwork or code-drawn assets with deliberate final styling. No generated bitmap is required for this development pack.

## Camera and presentation
Fixed orthographic view. No camera panning during a shot.
Subtle board reaction only: 1–2 logical units of shake on large explosions; no shake during the final catch window.
Score HUD: banked score large; pending shot points smaller with a distinct label.
Show only the bell ×2 badge when armed. Avoid floating labels for every tiny effect.
A clear ball silhouette must remain visible through explosions. Render it and its outline above all debris.

## Animation coverage
- Aim: dotted path eases in; catcher settles under the ball.
- Launch: ball compresses then stretches briefly along velocity.
- Crate destruction: 3–5 pooled chips, short impact flash.
- Paint pot: brief squash, radial splash, limited droplets.
- Bell: swing with diminishing amplitude and one bright ring.
- Bumper: compress in collision normal, recover over 100–160 ms.
- Return: blue outline/trail transition; targets desaturate slightly.
- Catch: catcher dips 5 units and rebounds; ball settles; score transfers visibly.
- Perfect catch: small star burst, distinct note, no full-screen interruption.
- Miss: ball falls beyond catcher, sound drops, then compact results.
- Unlock: brief reveal with dismiss control, never blocking immediate replay indefinitely.

## Audio
Create a coherent palette: rubber pop, wooden tick, ceramic plink, soft bell chime, paint splat and padded catch thump.
Pitch successive destructions up a musical scale within a bounded range; reset between shots.
Limit simultaneous destruction voices to 5. Prioritise catch, bell and return cues over debris.
Music is optional and quiet. Gameplay must work muted.
Browser audio starts only after user interaction; never treat blocked autoplay as a gameplay failure.
Use original, generated under suitable rights, or licensed sounds; keep attribution records. Do not claim licences without checking.

## Screens
Home: title, best score, large Play, small collection/settings. The cabinet is the background.
Play: score, pending points, pause, cabinet, catcher, blank thumb strip. No shop button or mission list.
Pause: Resume, Restart, Home, sound/haptics/reduced motion.
Results: score, best indicator if earned, catch count, coins earned, large Retry and smaller Home.
Collection: cosmetic previews, clear owned/equipped/price states, one currency balance.
For MVP, home and results can be light overlays on the same scene.

## Accessibility and mobile details
Minimum touch targets 44 CSS pixels; account for device safe areas.
Give the control strip a generous full-width touch area.
Keep symbols and silhouettes distinct so colour is not the only signal.
Reduced motion disables shake, strong flashes and excess particles, while retaining collision feedback.
Offer independent sound and music toggles. Haptics optional, feature-detected and never required.
Use short haptics on catch and major impact only; unsupported browsers silently omit them.
Left/right handed use should both work. Keep controls centred.
No portrait orientation lock dependency: if landscape is encountered, show a centred portrait play region with usable controls rather than a broken layout.

