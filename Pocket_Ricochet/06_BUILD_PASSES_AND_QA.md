# Build passes and QA

## Pass 1 — prove the loop
Implement one styled cabinet, primary-pointer input, fixed-speed ball, reliable collision sweeps, crates/paint/bells, return, manual catch, score, failure and retry. Include first-shot teaching.
No shop, quests, unlock animations or remote services.
Review gate: a new player can complete launch → reaction → catch → relaunch → miss → retry using one thumb.
Evidence: active-play capture of aiming, chain reaction, return/catch and results; console inspection; actual ordinary input.

## Pass 2 — depth without new controls
Add three authored templates, bumper and jar, validated seed variation, progressive catcher difficulty, perfect catches and reduced-motion settings.
Review gate: players can deliberately choose a bank shot or chain, and describe why they missed.
Rebalance or simplify before expanding if catching dominates attention so much that aiming no longer matters.

## Pass 3 — finish presentation and persistence
Finish animation/sound coverage, add best score and settings persistence, two cosmetic ball options, fair direct coin purchases and basic collection screen.
Add armoured tins only if the first roster feels readable.
Review gate: repeated launch/retry cycles do not leak objects, listeners or audio; saved purchases remain consistent across reload.

## Pass 4 — device and release-candidate preparation
Test real phones when available, safe areas, long sessions, interrupted sessions, storage failure and muted play.
Add daily seeded challenge only after the normal mode is stable.
Produce local launch/build instructions, dependency lockfile, asset licence list and a short known-issues document.
This is not automatic app-store readiness: native packaging, signing, privacy disclosures, purchases and publishing are separate work.

## Focused correctness checks
1. A shot destroying 7 ordinary 10-point crates scores 30 + 60 + 30 = 120 pending points.
2. A bell before the first destruction doubles that first destruction only.
3. A bell followed by another bell still provides one ×2 next-destruction bonus.
4. Overlapping explosions cannot score or destroy the same object twice.
5. Miss after 120 pending points adds 0 to banked score.
6. Normal catch banks pending once; perfect catch adds 25 once.
7. RunEnd called twice pays coins only once.
8. Swept collision detects a ball crossing a thin target or catch plane in one frame.
9. An old pointer-up after catch or resume cannot launch.
10. No remaining destructibles triggers refill only after catch.
11. Retry removes all delayed explosions and old effects that could affect score.
12. Maximum difficulty never narrows catcher below 72 or return duration below 0.65 seconds.

## Manual play matrix
- First visit: tutorial makes sense without explanation.
- Touch: aim, release, regrip and catch with one thumb.
- Pointer exits strip: active capture remains coherent; second finger ignored.
- Fast device and throttled frame rate: same visible collision outcomes for representative test shots.
- Left and right edge: ball remains catchable.
- Mute: return and bell states still readable.
- Reduced motion: no loss of vital cues.
- App switch during aim, flight and results: resumes without teleport or accidental launch.
- Small screen and notched screen: pause, score, catcher and control strip remain usable.
- Landscape: portrait play region remains fully operable.
- 20 consecutive retries: clean reset, no accumulating objects/listeners.
- Reload after reward: no duplicate coins; settings and best retained.
- Storage denied: gameplay continues with an honest save notice.
- High chain: particles do not cover the ball or obscure the return marker.

## Tuning questions
Is the first catch too difficult? Increase onboarding return duration and make the marker clearer first.
Are shots boring? Improve target relationships and sound before adding a new system.
Do shots last too long? Reduce timeout, not visual readability.
Do misses feel random? Check target projection, relative drag, finger occlusion and collision sweeps.
Is the scoring confusing? Reduce UI to banked score plus one pending amount.
Do players ignore clever shots? Increase the reward visibility of chain reactions rather than selling stronger balls.

## Completion language
Report what was actually tested and on which device/browser.
Label visual placeholders, unavailable runtime tools and unverified performance honestly.
A passing build is not evidence that gameplay is fun. No retention or revenue predictions are validated by this pack.

