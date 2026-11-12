// Rule Book data for the 2026-27 V5RC game "Override".
//
// IMPORTANT: everything in this file is a PARAPHRASED STUDY SUMMARY written for
// students. It is not the official text. The official VEX V5 Override Game
// Manual is the only authority. Items flagged `verify: true` describe standard
// V5RC principles whose exact wording and rule number must be confirmed in the
// official manual before relying on them.

export const MANUAL_VERSION = '2.1';

export const OFFICIAL_LINKS = [
  { label: 'vexrobotics.com/override-manual', url: 'https://www.vexrobotics.com/override-manual' },
  { label: 'manuals.vex.com/v5/override/v2.1', url: 'https://manuals.vex.com/v5/override/v2.1/' },
];

export const SECTIONS = [
  { id: 'quick', title: 'Quick reference', short: 'Quick', blurb: 'One-page cheat sheets to skim before a match.' },
  { id: 'intro', title: 'Section 1 - Introduction', short: 'Intro', blurb: 'What Override is and how to read the manual.' },
  { id: 'definitions', title: 'Section 2 - Definitions (glossary)', short: 'Glossary', blurb: 'Capitalised words in the manual have exact meanings. Learn these first.' },
  { id: 'scoring', title: 'Section 2 - Scoring rules (SC)', short: 'Scoring', blurb: 'How points, Ownership, the Autonomous Bonus and the Autonomous Win Point are worked out.' },
  { id: 'safety', title: 'Section 2 - Safety rules (S)', short: 'Safety', blurb: 'Rules that keep people safe. These always come first.' },
  { id: 'general', title: 'Section 2 - General game rules (G)', short: 'General', blurb: 'Conduct and gameplay rules that carry over from season to season.' },
  { id: 'specific', title: 'Section 2 - Specific game rules (SG)', short: 'Specific', blurb: 'Rules written just for Override.' },
  { id: 'robot', title: 'Section 3 - Robot rules (R)', short: 'Robot', blurb: 'What you may build with, and what inspection checks.' },
  { id: 'tournament', title: 'Section 4 - Tournament rules (T)', short: 'Tournament', blurb: 'How events, rankings and referee decisions work.' },
  { id: 'skills', title: 'Robot Skills Challenge (RSC)', short: 'Skills', blurb: 'One Robot, one minute, as many points as possible.' },
  { id: 'field', title: 'Appendix A - Field overview', short: 'Field', blurb: 'Dimensions, object counts and where everything starts.' },
];

/**
 * Item shape:
 *   id        unique id, also the deep-link key ("SG6", "R-motors", "DEF-pin")
 *   section   one of SECTIONS[].id
 *   title     short title
 *   summary   paraphrased explanation (blank line = new paragraph)
 *   points    optional bullet list
 *   table     optional { head: [], rows: [[]] }
 *   example   optional "what this looks like in a match"
 *   tags      search keywords
 *   see       related item ids
 *   severity  optional study hint: 'safety' | 'major' | 'minor' | 'info'
 *   verify    true when wording / number must be confirmed in the official manual
 */
