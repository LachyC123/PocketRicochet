# POCKET RICOCHET
## Claude Code development pack — version 1.0
Prepared 27 October 2026.

A one-thumb mobile arcade game about launching one ball, causing a spectacular chain reaction, and catching it to earn another shot.

This ZIP contains a build specification and ready-to-paste Claude prompt. It is not a playable game or a finished engine project. All tuning values are starting hypotheses to validate through play.

## How to use
1. Extract this folder into your project or attach its Markdown files to Claude.
2. Open 01_CLAUDE_BUILD_PROMPT.md and paste its contents into Claude Code.
3. Ask Claude to read the other files before implementing.
4. Build and review Pass 1 before adding progression or a shop.
5. Keep the control scheme simple even if later ideas sound exciting.

## Default implementation assumption
Portrait mobile browser prototype, TypeScript and Phaser, designed to run on iPhone and Android touchscreens. The gameplay specification is engine independent; for an existing Unity project, preserve Unity and translate the architecture. Do not install a second engine into an existing project. No paid assets, accounts, servers, or external AI APIs are needed for the first playable version.

## Files
- 01_CLAUDE_BUILD_PROMPT.md — actionable implementation instructions.
- 02_GAME_DESIGN.md — rules, controls, scoring, difficulty, onboarding.
- 03_CONTENT_AND_PROGRESSION.md — objects, layouts, rewards, unlocks.
- 04_ART_AUDIO_AND_UI.md — visual identity, animation, feedback and screens.
- 05_TECHNICAL_PLAN.md — physics, state machine, data and persistence.
- 06_BUILD_PASSES_AND_QA.md — staged milestones and acceptance checks.
- data/tuning.json — machine-readable initial constants.
- data/objects.json — starter object definitions.

## Non-negotiable priorities
One thumb. One ball. Short rounds. Clear misses. Fast voluntary restart. Reward good aim and clever chain reactions. No room traversal, joysticks, equipment inventories, active skill buttons, mandatory tutorials, or permanent stat upgrades.

