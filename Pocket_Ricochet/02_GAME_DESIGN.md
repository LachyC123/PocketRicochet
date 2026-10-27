# Game design

## One-page charter
Fantasy: make one clever shot wreck a pocket-sized toy cabinet, then save the ball at the last moment.
Loop: aim → launch → trigger reactions → catch → repeat or miss → retry.
Differentiator: a deliberate aim phase paired with a very short manual catch phase; environmental interactions provide spectacle and tactical variety.
Platform: portrait touchscreens; desktop mouse fallback.
Session: target 20–60 seconds for an ordinary run, without a hard run timer.
Visual pillars: tactile toy materials, clean readable silhouettes, colourful contained destruction.
Reject: generic neon cyber UI, realistic rubble, menus layered over the playfield.
First slice: one arena containing crates, bells and paint pots; launch, chain, catch, score, miss, restart.
Assets: no supplied assets. Author cohesive simple 2D art; use original or properly licensed sound with attribution when required.
Performance: target stable 60 fps on representative phones, plus a functional 30 fps fallback.
Save: local personal best, settings and cosmetic progression. Network: none in the first release candidate.

## Screen geometry
Use a 360 × 640 logical portrait canvas, scaled without stretching.
Top 0–64: safe-area-aware score/pause strip.
Arena x=20–340, y=78–470: objects, top/side walls.
Catcher centre y=504, launch centre y=490.
Control strip y=540–628, above the device's bottom safe area.
Reserve the lower arena y=440–490 as a clear return corridor. Never spawn scenery that obscures the ball or catcher.
Adapt short screens by scaling the entire gameplay region; do not squeeze the catch window out of view.

## Exact input contract
Aiming begins only on a fresh primary-pointer down inside the lower control strip. Ignore secondary fingers.
Record the touch start and current point. The launch direction is derived from the fixed launch position towards a virtual aim point: launchX + 1.6 × horizontal drag, launchY - 180 - 0.5 × upward drag. Clamp direction to 25–155 degrees above the rightward horizontal. This is a drag-to-steer gesture, not pull-back power.
Show a short dotted path to the first collision and one reflected segment. No full-board perfect prediction.
Release launches at fixed speed. A tap without drag fires the default vertical shot. Drag distance never changes power.
After launch the pointer is released; any new touch in the strip starts relative catcher movement. Horizontal pointer displacement moves the catcher at gain 1.0, constrained to arena bounds. A thumb can lift and regrip without teleporting the catcher.
Allow catcher movement throughout flight. The player may plan where to wait.
A catch requires the descending ball's swept shape to intersect the catcher at its catch plane. It stops the ball, banks the shot, then enters a brief settle phase.
Require a fresh touch after settling to aim again. Existing touches must not launch accidentally.
Pause or pointer cancellation cancels an unlaunched aim; during flight it leaves catcher in place. App backgrounding pauses simulation.

## Run structure
Start without a separate level-selection menu. Show a simple play affordance over the cabinet.
Begin with a broad catcher and a forgiving first return. No forced loss.
Each successful catch starts another shot against the surviving arrangement. On a full clear, refill with a new validated layout after the catch; never rebuild the arena mid-flight.
After every third catch, add up to two objects to legal empty slots, capped at 18. Introduce these while aiming is temporarily locked for a 250 ms arrival animation.
A miss ends the run immediately after a short visible fall. Results show score, personal best, earned currency and Retry.
Retry creates a fresh seeded board with identical baseline difficulty; no loading scene and no ad interstitial.
Perfect play may continue indefinitely. Target session length through gradual catch difficulty, not hidden forced misses.

## Flight and return
Launch speed: 420 logical units/second; ordinary reflection preserves speed.
At 3.5 seconds, enter RETURNING. Clear the aim preview and show a distinct blue return trail.
The return is a designed arcade transition: pick a landing x from current position and heading, clamped to the catchable span, then travel along a clean downward path. Ignore object damage/collisions during return; objects desaturate briefly and the ball visibly becomes a translucent return orb.
Return duration: 0.9 seconds initially, decreasing to a floor of 0.65 seconds by catch 15. The landing marker appears for the final 0.45 seconds.
The marker shows the target; it does not move the catcher or alter the landing point after commitment.
When ball enters the bottom corridor descending before timeout, commit to an early return using its projected landing x. Apply the same minimum reaction duration.
The ball never attacks again during return. A successful catch ends the shot; it does not reflect upward automatically.
This controlled return avoids endless waiting and preserves an understandable catch challenge. Test whether the visual transition feels natural before adding elaborate features.

## Scoring
A crate or paint pot destroyed is one scoring event worth its base value.
Within a shot, destruction ordinal n uses multiplier min(5, 1 + floor((n-1)/3)).
Example: the first three objects use ×1; objects four to six use ×2.
A bell arms a ×2 multiplier for the next scoring destruction event only. A second bell while armed refreshes the effect, never stacks it. Re-hitting the same bell in the shot has no effect.
Process simultaneous explosion victims by stable object ID so results are deterministic.
Shot pending score is the sum of scoring events. A catch banks it; a miss loses the pending shot only. The results screen shows banked score and a separately labelled lost-shot amount.
A perfect catch occurs when ball centre is within the central 40% of catcher width. Add 25 banked points; do not multiply this bonus.
No points for repeatedly striking an indestructible bumper. This prevents farming.
All board-clearing destruction from a shot is processed before its final score is banked.
Catch streak is a readable statistic, not a second complicated multiplier.

## Difficulty
Initial catcher width 100; reduce by 2 units per catch, floor 72.
Keep fixed ball launch speed throughout the first prototype.
Increase layout complexity through angled bumpers and target relationships, not clutter.
Do not combine smaller catchers, higher speed and confusing new objects in the same early run.
Practice mode may use a 130-wide catcher and slower returns, with separate best score.
Skins never alter hitboxes, trajectories or preview accuracy.

## First-use teaching
Before shot 1: “Drag to aim. Lift to shoot.” Animate one faint hand gesture only if idle.
During the first flight: “Slide to catch.” Highlight the bottom strip and catcher.
First return: 1.2 seconds, with marker visible throughout.
After catch: “Caught! Shoot again.”
After miss: “Missed it. One more shot?” with Retry and Home both available.
Tutorial flags persist, and the tutorial can be replayed from settings.

