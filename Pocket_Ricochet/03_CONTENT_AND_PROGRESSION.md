# Content and progression

## Starter object roster
| Object | Rule | Readable signal | Scope |
|---|---|---|---|
| Crate | 1 hit destroys; 10 points | warm wood with a large crack on impact | Pass 1 |
| Paint pot | 1 hit destroys; 15 points; radial blast radius 64 | colour splash and visible circular burst | Pass 1 |
| Bell | once per shot, primes next destruction ×2 | swings and lights a small ×2 indicator | Pass 1 |
| Rubber bumper | reflects; no score; indestructible | squash and spring recovery | Pass 2 |
| Glass jar | 1 hit; 20 points; narrow target | bright rim and tiny shards | Pass 2 |
| Armoured tin | 2 hits; 30 points on destruction | lid pops off at first hit | Pass 3 |
| Spring pad | adds an authored directional reflection | arrow printed on the pad | Later |
| Support clip | removes attached shelf on destruction | visible connectors to supported objects | Later |

Only the first three types are required for the first playable slice. Do not implement all listed ideas at once.
Paint blasts can trigger other paint pots. Use a queued event system and a destroyed flag to prevent duplicates.
Bells remain after activation; their per-shot flag resets after a catch.
Later support/shelf mechanics need their own clear physical rules. Keep them out until ordinary collisions feel excellent.

## Layout grammar
Author templates first, then vary safe slots, object colours and mirrored orientation.
Every board must offer a clear direct hit, a visible bank-shot opportunity and at least one understandable interaction.
Minimum object separation is 8 logical units beyond collision shapes. Keep at least one 40-unit opening into the upper region. Do not encase the ball spawn or fill the return corridor.
Max initial objects: 12; max after refills: 18.
Indestructible objects never count towards board-clear checks.
Use seeded randomness and validate before use; fallback to an authored safe board when validation fails.

Starter templates:
1. FIRST POP: six crates in two rows, one central paint pot, one side bell. Direct hit teaches destruction; angled hit demonstrates bell bonus.
2. BANK SHOT: mirrored side clusters, bell near left wall and paint pot beyond it. A wall bank can connect both.
3. DOMINO PAINT: three paint pots spaced within blast reach, with crates along the outer edges. One accurate hit sets off the chain.
4. SPLIT DECISION: a dense low-value crate cluster versus a smaller bell-and-jar route. Both are viable.
5. RUBBER ALLEY: two bumpers guiding an obvious bank route, with generous gaps and no closed loop.
6. TIN CAN PARTY: armoured tins protect paint pots, inviting a double bounce.
Implement templates 1–3 first. Mirror and colour variation do not require new rules.

## Rewards that support replay
Pay earned coins for banked score: floor(banked score / 100), capped at 25 per run, plus 1 coin for completing at least one catch. A zero-catch failure earns zero.
The cap is an initial economy safeguard, not a reason to push the player to restart.
First cosmetic target: approximately 5–8 ordinary runs, subject to actual score distribution.
Initial price ladder: 25 / 60 / 100 coins. Show prices and direct purchases.
No gameplay power, random paid crates, duplicate cosmetics, energy lives or streak penalties.
Optional rare visual encounters: a golden bell or a tiny mascot reacting behind the glass. These are delight, not essential currency sources. Do not delay core mechanics to implement them.
All coin awards are idempotent: one result per run ID, including after app resume.

## Cosmetic collection
Balls: original red rubber, eight-ball, orange, tiny planet, wrapped sweet, eyeball.
Catchers: padded mitt, soap dish, velvet tray, robot palm.
Cabinets: toy workshop, candy shelf, seaside arcade.
Trails: short chalk dots, confetti flecks, soft comet. Trails cannot obscure the current ball position.
Keep geometry and contrast equivalent across competitive cosmetics. The eight-ball needs a bright rim on dark backgrounds.
First release candidate: 6 ball looks, 3 catchers, 2 cabinets. Build only 2 ball looks in the first collection pass.

## Competition and repeat visits
Local best score first. Optional later: one daily seeded challenge with identical rules and a local best.
Do not label a local score “global.” Real friend/global leaderboards require identity, score validation, moderation and backend planning outside this pack.
Share later through the platform share sheet: cabinet screenshot, banked score and catch count, with no personal information unless explicitly supplied.
If rotating challenges are added, archive them so players can return later. Notifications are opt-in and outside MVP.
Optional future monetisation: clearly priced cosmetic packs or a one-time theme bundle. No purchasable competitive advantage or paid revive in ranked runs. Any real purchase integration requires separate platform and policy work.

## What to measure
Observe whether a new player can aim, launch and attempt a catch without verbal coaching.
Track local anonymous test metrics: first catch success, median shot time, reason for miss, banked objects per shot and restarts initiated voluntarily.
Ask: “What made you miss?” If players cannot explain, improve readability.
Compare enjoyment and perceived fairness before adjusting reward frequency.
Do not treat longer sessions alone as proof of a better game.