export const RULES = [
  // ───────────────────────────── Quick reference ─────────────────────────────
  {
    id: 'QR-scoring', section: 'quick', title: 'Scoring cheat sheet',
    summary: 'Everything worth points in Override on one page. Scores are read at the end of the match, once everything has stopped moving or 5 seconds after the match ends (SC1).',
    table: {
      head: ['What', 'Points', 'Rule'],
      rows: [
        ['Autonomous Bonus (win the 15 s Autonomous Period)', '12  (tie: 6 each)', 'SC7'],
        ['Each Scored Pin Half in your Alliance colour', '5', 'SC3'],
        ['Each Scored yellow Pin Half that your Alliance Owns', '10', 'SC5'],
        ['Each of your Robots that ends in the Midfield', '8', 'SC6'],
      ],
    },
    points: [
      'A Pin only counts if it is Placed: nested with a Goal, or nested with a Placed Cup (SC2).',
      'Only the visible half of a Placed Pin is Scored. A half hidden inside a Goal, or inside the opaque (gray) half of a Cup, scores nothing (SC3).',
      'Yellow halves on Quadrant Goals belong to the Alliance whose colour is showing on that Quadrant\'s Toggle. Yellow Toggle = nobody gets them (SC4, SC5).',
      'Yellow halves on the Midfield Goal belong to the Alliance with more Robots in the Midfield at the end. Equal numbers = nobody (SC5).',
      'A Toggle only counts as red or blue if it is fully seated, at rest and no Robot is touching it (SC4).',
      'Autonomous Win Point: at least 6 Scored Pin Halves for your Alliance, at least 2 Goals with 2 or more of your Scored Pin Halves each, and neither Robot touching the Field Perimeter (SC8).',
    ],
    tags: ['points', 'score', 'cheat sheet', 'summary', 'how many points', 'values'],
    see: ['SC1', 'SC2', 'SC3', 'SC4', 'SC5', 'SC6', 'SC7', 'SC8'],
  },
  {
    id: 'QR-top10', section: 'quick', title: 'Top 10 ways teams get penalised',
    summary: 'These are the mistakes most likely to cost an Override team a match. Read the linked rule for each one, then practise until avoiding it is automatic.',
    points: [
      '1. Carrying too much - more than one Pin and one Cup at a time (SG6).',
      '2. Crossing the Autonomous Line during the Autonomous Period (SG7).',
      '3. Interfering with the opposing Alliance\'s coloured Goals (SG9).',
      '4. Pulling Placed Pins or Cups off neutral Goals (SG10).',
      '5. Driving into, or reaching into, the opponents\' Load Zone (SG13).',
      '6. Placing on the Midfield Goal in the last 10 seconds (SG12).',
      '7. Growing too big - past a 24 in x 24 in footprint (SG2) or taller than 50 in (SG3).',
      '8. Match loading the wrong way - during Autonomous, or through a Loader that is not yours (SG11).',
      '9. Sending Scoring Objects out of the Field (SG4).',
      '10. Humans touching the Robot or Field during a match, or drivers reacting badly to a referee call (G-hands-off, G-respect).',
    ],
    example: 'A good pre-match habit: one Drive Team Member reads this list out loud while the Robot is being placed on the Field.',
    tags: ['penalty', 'violation', 'mistakes', 'disqualification', 'dq', 'common errors', 'top ten'],
    see: ['SG6', 'SG7', 'SG9', 'SG10', 'SG13', 'SG12', 'SG2', 'SG3', 'SG11', 'SG4'],
  },
  {
    id: 'QR-timeline', section: 'quick', title: 'Match timeline',
    summary: 'A full Override match lasts two minutes of Robot time, split into two periods.',
    table: {
      head: ['When', 'What happens', 'Remember'],
      rows: [
        ['Before the start', 'Robots placed, Preloads loaded', 'Fit in 18 in per side, on your side of the Autonomous Line (SG1). One Preload Pin per Robot (SG5).'],
        ['0:00 - 0:15', 'Autonomous Period (15 s)', 'Code only. Do not cross the Autonomous Line (SG7). No match loading (SG11).'],
        ['After Autonomous', 'Autonomous Bonus and Win Point checked', '12 points to the winner, 6 each for a tie (SC7). Win Point judged separately (SC8).'],
        ['Next 1:45', 'Driver Controlled Period', 'Possession limit of one Pin and one Cup (SG6). Match Loads through your own Loaders.'],
        ['Last 0:10', 'Endgame', 'No Placing on the Midfield Goal (SG12). Get Robots into the Midfield for 8 points each.'],
        ['After the buzzer', 'Scoring', 'Counted when everything is at rest, or 5 s after the end (SC1).'],
      ],
    },
    tags: ['time', 'clock', 'periods', 'autonomous', 'driver control', 'endgame', 'length', 'duration'],
    see: ['SG1', 'SG5', 'SG7', 'SG11', 'SC7', 'SC8', 'SG6', 'SG12', 'SC1'],
  },
  {
    id: 'QR-awp', section: 'quick', title: 'Autonomous Win Point checklist',
    summary: 'The Autonomous Win Point (AWP) is separate from the 12-point Autonomous Bonus. Any Alliance that completes the whole list earns it, even if they lose the Autonomous Period.',
    points: [
      'At least 6 Pin Halves Scored for your Alliance.',
      'At least 2 Goals that each have 2 or more of your Scored Pin Halves.',
      'Goals in Quadrants on the opposing side of the Autonomous Line do not count towards the list.',
      'Neither of your Robots is touching the Field Perimeter when Autonomous ends.',
      'At events that qualify teams for the World Championship the bar is higher: at least 7 halves and at least 3 Goals.',
    ],
    example: 'Plan your two Autonomous routines as an Alliance: for example each Robot fills one Goal with two of your Pin Halves, then one Robot adds the extra halves - and both stop clear of the wall.',
    tags: ['awp', 'win point', 'autonomous', 'checklist', 'ranking'],
    see: ['SC8', 'SC7', 'T-rankings'],
  },

  // ─────────────────────────────── Section 1 ─────────────────────────────────
  {
    id: 'I-overview', section: 'intro', title: 'What is Override?',
    summary: 'Override is the 2026-27 V5 Robotics Competition game. Two Alliances - red and blue - of two Robots each play on a 12 ft x 12 ft foam Field. Robots stack Pins and Cups onto nine Goals, flip triangular Toggles to claim the yellow Pin Halves in each Quadrant, and race to finish the match inside the central Midfield.\n\nThe name gives the strategy away: almost anything your Alliance sets up can be overridden by the other side. A Toggle can be flipped back, and control of the Midfield Goal is only decided by who is standing in the Midfield at the very end.',
    points: [
      '63 Pins and 56 Cups are in play.',
      '9 Goals: 2 red, 2 blue and 5 neutral (4 short ones plus the tall Midfield Goal).',
      '4 Toggles, 4 Loaders, 4 Quadrants and 1 Midfield.',
      'Match = 15 s Autonomous + 1:45 Driver Controlled.',
    ],
    tags: ['overview', 'game', 'about', 'alliance', '2026', '2027', 'season', 'v5rc'],
    see: ['QR-scoring', 'A-field', 'QR-timeline'],
  },
  {
    id: 'I-reading', section: 'intro', title: 'How to read the manual',
    summary: 'Every rule has a code in angle brackets. The letters tell you which family it belongs to, so you can find it quickly when a referee mentions it.',
    table: {
      head: ['Prefix', 'Family', 'Where'],
      rows: [
        ['SC', 'Scoring rules', 'Section 2'],
        ['S', 'Safety rules', 'Section 2'],
        ['G / GG', 'General game rules', 'Section 2'],
        ['SG', 'Specific game rules (Override only)', 'Section 2'],
        ['R', 'Robot rules', 'Section 3'],
        ['T', 'Tournament rules', 'Section 4'],
        ['RSC', 'Robot Skills Challenge rules', 'Skills section'],
        ['VUG / VUR', 'VEX U variations (college teams)', 'VEX U section'],
      ],
    },
    points: [
      'Words with Capital Letters (Pin, Placed, Possession ...) are defined terms. They mean exactly what the definitions say, not what the everyday word means.',
      'Red boxes in the official manual are part of the rule. Blue boxes are notes and examples.',
      'This Rule Book uses the official numbers for scoring (SC), safety (S) and specific game (SG) rules. For general, Robot, tournament and Skills rules it uses descriptive ids such as R-motors - look up the real number in the official manual.',
    ],
    tags: ['prefix', 'rule numbers', 'codes', 'how to read', 'sc', 'sg', 'gg', 'rsc', 'vug', 'vur'],
    see: ['I-violations', 'I-updates'],
  },
  {
    id: 'I-violations', section: 'intro', title: 'Violations, Disablements and Disqualifications',
    summary: 'Breaking a rule is called a Violation. Referees sort Violations by how much they mattered. Small or accidental ones that did not change who won are usually handled with a warning. Ones that changed the winner of the match (Match Affecting), were done on purpose, or were repeated after warnings can lead to a Disqualification for that match.\n\nA Disablement is different: the Robot is switched off for the rest of the match, usually for a safety reason, but the team is not automatically Disqualified.\n\nThe "impact" labels in this Rule Book (Safety, High-risk, Watch out) are only our study hints about how costly a mistake tends to be. The Head Referee decides the real consequence using the official manual.',
    tags: ['violation', 'minor', 'major', 'match affecting', 'warning', 'disqualification', 'dq', 'disablement', 'penalty'],
    see: ['DEF-violation', 'DEF-match-affecting', 'DEF-disqualification', 'DEF-disablement', 'T-head-referee'],
    verify: true,
  },
  {
    id: 'I-updates', section: 'intro', title: 'Manual versions and the Q&A',
    summary: 'The Game Manual is updated several times during the season, and each update has a version number. This Rule Book summarises version 2.1. If a newer version is out, the newer official text wins.\n\nOfficial answers posted in the VEX Q&A system count as part of the rules. If your team is unsure how a rule applies to your Robot, search the Q&A first, and ask there if nobody has asked before.',
    points: [
      'Check the version number on the cover of the manual before every event.',
      'Use the "Import official PDF" button in this viewer to read and search the real manual next to these summaries.',
    ],
    tags: ['version', 'update', 'q&a', 'qa', 'official', 'changes', 'v2.1'],
    verify: true,
  },

  // ───────────────────────── Section 2: definitions ──────────────────────────
  {
    id: 'DEF-alliance', section: 'definitions', title: 'Alliance',
    summary: 'A group of two teams that play a match together. One Alliance is red and the other is blue. Alliances are assigned for each Qualification Match and chosen by teams for Elimination Matches.',
    tags: ['glossary', 'team', 'red', 'blue', 'partner'], severity: 'info', verify: true,
  },
  {
    id: 'DEF-alliance-station', section: 'definitions', title: 'Alliance Station',
    summary: 'The marked area beside the Field where an Alliance\'s Drive Team Members stand during a match. In Override each Alliance has two Loaders next to its Alliance Station.',
    tags: ['glossary', 'drivers', 'stand', 'loader'], see: ['DEF-loader', 'G-drive-team'], severity: 'info',
  },
  {
    id: 'DEF-auto-bonus', section: 'definitions', title: 'Autonomous Bonus',
    summary: 'A 12-point bonus given to the Alliance that has scored more points at the end of the Autonomous Period. If the Autonomous Period is tied, each Alliance gets 6 points.',
    tags: ['glossary', 'autonomous', 'bonus', '12 points', 'auton'], see: ['SC7'], severity: 'info',
  },
  {
    id: 'DEF-auto-line', section: 'definitions', title: 'Autonomous Line',
    summary: 'Two white tape lines that run diagonally across the Field and around the Midfield, together with the space between them. It splits the Field into a red side and a blue side for the Autonomous Period.',
    tags: ['glossary', 'autonomous', 'line', 'tape', 'diagonal', 'auton'], see: ['SG1', 'SG7', 'SG8'], severity: 'info',
  },
  {
    id: 'DEF-auto-period', section: 'definitions', title: 'Autonomous Period',
    summary: 'The first 15 seconds of a match. Robots run only on their pre-written code and sensors; nobody touches a controller.',
    tags: ['glossary', 'autonomous', '15 seconds', 'auton', 'code'], see: ['G-auton-hands-off', 'SG7'], severity: 'info',
  },
  {
    id: 'DEF-awp', section: 'definitions', title: 'Autonomous Win Point (AWP)',
    summary: 'One extra Win Point that an Alliance earns in a Qualification Match by finishing a list of tasks by the end of the Autonomous Period. Both Alliances can earn it in the same match. It is not the same thing as the Autonomous Bonus.',
    tags: ['glossary', 'awp', 'win point', 'autonomous', 'ranking'], see: ['SC8', 'QR-awp'], severity: 'info',
  },
  {
    id: 'DEF-cup', section: 'definitions', title: 'Cup',
    summary: 'A Scoring Object about 3.15 in (80 mm) across and 6.5 in (164.5 mm) tall. One half is opaque (gray) and the other half is transparent (clear). There are 56 Cups. A Cup is worth no points itself, but it lets you stack another Pin on top of a Pin - and whichever Pin Half ends up inside the opaque half is hidden and does not score.',
    tags: ['glossary', 'cup', 'scoring object', 'opaque', 'transparent', 'clear', 'gray', 'stack'], see: ['SC2', 'SC3', 'A-cups'], severity: 'info',
  },
  {
    id: 'DEF-disablement', section: 'definitions', title: 'Disablement',
    summary: 'A penalty in which a Robot is turned off for the rest of the match and its drivers put their controller down. It is mostly used when a Robot is unsafe or is damaging the Field.',
    tags: ['glossary', 'disabled', 'penalty', 'turned off'], see: ['I-violations', 'S1'], severity: 'info', verify: true,
  },
  {
    id: 'DEF-disqualification', section: 'definitions', title: 'Disqualification (DQ)',
    summary: 'A penalty for a serious Violation. In a Qualification Match the Disqualified team gets no Win Points for that match; in an Elimination Match the whole Alliance loses the match.',
    tags: ['glossary', 'dq', 'disqualified', 'penalty'], see: ['I-violations', 'T-head-referee'], severity: 'info', verify: true,
  },
  {
    id: 'DEF-drive-team', section: 'definitions', title: 'Drive Team Member',
    summary: 'A student who stands in the Alliance Station during a match. Each team may have a small number of Drive Team Members (three in recent seasons). Only Drive Team Members may handle controllers and Match Loads.',
    tags: ['glossary', 'driver', 'students', 'drive team'], see: ['G-drive-team', 'SG11'], severity: 'info', verify: true,
  },
  {
    id: 'DEF-driver-period', section: 'definitions', title: 'Driver Controlled Period',
    summary: 'The 1 minute 45 seconds that follow the Autonomous Period, when students drive the Robots with their controllers.',
    tags: ['glossary', 'driver control', 'teleop', '1:45', '105 seconds'], see: ['QR-timeline'], severity: 'info',
  },
  {
    id: 'DEF-endgame', section: 'definitions', title: 'Endgame',
    summary: 'The last 10 seconds of the Driver Controlled Period. Special rules apply: no Placing on the Midfield Goal, and plenty of contact in the Midfield is expected.',
    tags: ['glossary', 'endgame', 'last 10 seconds', 'final'], see: ['SG12', 'SC6'], severity: 'info',
  },
  {
    id: 'DEF-field-element', section: 'definitions', title: 'Field Element',
    summary: 'Everything that makes up the Field apart from the Scoring Objects and the Robots: the foam tiles, the Field Perimeter, the white tape, the Goals, the Toggles and the Loaders.',
    tags: ['glossary', 'field', 'element', 'tiles', 'tape'], see: ['A-field'], severity: 'info', verify: true,
  },
  {
    id: 'DEF-field-perimeter', section: 'definitions', title: 'Field Perimeter',
    summary: 'The wall around the Field, made of 12 straight sections and about 11.5 in tall. Touching it at the end of Autonomous costs you the Autonomous Win Point.',
    tags: ['glossary', 'wall', 'perimeter', 'border'], see: ['SC8', 'A-field'], severity: 'info',
  },
  {
    id: 'DEF-goal', section: 'definitions', title: 'Goal',
    summary: 'One of the nine posts that Pins are Placed on. Four are Alliance Goals (two red, two blue) and five are neutral Goals (four short ones and the tall Midfield Goal in the centre). Each Goal holds at most one Pin Half directly; build higher by alternating Cups and Pins.',
    tags: ['glossary', 'goal', 'post', 'neutral', 'alliance goal'], see: ['DEF-alliance-goal', 'DEF-midfield-goal', 'SC2', 'A-goals'], severity: 'info',
  },
  {
    id: 'DEF-alliance-goal', section: 'definitions', title: 'Alliance Goal',
    summary: 'A Goal in an Alliance\'s colour. There are two red and two blue. The opposing Alliance\'s Goals are protected - you may not interfere with them.',
    tags: ['glossary', 'goal', 'red goal', 'blue goal', 'protected'], see: ['SG9', 'DEF-goal'], severity: 'info',
  },
  {
    id: 'DEF-midfield', section: 'definitions', title: 'Midfield',
    summary: 'The square zone in the centre of the Field, surrounded by the four Quadrants. Each Robot that ends the match at least partly inside it earns 8 points, and the Alliance with more Robots there Owns the yellow Pin Halves on the Midfield Goal.',
    tags: ['glossary', 'midfield', 'centre', 'center', 'square', 'park'], see: ['SC5', 'SC6', 'SG12'], severity: 'info',
  },
  {
    id: 'DEF-midfield-goal', section: 'definitions', title: 'Midfield Goal',
    summary: 'The single tall neutral Goal in the middle of the Midfield. Its yellow Pin Halves go to whichever Alliance has more Robots in the Midfield at the end. Nothing may be Placed on it during the Endgame.',
    tags: ['glossary', 'goal', 'tall goal', 'centre goal', 'center goal', 'midfield'], see: ['SC5', 'SG12', 'SG10'], severity: 'info',
  },
  {
    id: 'DEF-loader', section: 'definitions', title: 'Loader',
    summary: 'A Field Element next to an Alliance Station that Drive Team Members use to feed Match Loads into the Field. There are four Loaders, two per Alliance. People put objects in; only Robots take objects out from the bottom.',
    tags: ['glossary', 'loader', 'match load', 'feed'], see: ['SG11', 'DEF-load-zone'], severity: 'info',
  },
  {
    id: 'DEF-load-zone', section: 'definitions', title: 'Load Zone',
    summary: 'The 3D space bounded by the Field Perimeter and the coloured tape around each Loader. Each Alliance\'s Load Zones are protected from the opposing Robots.',
    tags: ['glossary', 'load zone', 'loader', 'tape', 'protected'], see: ['SG13', 'DEF-loader'], severity: 'info',
  },
  {
    id: 'DEF-match', section: 'definitions', title: 'Match',
    summary: 'One game: a 15-second Autonomous Period followed by a 1:45 Driver Controlled Period, played by a red Alliance against a blue Alliance.',
    tags: ['glossary', 'match', 'game', 'two minutes'], see: ['QR-timeline'], severity: 'info',
  },
  {
    id: 'DEF-match-affecting', section: 'definitions', title: 'Match Affecting',
    summary: 'A Violation is Match Affecting when it changes which Alliance wins or loses the match. Referees work this out by comparing the points gained or lost because of the Violation with the final score difference.',
    tags: ['glossary', 'match affecting', 'violation', 'winner'], see: ['I-violations', 'SG10'], severity: 'info', verify: true,
  },
  {
    id: 'DEF-match-load', section: 'definitions', title: 'Match Load',
    summary: 'A Scoring Object that starts off the Field with the Drive Team and is added during the Driver Controlled Period through the Alliance\'s own Loaders. Each Alliance has 10 Pins in its own colour and yellow (red/yellow or blue/yellow) and 10 Cups; there are also 2 yellow/yellow Match Load Pins.',
    tags: ['glossary', 'match load', 'loader', 'introduce'], see: ['SG11', 'A-pins', 'A-cups'], severity: 'info',
  },
  {
    id: 'DEF-nested', section: 'definitions', title: 'Nested',
    summary: 'Two pieces are nested when one is fitted onto or into the other the way they were designed to connect - a Pin seated on a Goal, a Cup seated over a Pin, or a Pin seated in a Cup. An object that is only leaning on or balanced against something is not nested.',
    tags: ['glossary', 'nested', 'seated', 'stacked', 'fitted'], see: ['SC2'], severity: 'info', verify: true,
  },
  {
    id: 'DEF-owned', section: 'definitions', title: 'Owned (Ownership)',
    summary: 'Yellow Pin Halves do not belong to anyone until the match ends. A Scored yellow half is Owned by the Alliance that controls its Goal: by Toggle colour for Quadrant Goals, by Robot count in the Midfield for the Midfield Goal. Owned yellow halves are worth 10 points each.',
    tags: ['glossary', 'owned', 'ownership', 'yellow', 'control', 'claim'], see: ['SC5', 'SC4'], severity: 'info',
  },
  {
    id: 'DEF-pin', section: 'definitions', title: 'Pin',
    summary: 'The main Scoring Object: about 1.6 in (40 mm) across and 6.5 in (165 mm) tall, built from two Pin Halves. There are 63 Pins in four colour combinations: red/blue, red/yellow, blue/yellow and yellow/yellow.',
    tags: ['glossary', 'pin', 'scoring object', 'peg'], see: ['DEF-pin-half', 'A-pins', 'SC2'], severity: 'info',
  },
  {
    id: 'DEF-pin-half', section: 'definitions', title: 'Pin Half',
    summary: 'One end of a Pin. Each half is red, blue or yellow, and each half is scored on its own. A Scored red or blue half is worth 5 points to that Alliance; a Scored yellow half is worth 10 points to the Alliance that Owns it.',
    tags: ['glossary', 'pin half', 'half', 'colour', 'color', 'red', 'blue', 'yellow'], see: ['SC3', 'SC5'], severity: 'info',
  },
  {
    id: 'DEF-placed', section: 'definitions', title: 'Placed',
    summary: 'A Pin is Placed when it is nested with a Goal or with a Placed Cup. A Cup is Placed when it is nested with a Placed Pin. A stack is therefore a chain that must connect all the way down to a Goal: Goal, Pin, Cup, Pin, Cup ...',
    tags: ['glossary', 'placed', 'stack', 'nested', 'on goal'], see: ['SC2', 'DEF-nested'], severity: 'info',
  },
  {
    id: 'DEF-possession', section: 'definitions', title: 'Possession',
    summary: 'A Robot has Possession of a Scoring Object when it is carrying, holding or controlling it so that the object moves with the Robot - for example in a claw, an intake or a tray. Simply pushing (plowing) an object across the tiles with a flat part of the Robot is normally not Possession.',
    tags: ['glossary', 'possession', 'carry', 'hold', 'control', 'plowing', 'limit'], see: ['SG6'], severity: 'info', verify: true,
  },
  {
    id: 'DEF-preload', section: 'definitions', title: 'Preload',
    summary: 'A Pin that a team loads onto its Robot before the match starts. Each Robot gets one Preload Pin: red/yellow for red Robots, blue/yellow for blue Robots.',
    tags: ['glossary', 'preload', 'start', 'before match'], see: ['SG5'], severity: 'info',
  },
  {
    id: 'DEF-quadrant', section: 'definitions', title: 'Quadrant',
    summary: 'One of four triangular zones of the Field, each on one side of the Midfield and each with its own Toggle on the Field Perimeter. The Toggle decides who Owns the yellow Pin Halves on the Goals in that Quadrant.',
    tags: ['glossary', 'quadrant', 'triangle', 'zone', 'toggle'], see: ['SC5', 'DEF-toggle'], severity: 'info',
  },
  {
    id: 'DEF-robot', section: 'definitions', title: 'Robot',
    summary: 'The machine a team has built and that has passed inspection. Anything that is attached to it counts as part of the Robot for size and contact rules.',
    tags: ['glossary', 'robot', 'machine'], see: ['R-one-robot', 'R-inspection'], severity: 'info', verify: true,
  },
  {
    id: 'DEF-scored', section: 'definitions', title: 'Scored',
    summary: 'A Pin Half is Scored when its Pin is Placed and the half is visible at the end of the match. Halves inside a Goal or inside the opaque half of a Cup are hidden, so they are not Scored.',
    tags: ['glossary', 'scored', 'visible', 'hidden', 'counts'], see: ['SC3', 'SC2'], severity: 'info',
  },
  {
    id: 'DEF-scoring-object', section: 'definitions', title: 'Scoring Object',
    summary: 'A Pin or a Cup. Override uses 63 Pins and 56 Cups.',
    tags: ['glossary', 'scoring object', 'game piece', 'pin', 'cup'], see: ['DEF-pin', 'DEF-cup'], severity: 'info',
  },
  {
    id: 'DEF-toggle', section: 'definitions', title: 'Toggle',
    summary: 'A triangular Field Element with a red face, a blue face and a yellow face. There are four, one on each side of the Field Perimeter, and they all start with yellow facing up. Rolling a Toggle so your colour is up claims that Quadrant\'s yellow Pin Halves - if the Toggle is fully seated, at rest and untouched at the end.',
    tags: ['glossary', 'toggle', 'triangle', 'flip', 'switch', 'quadrant', 'yellow'], see: ['SC4', 'SC5'], severity: 'info',
  },
  {
    id: 'DEF-holding', section: 'definitions', title: 'Holding (Trapping, Pinning, Lifting)',
    summary: 'Holding means stopping an opposing Robot from moving freely: trapping it in a small part of the Field, pinning it against a wall or Field Element, or lifting it off the tiles. V5RC limits how long you may do this (a 5-second count in recent seasons) before you must back away.',
    tags: ['glossary', 'holding', 'trapping', 'pinning', 'lifting', 'defence', 'defense', '5 seconds'], see: ['G-holding'], severity: 'info', verify: true,
  },
  {
    id: 'DEF-violation', section: 'definitions', title: 'Violation (Minor / Major)',
    summary: 'Any breaking of a rule. Minor Violations are usually accidental and not Match Affecting, and normally earn a warning. Major Violations are Match Affecting, deliberate, or repeated, and can earn a Disqualification.',
    tags: ['glossary', 'violation', 'minor', 'major', 'warning', 'penalty'], see: ['I-violations'], severity: 'info', verify: true,
  },

  // ───────────────────────────── Scoring (SC) ────────────────────────────────
  {
    id: 'SC1', section: 'scoring', title: 'Scores are counted when everything stops',
    summary: 'Nothing is scored while the match is running. Referees evaluate the Field after the match, once every Robot, Scoring Object and Toggle has come to rest - or 5 seconds after the match ends, whichever comes first.',
    points: [
      'A stack that is wobbling at the buzzer counts however it has settled when the motion stops (or at the 5-second mark).',
      'Drivers: when the buzzer sounds, put controllers down and keep hands out of the Field until the referees have finished counting.',
    ],
    example: 'Your Robot bumps a Goal right at the buzzer and a Pin falls off two seconds later. That Pin is not Placed any more, so its halves do not score.',
    tags: ['scoring', 'end of match', 'at rest', '5 seconds', 'buzzer', 'when'],
    see: ['QR-scoring', 'G-hands-off'], severity: 'info',
  },
  {
    id: 'SC2', section: 'scoring', title: 'What counts as Placed',
    summary: 'A Pin is Placed when it is nested with a Goal, or nested with a Cup that is itself Placed. A Cup is Placed when it is nested with a Placed Pin. So every stack is a chain that starts at a Goal.\n\nEach Goal can hold only one Pin Half, and each half of a Cup can hold only one Pin Half. You cannot jam two Pins into the same spot and score both.',
    points: [
      'Legal stack: Goal -> Pin -> Cup -> Pin -> Cup -> Pin ...',
      'A Pin lying on the tiles, leaning on a Goal, or held by a Robot is not Placed.',
      'If the bottom of a stack comes off the Goal, everything above it stops being Placed too.',
    ],
    tags: ['placed', 'nested', 'stack', 'goal', 'cup', 'chain', 'one pin half'],
    see: ['DEF-placed', 'DEF-nested', 'SC3'], severity: 'info',
  },
  {
    id: 'SC3', section: 'scoring', title: 'Visible halves of Placed Pins are Scored',
    summary: 'Each half of a Placed Pin that you can see is Scored. A half that is nested inside a Goal, or inside the opaque (gray) half of a Cup, is not visible and scores nothing. A half inside the transparent half of a Cup can still be seen, so it still counts.\n\nA Scored red or blue half is worth 5 points to that Alliance. A Scored yellow half is worth 10 points to whichever Alliance Owns it.',
    points: [
      'Which half you push onto the Goal matters: that half is hidden. Put the colour you do not want to score on the bottom.',
      'Which way up a Cup goes matters too: the opaque half hides the Pin Half inside it, the clear half does not.',
      'You can hide an opponent-coloured half inside a Goal or a gray Cup half so it never scores.',
    ],
    example: 'A red/yellow Pin is pushed onto a Goal red-end-down. The red half is hidden inside the Goal (0 points) and the yellow half is showing (10 points to whoever Owns it).',
    tags: ['scored', 'visible', 'hidden', 'opaque', 'transparent', 'clear', '5 points', '10 points', 'pin half'],
    see: ['DEF-scored', 'SC2', 'SC5', 'QR-scoring'], severity: 'info',
  },
  {
    id: 'SC4', section: 'scoring', title: 'When a Toggle is "set"',
    summary: 'A Toggle is set to red or blue only if all three things are true at the end of the match: it is fully seated with that colour facing up, it is at rest, and no Robot is touching it. If any of those fail, the Toggle is treated as neutral (yellow), and nobody Owns that Quadrant\'s yellow Pin Halves.',
    points: [
      'A Toggle stuck half-way between faces is neutral.',
      'Leaning on a Toggle to "guard" it at the buzzer makes it neutral - back off before time runs out.',
      'An opponent touching your Toggle at the end also makes it neutral, so think about how you will defend it.',
    ],
    tags: ['toggle', 'set', 'seated', 'neutral', 'yellow', 'touching', 'at rest'],
    see: ['DEF-toggle', 'SC5'], severity: 'info',
  },
  {
    id: 'SC5', section: 'scoring', title: 'Who Owns the yellow Pin Halves',
    summary: 'Scored yellow Pin Halves are worth 10 points, but only to the Alliance that Owns them.\n\nQuadrant Goals: the yellow halves belong to the Alliance whose colour is set on that Quadrant\'s Toggle. If the Toggle is yellow or neutral, nobody gets them.\n\nMidfield Goal: the yellow halves belong to the Alliance with more Robots in the Midfield when the match ends. If both Alliances have the same number of Robots there (including none), nobody gets them.',
    table: {
      head: ['Goal location', 'Decided by', 'Nobody Owns them when'],
      rows: [
        ['Goals in a Quadrant', 'Colour set on that Quadrant\'s Toggle', 'Toggle is yellow / not set'],
        ['Midfield Goal', 'Which Alliance has more Robots in the Midfield at the end', 'Robot counts are tied'],
      ],
    },
    example: 'The Midfield Goal shows 4 yellow halves. Red has two Robots in the Midfield and blue has one. Red scores 4 x 10 = 40 for the halves plus 2 x 8 = 16 for the Robots.',
    tags: ['owned', 'ownership', 'yellow', 'toggle', 'quadrant', 'midfield goal', '10 points', 'control'],
    see: ['DEF-owned', 'SC4', 'SC6'], severity: 'info',
  },
  {
    id: 'SC6', section: 'scoring', title: 'Ending in the Midfield',
    summary: 'A Robot counts as ending in the Midfield if any part of it is at least partly within the Midfield when the match ends. Each such Robot earns its Alliance 8 points, and it also counts towards Ownership of the Midfield Goal\'s yellow halves.',
    points: [
      'You do not have to be completely inside - partly in is enough.',
      'Expect to be pushed. Rule SG12 warns that vigorous contact in the Midfield is normal during the Endgame.',
    ],
    tags: ['midfield', 'park', 'end', '8 points', 'robot', 'endgame'],
    see: ['DEF-midfield', 'SC5', 'SG12'], severity: 'info',
  },
  {
    id: 'SC7', section: 'scoring', title: 'Autonomous Bonus',
    summary: 'When the 15-second Autonomous Period ends, the Field is scored as it stands. The Alliance with more points wins the 12-point Autonomous Bonus; a tie gives each Alliance 6 points.\n\nRobot position is not counted for this - the 8 points for being in the Midfield only apply at the end of the match. If an Alliance breaks a rule during Autonomous, the bonus is awarded to the opposing Alliance.',
    tags: ['autonomous', 'bonus', '12 points', '6 points', 'tie', 'auton'],
    see: ['DEF-auto-bonus', 'SG7', 'SC8'], severity: 'info',
  },
  {
    id: 'SC8', section: 'scoring', title: 'Autonomous Win Point',
    summary: 'An Alliance earns the Autonomous Win Point if, at the end of the Autonomous Period, it has done all of the following:',
    points: [
      'At least 6 Pin Halves are Scored for the Alliance.',
      'At least 2 Goals each hold 2 or more of the Alliance\'s Scored Pin Halves.',
      'Quadrants on the opposing side of the Autonomous Line do not count towards these totals.',
      'Neither of the Alliance\'s Robots is contacting the Field Perimeter.',
      'At events that qualify teams for the World Championship: at least 7 halves and at least 3 Goals.',
    ],
    example: 'Both Alliances can earn the Win Point in the same match, and you can earn it even if you lose the Autonomous Bonus.',
    tags: ['awp', 'autonomous win point', 'win point', 'autonomous', '6 halves', '2 goals', 'worlds', 'perimeter'],
    see: ['DEF-awp', 'QR-awp', 'SC7', 'T-rankings'], severity: 'info',
  },

  // ─────────────────────────────── Safety (S) ────────────────────────────────
  {
    id: 'S1', section: 'safety', title: 'Be safe',
    summary: 'If a Robot or a person is doing something unsafe, or something that is damaging the Field or Scoring Objects, the referees can stop it straight away - including disabling the Robot or disqualifying the team. Safety comes before points, every time.',
    points: ['Tie back long hair, wear closed-toe shoes and eye protection in the pits and at the Field.', 'Never reach into a Robot that is powered on and enabled.'],
    tags: ['safety', 'safe', 'damage', 'dangerous', 'disable'],
    see: ['DEF-disablement'], severity: 'safety',
  },
  {
    id: 'S2', section: 'safety', title: 'Adult supervision',
    summary: 'Students must have a responsible adult with them at the event. The adult is there to keep everyone safe and well behaved - not to build, code or drive the Robot.',
    tags: ['safety', 'adult', 'supervision', 'coach', 'mentor', 'chaperone'],
    see: ['G-student-centred'], severity: 'safety',
  },
  {
    id: 'S3', section: 'safety', title: 'Release forms',
    summary: 'Every participant needs a completed participant release (consent) form on file before taking part in an event. Sort this out before competition day so nobody is stuck at check-in.',
    tags: ['safety', 'release form', 'consent', 'waiver', 'paperwork', 'check-in'],
    severity: 'safety',
  },
  {
    id: 'S4', section: 'safety', title: 'Robots stay inside the Field',
    summary: 'A Robot must stay within the Field during a match. A Robot that drives, reaches or tips out over the Field Perimeter in a way that could hit a person or get tangled outside the Field may be disabled.',
    tags: ['safety', 'stay in field', 'perimeter', 'outside', 'leave field'],
    see: ['SG4', 'DEF-field-perimeter'], severity: 'safety',
  },

  // ─────────────────────────── General game (G) ──────────────────────────────
  {
    id: 'G-respect', section: 'general', title: 'Treat everyone with respect',
    summary: 'Students and adults are expected to be respectful and professional towards other teams, volunteers and referees at all times. Rude, threatening or unsporting behaviour can get a team Disqualified from a match or even removed from the event - and teams are responsible for the behaviour of their adults too.',
    tags: ['respect', 'conduct', 'behaviour', 'behavior', 'sportsmanship', 'code of conduct'],
    severity: 'major', verify: true,
  },
  {
    id: 'G-student-centred', section: 'general', title: 'V5RC is student-centred',
    summary: 'The Robot must be designed, built and programmed by the students on the team. Adults may teach skills, ask questions and keep people safe, but they should not be doing the work or making the strategy decisions during a match.',
    points: ['If you cannot explain how a part of your Robot or code works, that is a warning sign.'],
    tags: ['student centred', 'student centered', 'adult help', 'mentor', 'coach', 'build', 'code'],
    see: ['S2', 'R-student-built'], severity: 'major', verify: true,
  },
  {
    id: 'G-common-sense', section: 'general', title: 'Use common sense',
    summary: 'The manual cannot describe every possible situation. Read rules the way a reasonable person would, and do not hunt for loopholes in the wording. If something feels like cheating, assume it is - and ask in the official Q&A if you really are unsure.',
    tags: ['common sense', 'loophole', 'intent', 'spirit of the rules'],
    see: ['I-updates'], severity: 'info', verify: true,
  },
  {
    id: 'G-drive-team', section: 'general', title: 'Drive Team Members and the Alliance Station',
    summary: 'Only a limited number of students per team (three in recent seasons) may be in the Alliance Station, and they must stay there for the whole match. Adults are not Drive Team Members. Only Drive Team Members may operate controllers or handle Match Loads.',
    tags: ['drive team', 'drivers', 'alliance station', 'three', 'students'],
    see: ['DEF-drive-team', 'SG11'], severity: 'minor', verify: true,
  },
  {
    id: 'G-hands-off', section: 'general', title: 'Hands out of the Field during a match',
    summary: 'Once the match starts, Drive Team Members may not touch Robots, Scoring Objects or Field Elements, except where a rule specifically allows it (such as loading Match Loads into your Loaders). After the buzzer, wait for the referees to finish scoring and tell you it is OK before you collect your Robot.',
    points: ['Touching things before the score is recorded can change the result of the match.'],
    tags: ['hands', 'touch', 'reach', 'human contact', 'field', 'after match'],
    see: ['SC1', 'SG11'], severity: 'major', verify: true,
  },
  {
    id: 'G-auton-hands-off', section: 'general', title: 'Autonomous means no human control',
    summary: 'During the Autonomous Period drivers may not use their controllers or interact with the Robot in any way. All the usual rules still apply to the Robot while it runs its code. Breaking rules in Autonomous hands the Autonomous Bonus to the other Alliance (SC7).',
    tags: ['autonomous', 'controller', 'no humans', 'auton', 'code only'],
    see: ['SC7', 'SG7', 'DEF-auto-period'], severity: 'major', verify: true,
  },
  {
    id: 'G-no-damage', section: 'general', title: 'No destroying, tipping or tangling other Robots',
    summary: 'Strategies meant to damage, tip over or entangle an opposing Robot are not allowed. Pushing and blocking are part of the game, so build a sturdy Robot - but if your actions break or flip an opponent, expect the referees to look closely at whether it was avoidable.',
    tags: ['damage', 'tipping', 'entanglement', 'destroy', 'defence', 'defense', 'contact'],
    see: ['G-offence-benefit', 'SG12'], severity: 'major', verify: true,
  },
  {
    id: 'G-offence-benefit', section: 'general', title: 'Offensive Robots get the benefit of the doubt',
    summary: 'When an offensive Robot (one trying to score) and a defensive Robot (one trying to stop it) get into a messy collision and the referee cannot tell who was at fault, the call usually favours the Robot that was trying to score.',
    tags: ['offence', 'offense', 'defence', 'defense', 'benefit of the doubt', 'collision'],
    see: ['G-no-damage'], severity: 'info', verify: true,
  },
  {
    id: 'G-no-forcing', section: 'general', title: 'You cannot force an opponent into a penalty',
    summary: 'If you deliberately push or trick an opposing Robot into breaking a rule - for example shoving them across a line - the opponent is not penalised for it, and you may be penalised instead.',
    tags: ['forcing', 'penalty', 'push', 'trick', 'violation'],
    see: ['SG7', 'SG13'], severity: 'minor', verify: true,
  },
  {
    id: 'G-holding', section: 'general', title: 'Limited Holding (trap, pin, lift)',
    summary: 'You may not trap, pin or lift an opposing Robot for longer than a short referee count (5 seconds in recent seasons). When the count ends you must back away a clear distance and wait before going after that Robot again.',
    tags: ['holding', 'pinning', 'trapping', 'lifting', 'count', '5 seconds', 'defence', 'defense'],
    see: ['DEF-holding'], severity: 'minor', verify: true,
  },
  {
    id: 'G-no-clamping', section: 'general', title: 'Do not clamp onto or damage the Field',
    summary: 'Robots may not grab, grapple or attach themselves to Field Elements, and may not damage the Field. Interacting with Goals, Toggles and Loaders the way the game intends is fine; latching onto them to anchor your Robot is not.',
    tags: ['clamp', 'grab', 'field element', 'anchor', 'attach', 'field damage'],
    see: ['R-no-damage', 'DEF-field-element'], severity: 'minor', verify: true,
  },
  {
    id: 'G-keep-together', section: 'general', title: 'Keep your Robot in one piece',
    summary: 'Robots may not deliberately drop parts or leave mechanisms behind on the Field. Parts that fall off by accident are not a Violation on their own, but they must not be used to gain an advantage.',
    tags: ['detach', 'parts', 'fall off', 'leave behind', 'mechanism'],
    severity: 'minor', verify: true,
  },
  {
    id: 'G-use-objects', section: 'general', title: 'Scoring Objects are for scoring',
    summary: 'Pins and Cups may not be used as tools to do something that would be illegal for the Robot itself - for example wedging them into an opponent\'s Robot, or using them to reach into a protected area.',
    tags: ['scoring objects', 'tools', 'misuse', 'pins', 'cups'],
    see: ['SG9', 'SG13'], severity: 'minor', verify: true,
  },
  {
    id: 'G-field-control', section: 'general', title: 'Stay plugged in and follow the Field control',
    summary: 'Controllers must stay connected to the Field control system for the whole match, and Robots must obey its start and stop signals. A Robot that keeps driving after the buzzer can cause a Violation if it changes the score.',
    tags: ['controller', 'field control', 'connected', 'after buzzer', 'stop'],
    see: ['SC1'], severity: 'minor', verify: true,
  },

  // ─────────────────────────── Specific game (SG) ────────────────────────────
  {
    id: 'SG1', section: 'specific', title: 'Starting the match',
    summary: 'At the start of a match each Robot must fit within 18 inches on every side, and must be placed on its own Alliance\'s side of the Autonomous Line.',
    points: ['Check your size with the Preload loaded - it has to be touching the Robot.', 'Line up the same way every match so your Autonomous routine is repeatable.'],
    tags: ['start', 'starting position', '18 inches', 'size', 'autonomous line', 'setup'],
    see: ['R-size', 'SG5', 'DEF-auto-line'], severity: 'minor',
  },
  {
    id: 'SG2', section: 'specific', title: 'Horizontal expansion limit',
    summary: 'After the match starts a Robot may unfold, but its footprint may never be larger than 24 inches by 24 inches.',
    points: ['Measure with arms, intakes and wings fully out, at their worst-case angle.', 'A flexible part that bends out past the limit during a match still counts.'],
    tags: ['expansion', 'size', '24 inches', 'footprint', 'horizontal', 'unfold'],
    see: ['SG3', 'SG1'], severity: 'minor',
  },
  {
    id: 'SG3', section: 'specific', title: 'Height limit',
    summary: 'A Robot may never be taller than 50 inches during a match.',
    points: ['The Midfield Goal is tall and stacks get taller still, so lifts are common - design a hard stop so your lift cannot pass 50 in.'],
    tags: ['height', '50 inches', 'tall', 'vertical', 'lift', 'expansion'],
    see: ['SG2'], severity: 'minor',
  },
  {
    id: 'SG4', section: 'specific', title: 'Keep Scoring Objects in the Field',
    summary: 'Do not push, throw or drop Pins and Cups out of the Field. Accidents happen, but doing it on purpose or over and over is a Violation, and objects that leave the Field are normally out of play.',
    tags: ['out of field', 'scoring objects', 'leave field', 'throw', 'launch'],
    see: ['S4'], severity: 'minor',
  },
  {
    id: 'SG5', section: 'specific', title: 'Preloads',
    summary: 'Each Robot starts with exactly one Preload Pin. Before the match it must be touching your Robot, and it must not be touching any Goal, Loader, Toggle or other Scoring Object.',
    points: ['Red Robots preload a red/yellow Pin; blue Robots preload a blue/yellow Pin.', 'Decide which end faces which way - it changes which half is hidden when you Place it (SC3).'],
    tags: ['preload', 'start', 'one pin', 'touching', 'setup'],
    see: ['DEF-preload', 'SG1', 'SC3'], severity: 'minor',
  },
  {
    id: 'SG6', section: 'specific', title: 'Possession limit: one Pin and one Cup',
    summary: 'A Robot may have Possession of at most one Pin and one Cup at the same time. Holding a second Pin, or a second Cup, is a Violation - even for a moment, and even by accident.',
    points: [
      'Design intakes so a second object cannot be pulled in, or so it is pushed straight back out.',
      'If you pick up an extra by accident, stop and release it right away, before doing anything else.',
      'A Pin that is already nested in a Cup you are holding still counts as one Pin and one Cup.',
    ],
    example: 'Your intake grabs two Pins lying next to each other. You are over the limit: back up and drop one before driving on.',
    tags: ['possession', 'limit', 'carry', 'hold', 'one pin', 'one cup', 'hoarding', 'intake'],
    see: ['DEF-possession', 'QR-top10'], severity: 'major',
  },
  {
    id: 'SG7', section: 'specific', title: 'Stay on your side in Autonomous',
    summary: 'During the Autonomous Period Robots may not cross the Autonomous Line onto the opposing Alliance\'s side. The 28 Scoring Objects that start on the Autonomous Line are neutral - they do not belong to either side.',
    points: [
      'A Violation in Autonomous gives the Autonomous Bonus to the other Alliance (SC7).',
      'Leave a safety margin in your code: wheel slip and a bumped start can add several inches.',
    ],
    tags: ['autonomous', 'autonomous line', 'cross', 'opponent side', 'neutral', '28', 'auton'],
    see: ['DEF-auto-line', 'SG8', 'SC7'], severity: 'major',
  },
  {
    id: 'SG8', section: 'specific', title: 'The line and the Midfield in Autonomous: at your own risk',
    summary: 'Both Alliances are allowed to go for the Autonomous Line and the Midfield during Autonomous, so Robots may meet there. If you choose to play in that shared space you accept the risk: collisions there are generally treated as part of the game rather than as a foul on the other Robot.',
    points: ['If your Autonomous routine heads for the middle, use sensors or a safe fallback path in case another Robot is already there.'],
    tags: ['autonomous', 'midfield', 'autonomous line', 'risk', 'collision', 'contact', 'auton'],
    see: ['SG7', 'DEF-midfield'], severity: 'minor',
  },
  {
    id: 'SG9', section: 'specific', title: 'Opposing Alliance Goals are protected',
    summary: 'The red Goals belong to red and the blue Goals belong to blue. Robots may not interfere with the opposing Alliance\'s Goals - do not remove what they have Placed there, and do not Place on, block or knock those Goals.',
    points: ['Play defence with your own scoring and with the Toggles and Midfield, not by attacking their Alliance Goals.'],
    tags: ['alliance goal', 'protected', 'opponent goal', 'descoring', 'remove', 'interfere'],
    see: ['DEF-alliance-goal', 'SG10'], severity: 'major',
  },
  {
    id: 'SG10', section: 'specific', title: 'Do not remove Placed objects from neutral Goals',
    summary: 'Once a Pin or Cup is Placed on a neutral Goal it stays there. Robots may not pull Placed objects off neutral Goals.\n\nWhen referees decide whether a removal was Match Affecting, they use set values: removing 1 to 3 Pins is valued at 10 points per Pin, and removing 4 or more is valued at 50 points.',
    points: [
      'You fight for neutral Goals by adding to them, by setting Toggles and by holding the Midfield - not by taking things off.',
      'Be careful driving next to tall stacks: knocking one over can count as removing it.',
    ],
    tags: ['neutral goal', 'remove', 'descoring', 'placed', 'match affecting', '10 points', '50 points', 'knock over'],
    see: ['SG9', 'DEF-match-affecting', 'DEF-midfield-goal'], severity: 'major',
  },
  {
    id: 'SG11', section: 'specific', title: 'Using the Loaders',
    summary: 'Drive Team Members add Match Loads only through their own Alliance\'s Loaders, and only during the Driver Controlled Period - never in Autonomous. People put objects into the Loader; only Robots take objects out, from the bottom.',
    points: [
      'No reaching into the Field to hand an object to the Robot or to free a jammed one.',
      'Agree on hand signals or a call-out so the loader and the driver stay in rhythm.',
    ],
    tags: ['loader', 'match load', 'drive team', 'driver control', 'bottom', 'feed', 'introduce'],
    see: ['DEF-loader', 'DEF-match-load', 'SG13', 'G-hands-off'], severity: 'minor',
  },
  {
    id: 'SG12', section: 'specific', title: 'Endgame: Midfield Goal is closed, Midfield is rough',
    summary: 'In the last 10 seconds of the match nobody may Place Scoring Objects on the Midfield Goal. At the same time every Robot wants to be in the Midfield, so the manual warns teams to expect vigorous contact there.',
    points: [
      'Finish your Midfield Goal stack before the 10-second mark.',
      'Use the last 10 seconds to get in, hold your ground and stay at least partly inside (SC6).',
      'Rules against deliberately damaging or tipping Robots still apply.',
    ],
    tags: ['endgame', 'last 10 seconds', 'midfield goal', 'midfield', 'contact', 'pushing', 'park'],
    see: ['DEF-endgame', 'SC6', 'SC5', 'G-no-damage'], severity: 'major',
  },
  {
    id: 'SG13', section: 'specific', title: 'Load Zones are protected',
    summary: 'Each Alliance\'s Load Zones - the space around its Loaders, marked with coloured tape - are protected from opposing Robots. Stay out of the other Alliance\'s Load Zones and do not interfere with a Robot that is collecting there.',
    tags: ['load zone', 'protected', 'loader', 'opponent', 'defence', 'defense', 'tape'],
    see: ['DEF-load-zone', 'SG11'], severity: 'major',
  },

  // ────────────────────────────── Robot (R) ──────────────────────────────────
  {
    id: 'R-one-robot', section: 'robot', title: 'One Robot per team',
    summary: 'Each team competes with a single Robot at an event. You may repair and improve it between matches, but you may not swap between two different Robots or share one Robot between teams.',
    tags: ['one robot', 'swap', 'spare robot', 'subsystems'],
    severity: 'major', verify: true,
  },
  {
    id: 'R-student-built', section: 'robot', title: 'The Robot shows the team\'s own skill',
    summary: 'The Robot must be the work of the students on that team: their design, their build and their code. Copying another team\'s Robot piece by piece, or having adults build or program it, goes against the student-centred rules.',
    tags: ['student built', 'skill level', 'copy', 'clone', 'adult built'],
    see: ['G-student-centred'], severity: 'major', verify: true,
  },
  {
    id: 'R-inspection', section: 'robot', title: 'Pass inspection before you play',
    summary: 'Every Robot must pass inspection before its first match. Inspectors check size, motors, electronics, pneumatics, licence plates and safety. If you make a big change later you may be re-inspected, and referees can ask for a spot check at any time.',
    points: ['Download the official inspection checklist and run through it at your last practice before the event.'],
    tags: ['inspection', 'checklist', 'legal', 'check', 're-inspection'],
    see: ['R-size', 'R-motors'], severity: 'major', verify: true,
  },
  {
    id: 'R-size', section: 'robot', title: 'Starting size: 18 x 18 x 18 inches',
    summary: 'At the start of a match the Robot must fit inside an 18 in x 18 in x 18 in space. During the match it may grow up to the limits in SG2 (24 in x 24 in footprint) and SG3 (50 in tall).',
    points: ['Zip-tie tails, loose tubing and sagging rubber bands all count towards size.'],
    tags: ['size', '18 inches', 'sizing', 'starting size', 'cube'],
    see: ['SG1', 'SG2', 'SG3'], severity: 'major',
  },
  {
    id: 'R-vex-parts', section: 'robot', title: 'Build only with legal VEX parts',
    summary: 'Robots are built from official VEX V5 system parts. Parts from other VEX product lines or from other companies are only allowed where the manual specifically lists them. If an inspector asks, you must be able to show that a part is an official one.',
    tags: ['legal parts', 'vex parts', 'official', 'components', 'materials'],
    see: ['R-non-vex', 'R-modifications'], severity: 'major', verify: true,
  },
  {
    id: 'R-non-vex', section: 'robot', title: 'The short list of non-VEX items',
    summary: 'A small set of ordinary materials is normally allowed: things like non-functional decorations, rubber bands of the standard sizes, zip ties, string or rope, grease used sparingly, tape for labelling or securing cables, and a limited amount of thin, non-shattering plastic sheet. The exact list, sizes and amounts are in the Robot section of the official manual.',
    tags: ['non-vex', 'plastic', 'polycarbonate', 'rubber bands', 'zip ties', 'string', 'tape', 'grease', 'decorations'],
    see: ['R-vex-parts'], severity: 'minor', verify: true,
  },
  {
    id: 'R-modifications', section: 'robot', title: 'Changing parts',
    summary: 'Metal and plastic structural parts may be cut, bent and drilled. Electronics - the Brain, motors, sensors, batteries, cables and pneumatic parts - may not be opened or altered beyond what the manual allows.',
    tags: ['modify', 'cut', 'bend', 'electronics', 'alter'],
    see: ['R-vex-parts'], severity: 'minor', verify: true,
  },
  {
    id: 'R-brain', section: 'robot', title: 'One V5 Brain, VEXnet radio',
    summary: 'A Robot uses exactly one V5 Robot Brain, with a V5 Robot Radio linked to V5 Controllers. No other microcontrollers or wireless links may control the Robot. Keep the Brain screen and the power button easy to reach so the Robot can be switched off quickly.',
    tags: ['brain', 'v5 brain', 'radio', 'controller', 'microcontroller', 'electronics'],
    see: ['R-battery', 'R-firmware'], severity: 'major', verify: true,
  },
  {
    id: 'R-motors', section: 'robot', title: 'Motor power budget: 88 W',
    summary: 'The total power of all V5 Smart Motors on a Robot may not be more than 88 W. An 11 W Smart Motor counts as 11 and a 5.5 W Smart Motor counts as 5.5.',
    table: {
      head: ['Example mix', 'Total'],
      rows: [
        ['8 x 11 W', '88 W'],
        ['6 x 11 W + 4 x 5.5 W', '88 W'],
        ['7 x 11 W + 2 x 5.5 W', '88 W'],
      ],
    },
    tags: ['motors', '88 w', '88w', 'watts', 'power', 'motor limit', '11 w', '5.5 w', 'smart motor'],
    see: ['R-pneumatics', 'R-inspection'], severity: 'major',
  },
  {
    id: 'R-battery', section: 'robot', title: 'One V5 Robot Battery',
    summary: 'The Robot is powered only by an official V5 Robot Battery connected to the Brain. No extra batteries or other power sources may drive motors or mechanisms, and batteries must be charged with official chargers.',
    tags: ['battery', 'power', 'v5 battery', 'charger'],
    see: ['R-brain'], severity: 'major', verify: true,
  },
  {
    id: 'R-pneumatics', section: 'robot', title: 'Pneumatics: 100 psi and a limited number of reservoirs',
    summary: 'Pneumatic systems may be charged to at most 100 psi, and a Robot may carry only a limited number of legal VEX air reservoirs (two in recent seasons). Use only official VEX pneumatic parts, and do not alter them.',
    points: ['Pump up at the pits with a gauge - guessing is how teams end up over the limit.'],
    tags: ['pneumatics', 'air', '100 psi', 'pressure', 'reservoir', 'tank', 'piston', 'solenoid'],
    see: ['R-motors'], severity: 'major', verify: true,
  },
  {
    id: 'R-no-damage', section: 'robot', title: 'No sharp edges, no Field damage, no entanglement',
    summary: 'A Robot may not have parts that are likely to hurt people, damage the Field or Scoring Objects, or tangle up other Robots. File down sharp corners and cover exposed screw ends. An unsafe Robot will not pass inspection.',
    tags: ['sharp', 'safety', 'field damage', 'entangle', 'dangerous', 'inspection'],
    see: ['S1', 'G-no-damage', 'G-no-clamping'], severity: 'safety', verify: true,
  },
  {
    id: 'R-licence-plates', section: 'robot', title: 'Licence plates',
    summary: 'The Robot must show its team number on official licence plates that are easy to see from opposite sides of the Robot, in the colour of the Alliance it is playing on for that match. Plates must stay attached and readable for the whole match.',
    tags: ['licence plate', 'license plate', 'team number', 'plates', 'alliance colour', 'alliance color'],
    severity: 'minor', verify: true,
  },
  {
    id: 'R-firmware', section: 'robot', title: 'Keep firmware up to date',
    summary: 'The Brain, controllers and smart devices should run the current official VEXos firmware. Update before the event, not in the queue for your match.',
    tags: ['firmware', 'vexos', 'update', 'software'],
    see: ['R-brain'], severity: 'minor', verify: true,
  },
  {
    id: 'R-programming', section: 'robot', title: 'Code is written by the students',
    summary: 'Teams may program in VEXcode or another supported environment, but the program must be the students\' own work. Autonomous routines must run through the official competition control so that they start and stop with the Field.',
    tags: ['code', 'programming', 'vexcode', 'python', 'c++', 'blocks', 'competition template'],
    see: ['G-student-centred', 'G-field-control'], severity: 'minor', verify: true,
  },

  // ──────────────────────────── Tournament (T) ───────────────────────────────
  {
    id: 'T-head-referee', section: 'tournament', title: 'The Head Referee\'s decision is final',
    summary: 'The Head Referee has the last word on every ruling during an event. Decisions are based on what the referees saw during the match - video and photo replays are not used.',
    tags: ['head referee', 'final', 'ruling', 'video', 'replay', 'appeal'],
    see: ['T-student-questions'], severity: 'info', verify: true,
  },
  {
    id: 'T-student-questions', section: 'tournament', title: 'Students talk to the referee - politely and promptly',
    summary: 'If your team disagrees with a call or a score, a student Drive Team Member (not an adult) should speak calmly to the Head Referee straight after the match, before leaving the Field area. Bring the rule number, not just a feeling. Once the next match has begun, or the scores are confirmed, it is normally too late.',
    points: ['Open this Rule Book or the official manual to the rule before you go and ask.'],
    tags: ['question', 'dispute', 'appeal', 'referee', 'students', 'score'],
    see: ['T-head-referee', 'G-respect'], severity: 'info', verify: true,
  },
  {
    id: 'T-on-time', section: 'tournament', title: 'Be at the Field on time',
    summary: 'A team that does not turn up for its match is a no-show and normally receives nothing for that match. Even with a broken Robot, send a Drive Team Member with a Robot to the Field so the team gets credit for the match.',
    tags: ['no-show', 'late', 'queue', 'on time', 'schedule'],
    severity: 'minor', verify: true,
  },
  {
    id: 'T-rankings', section: 'tournament', title: 'Qualification rankings',
    summary: 'In Qualification Matches teams collect Win Points (WP): a win is normally worth 2, a tie 1, and the Autonomous Win Point adds 1 more. Teams are ranked by average Win Points, then by Autonomous Points, then by Strength of Schedule Points.',
    points: ['The Autonomous Win Point can lift you several ranking places over a day - it is worth the practice.'],
    tags: ['rankings', 'win points', 'wp', 'ap', 'sp', 'qualification', 'awp', 'tiebreaker'],
    see: ['SC8', 'QR-awp'], severity: 'info', verify: true,
  },
  {
    id: 'T-alliance-selection', section: 'tournament', title: 'Alliance Selection and Eliminations',
    summary: 'After Qualification Matches the highest-ranked teams take turns inviting another team to form an Alliance for the Elimination bracket. An Alliance that loses an Elimination Match is out, although finals at some events are played as a best-of-three series.',
    points: ['Scout during the day so you know who you would pick - and who might pick you.'],
    tags: ['alliance selection', 'eliminations', 'bracket', 'captain', 'picking', 'finals'],
    severity: 'info', verify: true,
  },
  {
    id: 'T-timeouts', section: 'tournament', title: 'Time-outs',
    summary: 'In the Elimination bracket each Alliance normally has one short time-out it can ask for between matches, for example to make a repair. There are no time-outs in Qualification Matches.',
    tags: ['timeout', 'time-out', 'eliminations', 'repair'],
    severity: 'info', verify: true,
  },
  {
    id: 'T-replays', section: 'tournament', title: 'Match replays are rare',
    summary: 'A match is replayed only when something outside the teams\' control affected the result, such as a Field fault or a control-system failure. A problem with your own Robot - a dead battery, a loose cable, a code bug - is not a reason for a replay.',
    tags: ['replay', 'rematch', 'field fault', 'field error'],
    see: ['T-head-referee'], severity: 'info', verify: true,
  },
  {
    id: 'T-field-tolerance', section: 'tournament', title: 'Fields are not perfectly identical',
    summary: 'Field Elements and Scoring Objects can vary slightly from Field to Field, within set tolerances. Design and program your Robot to cope with small differences in position and height instead of relying on exact measurements.',
    tags: ['tolerance', 'field variance', 'differences', 'measurements'],
    see: ['A-field'], severity: 'info', verify: true,
  },

  // ───────────────────────────── Skills (RSC) ────────────────────────────────
  {
    id: 'RSC-overview', section: 'skills', title: 'What the Robot Skills Challenge is',
    summary: 'In Skills one Robot plays alone on the Field, with no partner and no opponents, and tries to score as many points as possible. There are two kinds of 60-second run: Driving Skills (fully driver controlled) and Autonomous Coding Skills (code only).',
    tags: ['skills', 'robot skills', 'driving skills', 'coding skills', 'programming skills', '60 seconds', 'solo'],
    see: ['RSC-ranking', 'RSC-setup'], severity: 'info', verify: true,
  },
  {
    id: 'RSC-ranking', section: 'skills', title: 'Skills score and ranking',
    summary: 'A team\'s Skills score is its best Driving Skills run plus its best Autonomous Coding Skills run. Teams normally get a limited number of attempts at each (three in recent seasons). Ties are broken using the next-best runs.',
    tags: ['skills', 'ranking', 'attempts', 'best score', 'tiebreaker'],
    see: ['RSC-overview'], severity: 'info', verify: true,
  },
  {
    id: 'RSC-setup', section: 'skills', title: 'Skills Field set-up and scoring',
    summary: 'The Skills Field set-up, the Scoring Objects available and the way points are counted are not exactly the same as in a head-to-head match. Read the Skills section of the official manual for the current starting layout and scoring table before you plan a route.',
    tags: ['skills', 'setup', 'field', 'scoring', 'layout'],
    see: ['RSC-overview'], severity: 'info', verify: true,
  },
  {
    id: 'RSC-rules-apply', section: 'skills', title: 'Match rules still apply in Skills',
    summary: 'Unless the Skills section says otherwise, the safety, general, specific-game and Robot rules all apply during Skills runs, and the Robot must be the same inspected Robot the team uses in matches.',
    tags: ['skills', 'rules apply', 'same robot', 'inspection'],
    see: ['R-one-robot', 'R-inspection'], severity: 'info', verify: true,
  },
  {
    id: 'RSC-coding', section: 'skills', title: 'Autonomous Coding Skills: hands off',
    summary: 'In an Autonomous Coding Skills run the drivers start the program and then do not control the Robot. There are strict limits on if and when a team may handle or reposition the Robot during a run - check the official Skills rules before relying on it.',
    tags: ['skills', 'autonomous', 'coding skills', 'programming skills', 'handling', 'reset'],
    see: ['G-auton-hands-off'], severity: 'info', verify: true,
  },
  {
    id: 'RSC-early-stop', section: 'skills', title: 'Ending a run early',
    summary: 'A team may choose to stop a Skills run before the time is up. The run is scored as the Field stands at that moment, and it still uses up one of the team\'s attempts.',
    tags: ['skills', 'stop early', 'end run', 'stop time'],
    severity: 'info', verify: true,
  },

  // ───────────────────────────── Appendix A ──────────────────────────────────
  {
    id: 'A-field', section: 'field', title: 'Field dimensions',
    summary: 'The Field is a 12 ft x 12 ft square of foam tiles surrounded by the Field Perimeter, which is made of 12 straight sections.',
    table: {
      head: ['Measurement', 'Value'],
      rows: [
        ['Nominal size', '12 ft x 12 ft'],
        ['Inside wall to wall (portable perimeter)', '140.4 in'],
        ['Inside wall to wall (metal perimeter)', '140.5 in'],
        ['Wall height', 'about 11.5 in'],
        ['White tape width', '2.5 in'],
        ['Perimeter', '12 straight sections'],
      ],
    },
    tags: ['field', 'dimensions', 'size', '12 feet', '140.4', '140.5', 'perimeter', 'tape', 'wall', 'foam'],
    see: ['DEF-field-perimeter', 'A-zones', 'T-field-tolerance'], severity: 'info',
  },
  {
    id: 'A-pins', section: 'field', title: 'Pins: 63 in total',
    summary: 'A Pin is about 1.6 in (40 mm) in diameter and 6.5 in (165 mm) tall, made of two Pin Halves coloured red, blue or yellow.',
    table: {
      head: ['Pin colours', 'Total', 'Where they start'],
      rows: [
        ['Red / blue', '4', 'All 4 on the Field'],
        ['Red / yellow', '20', '2 Preloads, 10 Match Loads, 8 on the Field'],
        ['Blue / yellow', '20', '2 Preloads, 10 Match Loads, 8 on the Field'],
        ['Yellow / yellow', '19', '2 Match Loads, 17 on the Field'],
        ['All Pins', '63', ''],
      ],
    },
    tags: ['pins', '63', 'count', 'colours', 'colors', 'red', 'blue', 'yellow', 'preload', 'match load', 'dimensions', '40 mm', '165 mm'],
    see: ['DEF-pin', 'DEF-pin-half', 'A-cups'], severity: 'info',
  },
  {
    id: 'A-cups', section: 'field', title: 'Cups: 56 in total',
    summary: 'A Cup is about 3.15 in (80 mm) in diameter and 6.5 in (164.5 mm) tall, with one opaque half and one transparent half.',
    table: {
      head: ['Cups', 'Count', 'Where they start'],
      rows: [
        ['Match Loads', '20', '10 per Alliance'],
        ['On the Field, gray side up', '24', ''],
        ['On the Field, clear side up', '12', ''],
        ['All Cups', '56', ''],
      ],
    },
    tags: ['cups', '56', 'count', 'opaque', 'transparent', 'gray', 'clear', 'match load', 'dimensions', '80 mm', '164.5 mm'],
    see: ['DEF-cup', 'A-pins', 'SC3'], severity: 'info',
  },
  {
    id: 'A-goals', section: 'field', title: 'Goals: 9 in total',
    summary: 'There are nine Goals on the Field.',
    table: {
      head: ['Goal type', 'Count', 'Notes'],
      rows: [
        ['Red Alliance Goals', '2', 'Protected from blue (SG9)'],
        ['Blue Alliance Goals', '2', 'Protected from red (SG9)'],
        ['Short neutral Goals', '4', 'No removing Placed objects (SG10)'],
        ['Tall Midfield Goal', '1', 'Neutral; closed during the Endgame (SG12)'],
      ],
    },
    tags: ['goals', '9', 'nine', 'alliance goal', 'neutral goal', 'midfield goal', 'tall', 'short', 'count'],
    see: ['DEF-goal', 'SG9', 'SG10', 'SG12'], severity: 'info',
  },
  {
    id: 'A-toggles', section: 'field', title: 'Toggles and Loaders',
    summary: 'There are 4 Toggles - triangular, one on each side of the Field Perimeter, with red, blue and yellow faces. They all start with yellow up. There are 4 Loaders, two for each Alliance, next to the Alliance Stations.',
    tags: ['toggles', 'loaders', '4', 'four', 'triangular', 'yellow up', 'count', 'alliance station'],
    see: ['DEF-toggle', 'DEF-loader', 'SC4'], severity: 'info',
  },
  {
    id: 'A-zones', section: 'field', title: 'Zones and lines',
    summary: 'White tape (2.5 in wide) and coloured tape divide the Field into zones that the rules refer to.',
    table: {
      head: ['Zone', 'What it is'],
      rows: [
        ['Quadrants (4)', 'Triangular areas, each with its own Toggle'],
        ['Midfield (1)', 'Square area in the centre, containing the tall Midfield Goal'],
        ['Autonomous Line', 'Two white tape lines running diagonally across the Field and around the Midfield, plus the space between them'],
        ['Load Zones', 'The volume bounded by the Field Perimeter and the coloured tape around each Loader'],
      ],
    },
    tags: ['zones', 'quadrant', 'midfield', 'autonomous line', 'load zone', 'tape', 'layout', 'map'],
    see: ['DEF-quadrant', 'DEF-midfield', 'DEF-auto-line', 'DEF-load-zone'], severity: 'info',
  },
  {
    id: 'A-setup', section: 'field', title: 'Field reset checklist',
    summary: 'Use this list to check a practice Field before each run. The exact position of every object is shown in the Field diagrams of the official manual.',
    points: [
      'All 4 Toggles yellow side up.',
      'On the Field: 4 red/blue Pins, 8 red/yellow, 8 blue/yellow and 17 yellow/yellow Pins (37 Pins).',
      'On the Field: 24 Cups gray side up and 12 Cups clear side up (36 Cups).',
      '28 of the Scoring Objects on the Field sit on the Autonomous Line.',
      'Each Alliance Station: 10 Match Load Pins in the Alliance\'s colour and yellow, plus 10 Match Load Cups. There are also 2 yellow/yellow Match Load Pins.',
      'Each Robot: 1 Preload Pin, touching the Robot.',
      'Goals empty, Loaders empty, nothing leaning on the Field Perimeter.',
    ],
    tags: ['reset', 'setup', 'checklist', 'starting positions', 'field setup', 'counts'],
    see: ['A-pins', 'A-cups', 'SG5', 'SG7'], severity: 'info',
  },
];

