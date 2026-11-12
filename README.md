# VEX VR Sim — Override (2026-27)

A browser-based (WebXR) VEX V5 robotics simulator for students: build a robot, code it in
VEXcode-style blocks or Python, test it on the Override field, and document the work in an
engineering notebook. Runs on a desktop browser, in the Meta Quest Browser, and on HTC Vive /
Index through SteamVR (Chrome or Edge).

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open the printed URL. For a headset on the same network use the `Network:` URL — WebXR needs
HTTPS on anything other than `localhost`, so for classroom use host the `dist/` folder
(`npm run build`) on any HTTPS static host.

## What is in it

| Area | Where | Notes |
| --- | --- | --- |
| Coding | `src/code/` | Blockly palette styled after VEXcode (Drivetrain, Motion, Pneumatics, Looks, Events, Control, Sensing, Operators, Variables, My Blocks), Python text mode (Skulpt), code viewer, monitor, devices, 8 slots, save/open |
| Robot builder | `src/ui/builder.js`, `src/sim/robotConfig.js` | 7 presets; 2/4-motor tank, X-drive, mecanum; red/green/blue cartridges; wheels and gearing; arm / four-bar / DR4B lift; motor or pneumatic claw; flipper piston; sensors |
| Pneumatics | Build → Pneumatics | reservoirs, regulator, cylinder size, single/double acting, air budget, schematic, cut list, assembly checklist; air is consumed in the sim |
| STL import | `src/ui/stlImport.js`, `src/sim/stlAnalyze.js` | detects wheels, motors, pistons, lift, claw, brain, tank; click to correct; becomes the robot body |
| John VEX | `src/ui/john.js` | hints, starter code, run reviews, keyword Q&A, rule lookups |
| Challenges | `src/ui/challenges.js` | 13 progressive challenges, 5-star thresholds, unlock ladder |
| Field + scoring | `src/sim/fieldData.js`, `src/sim/world.js` | Override elements, toggles, stacks, SC2–SC8 scoring, AWP check, 15 s + 1:45 match clock |
| Notebook | `src/ui/notebook.js` | design-process entries, sign/witness lock, decision matrix, test log, rubric self-check, PDF export |
| Rule book | `src/ui/rules.js`, `src/ui/rulesData.js` | paraphrased, sectioned, searchable; import the official PDF for full-text search |
| VR | `src/ui/vrui.js` | controller driving, ray-pointer menu panel, four viewpoints |

## Field accuracy

`src/sim/fieldData.js` marks every number as verified (Game Manual v2.1 text), secondary, or
estimated. Goal positions, quadrant boundaries, the Autonomous Line route and every starting
pin/cup position are **estimates** — the manual only gives them in drawings. They all live in
`LAYOUT` in that one file so a field scan or the official STEP file can correct them.

## Controls

Keyboard: `W A S D` drive, `Q E` strafe, `R F` lift, `Space` claw, `T` flipper, `M` match load.
Gamepad: standard mapping. VR: left stick drive, right stick turn, triggers claw, grips lift,
A/X flipper, B/Y show/hide panel, stick click changes viewpoint.
