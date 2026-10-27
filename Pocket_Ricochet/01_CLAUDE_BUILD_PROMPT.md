# Paste this into Claude Code

Build POCKET RICOCHET from the accompanying specification. Read all numbered Markdown files and both JSON files before editing. Treat these files as the product brief, not as evidence that anything has already been implemented.

The player uses one thumb to aim and release one rubber ball into a small portrait arena, watches a short satisfying chain reaction, and slides a catcher along the bottom to catch the returning ball. A catch secures the shot's points and gives another shot. A miss ends the run. The game should be understandable in seconds.

Inspect the workspace, existing instructions, installed tooling and engine first. Preserve existing working features. If empty, default to a TypeScript/Phaser mobile browser project. Verify dependency compatibility against available official documentation when choosing versions. Do not add a backend, accounts, payments, ads, multiplayer or AI integration to the prototype.

Build Pass 1 only first: one finished-feeling arena, one ball, aiming, reliable collisions, three interactive object types, manual catch, scoring, miss and one-tap retry. Use authored 2D shapes and a cohesive toy-cabinet style where external assets are unavailable. Do not disguise a placeholder build as polished. Make the tutorial part of the first actual shot.

Important controls:
- Aim by touching the lower control strip and dragging. Use horizontal/vertical drag to move a virtual aim point above the fixed launch position, as specified in 02_GAME_DESIGN.md; clamp to the legal upward angle range.
- Lifting launches at a fixed speed.
- During flight, the same strip moves the catcher horizontally using a relative drag, so touching down never teleports it.
- The catcher is visible above the thumb zone. There is no catch button.
- A caught ball stops and waits for another fresh touch. Never auto-launch from the previous gesture.
Read the complete control rules in 02_GAME_DESIGN.md.

Do not let shots bounce indefinitely. Implement the controlled return phase after the shot timeout, with a clearly signalled speed and a brief predicted landing marker. Treat this as a deliberate arcade rule, not simulated gravity. The whole flight should generally resolve within about six seconds.

Make collisions authoritative and particles cosmetic. A paint explosion must award each destroyed object once. A bell primes only the next scoring destruction event. Never count particles as damage. Avoid an implementation in which a single frame-rate spike lets the ball tunnel through a shelf or catcher.

Separate game state, rules, generation, input and presentation. Keep tuning and object definitions in data. Ship a lockfile and concise local run instructions. Add focused checks for score bookkeeping, collision sweeps, state transitions and restart cleanup. Actually play using ordinary touch or mouse input and capture gameplay screenshots. If device/browser tools are unavailable, say precisely what was not tested.

After Pass 1 report: what works, controls, launch instructions, actual test evidence, known limitations and your recommended next correction. Pause for review before expanding. Do not jump ahead to a collection screen while launch/catch feel is weak.

The pack's numbers are tunable targets, not validated balance. Aim for a fun 20–60-second typical run, but never terminate a skilled player's run with unavoidable failure. No fabricated retention figures or claims of commercial success.

If later passes are approved, proceed through the milestone file in order. Keep a short changelog and preserve working gameplay at every pass.