// Quiz bank. Every fact here comes from the verified figures of manual v2.1.
// { q, a (correct), wrong: [three distractors], rule, why }
export const QUIZ_FACTS = [
  { q: 'How many points is a Scored yellow Pin Half worth to the Alliance that Owns it?', a: '10', wrong: ['5', '8', '12'], rule: 'SC5', why: 'Owned yellow halves are worth 10; red and blue halves are worth 5.' },
  { q: 'How many points is a Scored Pin Half in your own Alliance colour worth?', a: '5', wrong: ['2', '8', '10'], rule: 'SC3', why: 'Alliance-coloured halves are worth 5 points each.' },
  { q: 'How many points does each Robot that ends the match in the Midfield earn?', a: '8', wrong: ['5', '10', '12'], rule: 'SC6', why: 'Each Robot at least partly within the Midfield earns 8 points.' },
  { q: 'How many points is the Autonomous Bonus worth to the winner?', a: '12', wrong: ['6', '8', '10'], rule: 'SC7', why: 'The winner of the Autonomous Period gets 12 points.' },
  { q: 'What happens to the Autonomous Bonus if the Autonomous Period is tied?', a: 'Each Alliance gets 6 points', wrong: ['Nobody gets anything', 'Each Alliance gets 12 points', 'Red gets it by default'], rule: 'SC7', why: 'A tie splits the bonus: 6 points each.' },
  { q: 'How long is the Autonomous Period?', a: '15 seconds', wrong: ['10 seconds', '30 seconds', '45 seconds'], rule: 'DEF-auto-period', why: 'A match is 15 s of Autonomous followed by 1:45 of Driver Control.' },
  { q: 'How long is the Driver Controlled Period?', a: '1 minute 45 seconds', wrong: ['1 minute', '1 minute 30 seconds', '2 minutes'], rule: 'DEF-driver-period', why: '15 s + 1:45 makes a two-minute match.' },
  { q: 'What is the Endgame?', a: 'The last 10 seconds of the match', wrong: ['The last 30 seconds of the match', 'The 5 seconds after the buzzer', 'The whole Driver Controlled Period'], rule: 'DEF-endgame', why: 'The Endgame is the final 10 seconds.' },
  { q: 'What is the most a Robot may have Possession of at one time?', a: 'One Pin and one Cup', wrong: ['Two Pins and one Cup', 'One Pin or one Cup, not both', 'Three Scoring Objects of any kind'], rule: 'SG6', why: 'The Possession limit is one Pin and one Cup.' },
  { q: 'What is the maximum height a Robot may reach during a match?', a: '50 inches', wrong: ['18 inches', '24 inches', '36 inches'], rule: 'SG3', why: 'Robots may never be taller than 50 in.' },
  { q: 'What is the largest footprint a Robot may expand to during a match?', a: '24 in x 24 in', wrong: ['18 in x 18 in', '36 in x 36 in', 'No limit'], rule: 'SG2', why: 'Horizontal expansion is limited to a 24 in x 24 in footprint.' },
  { q: 'How big may a Robot be at the start of a match?', a: '18 inches per side', wrong: ['15 inches per side', '24 inches per side', '50 inches per side'], rule: 'SG1', why: 'Robots start within 18 in per side, on their own side of the Autonomous Line.' },
  { q: 'How many Pins are used in Override?', a: '63', wrong: ['56', '48', '72'], rule: 'A-pins', why: '4 red/blue + 20 red/yellow + 20 blue/yellow + 19 yellow/yellow = 63.' },
  { q: 'How many Cups are used in Override?', a: '56', wrong: ['63', '36', '40'], rule: 'A-cups', why: '20 Match Loads + 24 gray-up + 12 clear-up = 56.' },
  { q: 'How many Goals are on the Field?', a: '9', wrong: ['4', '5', '8'], rule: 'A-goals', why: '2 red + 2 blue + 4 short neutral + 1 tall Midfield Goal = 9.' },
  { q: 'Which colour faces up on every Toggle at the start of a match?', a: 'Yellow', wrong: ['Red', 'Blue', 'Whichever Alliance is closer'], rule: 'A-toggles', why: 'All four Toggles start yellow side up.' },
  { q: 'How many Preloads does each Robot get?', a: 'One Pin', wrong: ['One Pin and one Cup', 'Two Pins', 'One Cup'], rule: 'SG5', why: 'Each Robot starts with a single Preload Pin.' },
  { q: 'For the standard Autonomous Win Point, how many Scored Pin Halves does your Alliance need?', a: 'At least 6', wrong: ['At least 3', 'At least 4', 'At least 10'], rule: 'SC8', why: 'At least 6 halves, and at least 2 Goals with 2 or more of your halves each.' },
  { q: 'At World Championship qualifying events, the Autonomous Win Point needs...', a: 'At least 7 halves and 3 Goals', wrong: ['At least 6 halves and 2 Goals', 'At least 8 halves and 4 Goals', 'At least 10 halves and 2 Goals'], rule: 'SC8', why: 'The bar is raised to 7 halves and 3 Goals.' },
  { q: 'Your Robot is leaning on your Toggle when the match ends. How is that Toggle scored?', a: 'As neutral (yellow) - nobody Owns that Quadrant', wrong: ['In your colour, because you are guarding it', 'In the opponents\' colour', 'The referee flips a coin'], rule: 'SC4', why: 'A Toggle touched by any Robot is not set.' },
  { q: 'Who Owns the yellow Pin Halves on the Midfield Goal?', a: 'The Alliance with more Robots in the Midfield at the end', wrong: ['The Alliance that Placed them', 'The Alliance with more Toggles set', 'The Alliance that won Autonomous'], rule: 'SC5', why: 'Midfield Goal Ownership is decided by Robot count in the Midfield.' },
  { q: 'Each Alliance has one Robot in the Midfield at the end. Who Owns the Midfield Goal\'s yellow halves?', a: 'Nobody', wrong: ['Both Alliances', 'The red Alliance', 'Whoever arrived first'], rule: 'SC5', why: 'A tie in Robot count means nobody Owns them.' },
  { q: 'When are scores evaluated?', a: 'When everything comes to rest, or 5 seconds after the match ends', wrong: ['Exactly at the buzzer', '30 seconds after the match ends', 'Continuously during the match'], rule: 'SC1', why: 'Scoring waits for the Field to settle, up to 5 seconds.' },
  { q: 'A Pin Half is nested inside a Goal. How many points is that half worth?', a: '0 - it is not visible, so it is not Scored', wrong: ['5', '10', 'Double points'], rule: 'SC3', why: 'Only visible halves of Placed Pins are Scored.' },
  { q: 'What may you NOT do in the last 10 seconds of a match?', a: 'Place Scoring Objects on the Midfield Goal', wrong: ['Drive into the Midfield', 'Flip a Toggle', 'Place on your own Alliance Goal'], rule: 'SG12', why: 'The Midfield Goal is closed during the Endgame.' },
  { q: 'How many Scoring Objects start on the Autonomous Line (and are neutral)?', a: '28', wrong: ['12', '20', '36'], rule: 'SG7', why: '28 objects start on the line and are neutral.' },
  { q: 'What is the total V5 Smart Motor power allowed on a Robot?', a: '88 W', wrong: ['55 W', '66 W', '110 W'], rule: 'R-motors', why: 'For example eight 11 W motors; a 5.5 W motor counts as 5.5.' },
  { q: 'How much of a Robot must be in the Midfield for it to count at the end?', a: 'Any part, at least partly within it', wrong: ['The whole Robot', 'More than half of the Robot', 'All of its wheels'], rule: 'SC6', why: 'Partly in is enough.' },
  { q: 'How many yellow/yellow Pins are there?', a: '19', wrong: ['4', '17', '20'], rule: 'A-pins', why: '2 Match Loads plus 17 on the Field.' },
  { q: 'For Match Affecting checks, how is removing 4 or more Pins from a neutral Goal valued?', a: '50 points', wrong: ['10 points', '20 points', '40 points'], rule: 'SG10', why: '1 to 3 Pins are valued at 10 points each; 4 or more are valued at 50.' },
  { q: 'When may Drive Team Members add Match Loads?', a: 'Only in Driver Control, through their own Loaders', wrong: ['Any time, through any Loader', 'Only during Autonomous', 'By handing them directly to the Robot'], rule: 'SG11', why: 'Own Loaders, Driver Controlled Period only; only Robots remove from the bottom.' },
  { q: 'Which Pin Half is hidden when a Pin sits in a Cup?', a: 'The half inside the opaque (gray) half of the Cup', wrong: ['The half inside the transparent half', 'Both halves', 'Neither half'], rule: 'SC3', why: 'The opaque half hides the Pin Half; the clear half does not.' },
  { q: 'Which of these loses you the Autonomous Win Point even if you scored enough?', a: 'One of your Robots touching the Field Perimeter', wrong: ['Losing the Autonomous Bonus', 'Using your Preload', 'Having a yellow Toggle'], rule: 'SC8', why: 'Neither Robot may be contacting the Field Perimeter.' },
  { q: 'How wide is the inside of the Field with a portable perimeter?', a: '140.4 in', wrong: ['144 in', '140.5 in', '138 in'], rule: 'A-field', why: '140.4 in for portable perimeters, 140.5 in for metal ones.' },
];

// Friendly starting points for the search box.
export const POPULAR_SEARCHES = ['toggle', 'possession', 'yellow', 'midfield', 'autonomous line', 'win point', 'loader', 'expansion', 'endgame', 'motors'];
