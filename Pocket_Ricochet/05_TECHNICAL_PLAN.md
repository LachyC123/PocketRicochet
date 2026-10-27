# Technical plan

## Modules
GameSession owns state, run ID, score, catches and difficulty.
InputController maps screen coordinates into logical space and tracks one primary pointer.
BallSimulation owns position, velocity and collision/return state.
BoardGenerator instantiates validated templates using a seed.
InteractionResolver processes damage, bells, explosions and scoring once per event.
Presentation subscribes to events for sounds, particles, animations and UI.
SaveRepository persists versioned settings, best and currency/cosmetics.
Keep simulation state independent of display objects.

Suggested layout:
src/game/session.ts
src/game/input.ts
src/game/ball.ts
src/game/interactions.ts
src/game/generation.ts
src/game/scoring.ts
src/scenes/GameScene.ts
src/ui/
src/data/
src/save/
tests/

Use the existing engine's equivalents if the workspace already has a project.

## State machine
HOME → AIM_READY → AIMING → FLIGHT → RETURNING → CATCH_SETTLE → AIM_READY
RETURNING → MISSED → RESULTS
RESULTS → AIM_READY on Retry, or HOME.
AIMING can cancel back to AIM_READY.
PAUSED preserves the previous active state and freezes simulation plus run timers.
Full-board clear is a pending flag handled after CATCH_SETTLE, never a separate mid-flight scene.
All incoming input is gated by state. Releasing an old pointer after resume must not fire.
On retry, cancel pending timers/tweens, recycle particles, clear damage queues, reset bell flags, detach stale pointer capture and create a new run ID.

## Physics reliability
Use a fixed simulation step, initially 1/120 second, with a bounded accumulator.
Clamp elapsed frame time and pause/resume cleanly instead of simulating minutes of background time.
Use swept circle collision against target boxes/circles and wall segments, or equivalent continuous collision detection. Ordinary discrete overlap is insufficient at high speed.
Reflect velocity with v' = v - 2(v·n)n, then separate by a tiny epsilon.
For multiple impacts within a step, consume time to the earliest impact, resolve, and continue the remaining step. Cap the collision loop at 8 and log pathological contact situations in development builds.
Damage an object once per meaningful contact entry; use contact separation to prevent repeated damage while embedded.
Return trajectory bypasses targets by design. Sweep ball and catcher movement across the catch plane, including pointer motion between ticks.
At return commitment, clamp target x to [arenaLeft + ballRadius, arenaRight - ballRadius].
Catcher centre must remain within [arenaLeft + catcherWidth/2, arenaRight - catcherWidth/2].
The catcher movement bounds and ball target range must permit edge catches when ball radius is included.

## Events and ordering
Events: ShotLaunched, TargetHit, TargetDestroyed, BellArmed, ExplosionQueued, ReturnCommitted, BallCaught, BallMissed, RunEnded.
On destruction: mark destroyed immediately, enqueue blast if applicable, calculate the destruction event once, then spawn cosmetics.
Resolve queued blasts in stable order. A destroyed pot cannot queue another blast.
Bell activation and destruction events in the same tick use collision time, then stable ID as tie-breaker.
At catch, fully resolve any damage queued earlier that tick before banking.
Keep run-end reward settlement atomic from the game model's perspective.

## Generation and reproducibility
Use a seeded PRNG, not untracked global randomness for board structure.
Store seed and rulesetVersion with a run summary. Keep cosmetic randomness separate.
Validate object bounds, separation, spawn clearance, return corridor and at least one accessible destructible target. Geometry validation is not proof of every tactical route; playtest templates.
After at most 10 failed placement attempts, use a known-safe template.
A daily challenge, if built, fixes template progression and seed; cosmetics cannot affect simulation. Cross-device competitive determinism would need additional verification.

## Save data
Schema: version, bestByMode, coins, ownedCosmetics, equippedCosmetics, settings, tutorialSeen, lastSettledRunId.
Validate types/ranges and keep a recoverable backup of the previous save.
If storage is unavailable, allow play and display a small “Progress cannot be saved on this device” notice.
Save rewards only once per run. Do not persist every physics tick.
Pause reliably on focus loss; run recovery after a full reload is optional and should not be promised without implementation.

## Performance
Pool particles and audio voices; cap decorative particles at 100, lower to 40 in reduced motion.
Keep visible physical targets at 18 or fewer. No simulated debris collision in MVP.
Avoid per-frame DOM creation, allocations in collision loops and expensive full-screen effects.
Benchmark real representative phones when available; desktop emulation alone cannot establish phone performance.
No API keys or secrets in the client. No networking is required for this spec.

## Data files
data/tuning.json contains starting values, including onboarding overrides.
data/objects.json contains starter target rules. Copy into the application's own config location and validate on load.
Runtime units are logical canvas units, seconds and points.
These files are design inputs, not working code. Extend schemas deliberately rather than silently ignoring unknown fields.

