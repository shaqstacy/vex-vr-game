// Engineering Notebook — entries, guided templates, decision matrix, test log,
// project plan, rubric self-check and print/JSON export.
// Storage: store key `notebook` (the notebook itself) and `notebookTools`
// (working copies of the decision-matrix and test-log tools).
import { store as defaultStore, bus as defaultBus, h, esc } from '../store.js';

const KEY = 'notebook';
const TOOLS_KEY = 'notebookTools';

/* ------------------------------------------------------------------ */
/* Design-process phases and guided templates                          */
/* ------------------------------------------------------------------ */

export const PHASES = [
  {
    id: 'identify', label: 'Identify Problem', tag: 'red',
    blurb: 'State the problem, the constraints from the game rules, and measurable goals.',
    template: `## Problem statement
> In one or two sentences: what exactly must the robot (or this subsystem) do? Write it so a stranger could understand it.

## Why this matters for our strategy
> How does solving this earn points or win matches? Refer to the game manual scoring section.

## Constraints
> List the limits you must design inside. Cite the rule number for each (size limit, motor count, expansion, time, field layout).
-

## Goals and measurable success criteria
> Every goal needs a number you can test later, e.g. "score 3 rings in 15 s autonomous, 8 out of 10 runs".
-

## What we already know / what we need to find out
> Open questions that the Brainstorm & Research entry should answer.
-
`,
  },
  {
    id: 'brainstorm', label: 'Brainstorm & Research', tag: 'yellow',
    blurb: 'At least three distinct concepts with sketches, pros/cons and cited research.',
    template: `## Research
> What did you look at before designing? Cite every source (game manual section, forum thread, video, another team, a physics formula) with a date.
-

## Concept 1
> Name it. Attach a labelled sketch or screenshot. Explain how it works.
- **Pros:**
- **Cons:**

## Concept 2
> Must be a genuinely different approach, not a small variation of Concept 1.
- **Pros:**
- **Cons:**

## Concept 3
- **Pros:**
- **Cons:**

## Who contributed which idea
> Judges look for the whole team's thinking. Name names.

## Next step
> Which criteria will you use to choose between these concepts? (Feeds the decision matrix.)
`,
  },
  {
    id: 'select', label: 'Select Solution (decision matrix)', tag: 'blue',
    blurb: 'Weighted decision matrix, justification of the winner, and a plan to build it.',
    template: `## Options being compared
> List the concepts from the brainstorm entry and give its page number.
-

## Criteria and why they are weighted this way
> Explain each criterion and its weight. Link each back to a goal from the Identify entry.
-

## Decision matrix
> Build it in Tools > Decision matrix, then press "Insert into entry". The matrix appears below as an attachment.

## Justification
> Which option won and why? If the team overrode the top score, explain the reasoning honestly.

## Plan to build it
> Who does what, by when? Add these as goals in the Plan tab. List parts and time needed.
-
`,
  },
  {
    id: 'build', label: 'Build', tag: 'green',
    blurb: 'Step-by-step build record with photos, problems hit and how they were solved.',
    template: `## Goal for this session
> What did you set out to build today, and which design decision (page number) does it implement?

## Steps completed
> Enough detail that another team could rebuild it: parts, gear ratios, motor ports, dimensions. Attach a photo or robot snapshot for each major step.
-

## Problems encountered and how we solved them
> Be specific: what went wrong, what you tried, what fixed it. Failed attempts are valuable evidence.
- **Problem:**
- **Fix:**

## Current state of the robot
> Attach "Snapshot robot build". What works now? What is still unfinished?

## Next step
`,
  },
  {
    id: 'program', label: 'Program', tag: 'blue',
    blurb: 'Pseudocode or flowchart, code snapshot, and what changed and why.',
    template: `## What this program must do
> The behaviour in plain words, tied to a goal from the Identify entry.

## Plan (pseudocode or flowchart)
> Write the steps before the code. Attach a flowchart image if you drew one.
-

## Code snapshot
> Press "Snapshot current code" to attach the exact program. Explain the important parts: sensors used, constants chosen and why.

## What changed since the last version, and why
> Reference the earlier page number. One line per change with its reason.
-

## Result when run
> What happened the first time? Attach a field screenshot. What needs testing next?
`,
  },
  {
    id: 'test', label: 'Test', tag: 'yellow',
    blurb: 'Procedure, trials table, data, analysis, and a conclusion that leads to the next step.',
    template: `## What we are testing and the success criterion
> Quote the measurable goal (and its page number) this test checks.

## Procedure
> Starting position, what is kept the same, the one variable being changed, number of trials. Someone else should be able to repeat it.
-

## Data
> Record trials in Tools > Test log (or "Import last simulator run"), then insert the table here. Aim for at least 3 trials per setup.

## Analysis
> What do the numbers show? Mean, best, worst, consistency. Did it meet the criterion? Explain surprising results.

## Conclusion and next step
> One clear decision: keep, change, or redesign, and which design-process phase you go to next.
`,
  },
  {
    id: 'reflect', label: 'Reflect / Iterate', tag: 'green',
    blurb: 'What worked, what did not, what you learned and what you will do next.',
    template: `## What worked
> Back each claim with evidence: a test page number or a match result.
-

## What did not work
> Honest and specific. Root cause if you know it.
-

## What we learned
> About the design, the code, and how the team works together.

## What we will do next
> Does this start a new design cycle? State the new problem to identify, and add goals to the Plan tab.
-
`,
  },
  {
    id: 'manage', label: 'Team / Project Management', tag: '',
    blurb: 'Meeting notes, roles, schedule, resources and progress against the plan.',
    template: `## Meeting details
> Date, who attended, how long.

## Progress since last meeting
> Compare against the goals in the Plan tab: done, late, blocked.
-

## Decisions made
-

## Tasks assigned
> Name, task, due date for each person.
-

## Resources and risks
> Time left before the next event, parts or skills you are missing, and the plan to deal with them.
`,
  },
];
const PHASE = Object.fromEntries(PHASES.map((p) => [p.id, p]));
// One documented loop = these stages in order (build and program count as one stage).
const STAGES = [['identify'], ['brainstorm'], ['select'], ['build', 'program'], ['test'], ['reflect']];
const STAGE_NAMES = ['Identify', 'Brainstorm', 'Select', 'Build / Program', 'Test', 'Reflect'];
const GOAL_STATUS = ['Not started', 'In progress', 'Done', 'Blocked'];
const AUTO_MIN_WORDS = 15;

function phaseId(p) {
  const s = String(p || '').toLowerCase().trim();
  const direct = PHASES.find((x) => x.id === s || x.label.toLowerCase() === s);
  if (direct) return direct.id;
  if (/ident|problem/.test(s)) return 'identify';
  if (/brain|research/.test(s)) return 'brainstorm';
  if (/select|decision|matrix/.test(s)) return 'select';
  if (/build/.test(s)) return 'build';
  if (/program|code/.test(s)) return 'program';
  if (/reflect|iterat/.test(s)) return 'reflect';
  if (/manage|team|project/.test(s)) return 'manage';
  return 'test';
}

/* ------------------------------------------------------------------ */
/* Small pure helpers                                                  */
/* ------------------------------------------------------------------ */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad2 = (n) => String(n).padStart(2, '0');
const dayKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const wordCount = (s) => String(s || '').split(/\s+/).filter(Boolean).length;
const num = (v) => { const m = /^\s*-?\d+(\.\d+)?/.exec(String(v ?? '')); return m ? parseFloat(m[0]) : null; };
const round2 = (n) => Math.round(n * 100) / 100;
const clone = (o) => JSON.parse(JSON.stringify(o));
const byPage = (entries) => [...entries].sort((a, b) => a.page - b.page);
const splitNames = (s) => String(s || '').split(/[,;&\n]|\band\b/i).map((x) => x.trim()).filter(Boolean);

function inlineMd(s) {
  return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/** Markdown-lite: paragraphs, **bold**, `code`, "- " bullets, "## " headings, ``` blocks, "> " guidance prompts. */
export function mdToHtml(src, showHints = false) {
  const out = [];
  let para = [], list = [], code = null;
  const flushP = () => { if (para.length) { out.push('<p>' + para.map(inlineMd).join('<br>') + '</p>'); para = []; } };
  const flushL = () => { if (list.length) { out.push('<ul>' + list.map((i) => '<li>' + inlineMd(i) + '</li>').join('') + '</ul>'); list = []; } };
  for (const raw of String(src || '').replace(/\r/g, '').split('\n')) {
    if (code) {
      if (/^```/.test(raw)) { out.push('<pre>' + esc(code.join('\n')) + '</pre>'); code = null; } else code.push(raw);
      continue;
    }
    const line = raw.trimEnd();
    if (/^```/.test(line)) { flushP(); flushL(); code = []; continue; }
    if (!line.trim()) { flushP(); flushL(); continue; }
    if (/^>\s?/.test(line)) {
      flushP(); flushL();
      if (showHints) out.push('<p class="nb-hint">' + inlineMd(line.replace(/^>\s?/, '')) + '</p>');
      continue;
    }
    const hd = /^#{1,3}\s+(.*)$/.exec(line);
    if (hd) { flushP(); flushL(); out.push('<h4 class="nb-h">' + inlineMd(hd[1]) + '</h4>'); continue; }
    const li = /^\s*[-*]\s+(.*)$/.exec(line) || (/^\s*[-*]$/.test(line) ? [0, ''] : null);
    if (li) { flushP(); if (li[1].trim()) list.push(li[1]); continue; }
    flushL(); para.push(line);
  }
  if (code) out.push('<pre>' + esc(code.join('\n')) + '</pre>');
  flushP(); flushL();
  return out.join('\n');
}

const stripHints = (body) => String(body || '').split('\n').filter((l) => !/^>\s?/.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();

/** Text the student actually wrote: no template prompts, headings or auto-captured text. */
function studentText(e) {
  let body = String(e.body || '');
  if (e.auto && e.autoText) body = body.startsWith(e.autoText) ? body.slice(e.autoText.length) : body.replace(e.autoText, '');
  return body.split('\n').filter((l) => !/^\s*(>|#{1,3}\s)/.test(l)).join('\n')
    .replace(/\*\*(Pros|Cons|Problem|Fix):\*\*/g, '').replace(/^\s*[-*]\s*$/gm, '');
}
const studentWords = (e) => wordCount(studentText(e));
const needsAnalysis = (e) => !!e.auto && studentWords(e) < AUTO_MIN_WORDS;

function matrixTotals(m) {
  const totals = m.options.map((_, o) => m.criteria.reduce((s, c, ci) => s + (Number(c.weight) || 0) * (Number(m.scores[ci]?.[o]) || 0), 0));
  const max = Math.max(...totals, 0);
  const winners = max > 0 ? totals.map((t, i) => (t === max ? i : -1)).filter((i) => i >= 0) : [];
  return { totals, winners, maxPossible: 5 * m.criteria.reduce((s, c) => s + (Number(c.weight) || 0), 0) };
}

function testStats(t) {
  const vals = t.rows.map((r) => num(r.result)).filter((v) => v != null);
  if (!vals.length) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const hi = Math.max(...vals), lo = Math.min(...vals);
  return { n: vals.length, mean: round2(mean), best: t.higherBetter === false ? lo : hi, worst: t.higherBetter === false ? hi : lo, range: round2(hi - lo) };
}

function cycleProgress(entries) {
  let i = 0, loops = 0;
  for (const e of byPage(entries)) {
    if (STAGES[i].includes(e.phase)) { i += 1; if (i === STAGES.length) { loops += 1; i = 0; } }
  }
  return { loops, next: i };
}

/* ------------------------------------------------------------------ */
/* Content renderers (HTML strings — shared by screen and print)       */
/* ------------------------------------------------------------------ */

function matrixHtml(m) {
  const { totals, winners, maxPossible } = matrixTotals(m);
  const win = (i) => (winners.includes(i) ? ' class="nb-win"' : '');
  return `<table class="nb-table"><thead><tr><th>Criterion</th><th>Weight</th>${m.options.map((o, i) => `<th${win(i)}>${esc(o || 'Option ' + (i + 1))}</th>`).join('')}</tr></thead><tbody>${
    m.criteria.map((c, ci) => `<tr><td>${esc(c.name || 'Criterion ' + (ci + 1))}</td><td>${esc(c.weight)}</td>${m.options.map((_, o) => {
      const s = Number(m.scores[ci]?.[o]) || 0;
      return `<td${win(o)}>${s} <span class="nb-dim">(&times;${esc(c.weight)} = ${round2(s * (Number(c.weight) || 0))})</span></td>`;
    }).join('')}</tr>`).join('')
  }<tr class="nb-total"><td>Weighted total</td><td>max ${maxPossible}</td>${totals.map((t, i) => `<td${win(i)}>${round2(t)}${winners.includes(i) ? ' &#9733;' : ''}</td>`).join('')}</tr></tbody></table>
  <div class="nb-dim">Scores 1 (poor) to 5 (excellent) &times; weight. ${winners.length ? 'Highest total: <strong>' + winners.map((i) => esc(m.options[i] || 'Option ' + (i + 1))).join(' / ') + '</strong>' + (winners.length > 1 ? ' (tie)' : '') + '.' : 'No scores entered yet.'}</div>`;
}

function testlogHtml(t) {
  const st = testStats(t);
  return `<table class="nb-table"><thead><tr><th>Trial</th><th>Setup / variable</th><th>Result${t.metric ? ' — ' + esc(t.metric) : ''}</th><th>Notes</th></tr></thead><tbody>${
    t.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.setup || '')}</td><td>${esc(r.result ?? '')}</td><td>${esc(r.notes || '')}</td></tr>`).join('')
  }</tbody></table><div class="nb-dim">${st
    ? `Numeric trials: <strong>${st.n}</strong> &middot; Mean: <strong>${st.mean}</strong> &middot; Best: <strong>${st.best}</strong> &middot; Worst: <strong>${st.worst}</strong> &middot; Range: ${st.range} (${t.higherBetter === false ? 'lower' : 'higher'} is better)`
    : 'No numeric results yet.'}</div>`;
}

function dataHtml(a) {
  return `<table class="nb-table"><thead><tr>${a.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${
    a.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

const ATT_LABEL = { image: 'Image', code: 'Code snapshot', robot: 'Robot build snapshot', matrix: 'Decision matrix', testlog: 'Test log', data: 'Data' };

function attachmentHtml(a, n) {
  const head = `<div class="nb-att-h">Attachment ${n} — ${ATT_LABEL[a.type] || 'Attachment'}${a.title ? ': ' + esc(a.title) : ''}${a.at ? ' <span class="nb-dim">(' + esc(fmtDateTime(a.at)) + ')</span>' : ''}</div>`;
  let inner = '';
  if (a.type === 'image') inner = `<img src="${esc(a.src)}" alt="${esc(a.caption || a.title || 'attachment image')}">`;
  else if (a.type === 'code') inner = `<pre>${esc(a.code || '')}</pre>`;
  else if (a.type === 'robot') inner = `<pre>${esc(a.text || '')}</pre>`;
  else if (a.type === 'matrix') inner = matrixHtml(a);
  else if (a.type === 'testlog') inner = testlogHtml(a);
  else if (a.type === 'data') inner = dataHtml(a);
  return `<div class="nb-att">${head}${inner}${a.caption ? `<div class="nb-cap">${esc(a.caption)}</div>` : ''}</div>`;
}

function entryContentHtml(e, showHints) {
  return `<div class="nb-md">${mdToHtml(e.body, showHints) || '<p class="nb-dim">(no text)</p>'}</div>${(e.attachments || []).map((a, i) => attachmentHtml(a, i + 1)).join('')}`;
}

/* ------------------------------------------------------------------ */
/* Rubric self-check                                                   */
/* ------------------------------------------------------------------ */

const LEVELS = ['Not started', 'Emerging', 'Proficient', 'Expert'];

/** Heuristic self-check against the judged criteria of the RECF Engineering Notebook Rubric. */
export function rubricCheck(nb) {
  const E = byPage(nb.entries);
  const P = (...ids) => E.filter((e) => ids.includes(e.phase));
  const W = (list) => list.reduce((s, e) => s + studentWords(e), 0);
  const A = (list, ...types) => list.flatMap((e) => e.attachments || []).filter((a) => types.includes(a.type));
  const text = (list) => list.map((e) => studentText(e)).join('\n').toLowerCase();
  const out = [];
  const add = (name, checks, evidence, tips) => {
    let level = 0;
    while (level < 3 && checks[level]) level += 1;
    out.push({ name, level, label: LEVELS[level], evidence, tip: tips[level] });
  };

  { // 1
    const L = P('identify'), t = text(L), w = W(L);
    add('Identify the problem / design goal', [
      L.length >= 1 && w >= 20,
      w >= 60 && /goal|criteri|success|must|need/.test(t),
      w >= 150 && /constraint|rule|limit|<[a-z]+\d+>|\b[a-z]{1,3}\d+\b/.test(t) && /\d/.test(t) && (L.length >= 2 || cycleProgress(E).loops < 2),
    ], `${L.length} Identify entr${L.length === 1 ? 'y' : 'ies'}, ${w} words in your own words.`, [
      'Write an Identify Problem entry: state the game challenge or subsystem problem in your own words (at least a few sentences).',
      'Add explicit goals: what must the robot do, and how will you know it succeeded?',
      'Add constraints with rule numbers from the game manual and success criteria with numbers you can measure (points, seconds, out-of-10 runs). Write a new Identify entry at the start of each design cycle.',
      'Keep it up: re-identify the problem at the start of every new design cycle.',
    ]);
  }
  { // 2
    const L = P('brainstorm'), t = text(L), w = W(L), imgs = A(L, 'image').length;
    const cites = /https?:|www\.|source|cited|reference|forum|manual|video|according to/.test(t);
    add('Brainstorm, diagram or prototype solutions', [
      L.length >= 1 && w >= 20,
      w >= 80 && imgs >= 1,
      w >= 200 && imgs >= 3 && cites,
    ], `${L.length} Brainstorm entr${L.length === 1 ? 'y' : 'ies'}, ${w} words, ${imgs} sketch/image attachment${imgs === 1 ? '' : 's'}, research cited: ${cites ? 'yes' : 'no'}.`, [
      'Add a Brainstorm & Research entry listing the different ways you could solve the problem.',
      'Describe each concept in more detail and attach at least one labelled sketch, diagram or field screenshot.',
      'Document three or more genuinely different concepts, each with its own sketch and pros/cons, and cite your research sources (manual section, forum thread, video) by name.',
      'Strong. Keep citing sources and crediting which teammate proposed each idea.',
    ]);
  }
  { // 3
    const L = P('select'), w = W(L), ms = A(L, 'matrix');
    const good = ms.some((m) => m.options.length >= 2 && m.criteria.length >= 3 && matrixTotals(m).winners.length);
    const great = ms.some((m) => m.options.length >= 3 && m.criteria.length >= 4 && new Set(m.criteria.map((c) => Number(c.weight))).size > 1 && matrixTotals(m).winners.length);
    const plan = nb.goals.length >= 1 || /plan|by when|due|schedule/.test(text(L));
    add('Select the best solution and plan', [
      L.length >= 1 && (w >= 20 || ms.length > 0),
      good && w >= 30,
      great && w >= 80 && plan,
    ], `${L.length} Select entr${L.length === 1 ? 'y' : 'ies'}, ${ms.length} decision matri${ms.length === 1 ? 'x' : 'ces'}, ${w} words of justification, plan present: ${plan ? 'yes' : 'no'}.`, [
      'Add a Select Solution entry explaining which concept you chose.',
      'Build a decision matrix (Tools tab) with at least 3 criteria and 2 options, insert it into the Select entry, and write why the winner won.',
      'Compare 3+ options on 4+ criteria with different weights, explain why each weight was chosen, and add a build plan (who, what, by when) as goals in the Plan tab.',
      'Strong. Revisit the matrix when test data changes what you know.',
    ]);
  }
  { // 4
    const B = P('build'), G = P('program'), L = [...B, ...G], w = W(L);
    const vis = A(L, 'image', 'robot').length, code = A(L, 'code').length;
    add('Build and program the solution', [
      L.length >= 1 && w >= 20,
      B.length >= 1 && G.length >= 1 && vis >= 1 && code >= 1 && w >= 100,
      B.length >= 3 && G.length >= 3 && vis >= 3 && code >= 2 && w / L.length >= 60,
    ], `${B.length} Build + ${G.length} Program entries, ${vis} photo/robot snapshot${vis === 1 ? '' : 's'}, ${code} code snapshot${code === 1 ? '' : 's'}, about ${L.length ? Math.round(w / L.length) : 0} words each.`, [
      'Record a Build or Program entry describing what you made this session.',
      'Have at least one Build entry with a photo or robot snapshot and one Program entry with a code snapshot, with enough explanation to follow.',
      'Document every session: 3+ Build and 3+ Program entries, each with images or code and enough detail (ports, ratios, constants, what changed and why) that another team could recreate your robot.',
      'Strong. The test is whether someone could rebuild the robot from the notebook alone.',
    ]);
  }
  { // 5
    const L = P('test'), w = W(L), logs = A(L, 'testlog');
    const solid = logs.filter((t) => (testStats(t)?.n || 0) >= 3).length;
    const withLog = L.filter((e) => (e.attachments || []).some((a) => a.type === 'testlog' && (testStats(a)?.n || 0) >= 3) && studentWords(e) >= 50).length;
    add('Test the solution', [
      L.length >= 1 && (w >= 20 || logs.length > 0),
      solid >= 1 && w >= 50,
      withLog >= 2,
    ], `${L.length} Test entr${L.length === 1 ? 'y' : 'ies'}, ${logs.length} test log${logs.length === 1 ? '' : 's'} (${solid} with 3+ numeric trials), ${w} words of analysis.`, [
      'Add a Test entry: what you tested and what happened.',
      'Attach a test log with at least 3 numeric trials (Tools tab) and write what the numbers mean.',
      'Do this for two or more separate tests, each with procedure, 3+ trials, analysis against your success criterion, and a conclusion that states the next step.',
      'Strong. Test after every significant change and compare against earlier data.',
    ]);
  }
  { // 6
    const c = cycleProgress(E), phases = new Set(E.map((e) => e.phase).filter((p) => p !== 'manage')).size;
    add('Repeat the design process', [
      phases >= 3,
      c.loops >= 1,
      c.loops >= 2 && P('reflect').length >= 2,
    ], `${c.loops} complete documented loop${c.loops === 1 ? '' : 's'}; ${phases} of 7 phases used; current loop is waiting for: ${STAGE_NAMES[c.next]}.`, [
      'Write entries in at least three different design-process phases.',
      `Finish one full loop in order (Identify, Brainstorm, Select, Build/Program, Test, Reflect). Your next missing stage is: ${STAGE_NAMES[c.next]}.`,
      `Document a second full loop: use your Reflect entry to identify a new problem and go round again. Next stage needed: ${STAGE_NAMES[c.next]}.`,
      'Strong. Multiple documented iterations are exactly what judges look for.',
    ]);
  }
  { // 7
    const real = E.filter((e) => studentWords(e) >= 10), w = W(E), avg = E.length ? w / E.length : 0;
    const pending = E.filter(needsAnalysis).length, t = text(E);
    const inquiry = /because|we found|we learned|we noticed|research|hypothes|why|therefore|so we/.test(t);
    add('Independent inquiry (student-directed work)', [
      w >= 100,
      avg >= 40 && inquiry && pending <= Math.floor(E.length / 4),
      avg >= 70 && pending === 0 && P('reflect').length >= 2 && /https?:|www\.|source|forum|manual|video|reference/.test(t),
    ], `${real.length} of ${E.length} entries contain your own writing, about ${Math.round(avg)} words per entry; ${pending} auto-captured entr${pending === 1 ? 'y' : 'ies'} still need analysis.`, [
      'Write in your own words. Auto-captured data and template prompts do not count until you explain them.',
      'Explain the "why" behind decisions (use words like "because" and "we found") and add analysis to every auto-captured entry.',
      'Average 70+ of your own words per entry, leave no auto-captured entry without analysis, write Reflect entries for each cycle, and cite the research that informed your own conclusions.',
      'Strong. The notebook clearly shows the students doing the thinking.',
    ]);
  }
  { // 8
    const n = E.length, withAuth = E.filter((e) => splitNames(e.authors).length).length;
    const signed = E.filter((e) => e.signedAt).length, wit = E.filter((e) => e.signedAt && e.witnessedBy).length;
    const days = new Set(E.map((e) => dayKey(e.created))).size;
    const chrono = E.every((e, i) => i === 0 || new Date(e.created) >= new Date(E[i - 1].created));
    const untitled = E.filter((e) => !String(e.title || '').trim()).length;
    add('Usability and completeness (dated, named, in sequence)', [
      n >= 3 && withAuth >= 1,
      n >= 5 && withAuth / n >= 0.8 && signed / n >= 0.6 && chrono && untitled === 0,
      n >= 10 && withAuth === n && signed / n >= 0.9 && wit / n >= 0.5 && days >= 5 && chrono,
    ], `${n} entries on ${days} different day${days === 1 ? '' : 's'}; ${withAuth} name their authors; ${signed} signed (${wit} witnessed); in date order: ${chrono ? 'yes' : 'no'}; untitled: ${untitled}.`, [
      'Create at least three entries and fill in the authors on each.',
      'Reach 5+ entries, give every entry a title and authors, and sign most of them when the session ends.',
      'Reach 10+ entries across 5+ different days, sign nearly all of them, and get a teammate to witness at least half. Record entries on the day the work happens.',
      'Strong. A judge can follow the whole season page by page.',
    ]);
  }
  { // 9
    const L = P('manage'), g = nb.goals, dated = g.filter((x) => x.due).length, done = g.filter((x) => x.status === 'Done').length;
    const people = new Set(E.flatMap((e) => [...splitNames(e.authors), ...splitNames(e.signedBy)]).map((x) => x.toLowerCase())).size;
    add('Record of team and project management', [
      L.length >= 1 || g.length >= 1,
      L.length >= 2 && dated >= 3 && nb.team.members.length >= 1,
      L.length >= 4 && dated >= 5 && done >= 1 && g.some((x) => x.owner) && people >= 2,
    ], `${L.length} management entr${L.length === 1 ? 'y' : 'ies'}; ${g.length} goal${g.length === 1 ? '' : 's'} (${dated} with due dates, ${done} done); ${people} different people named as authors or signers.`, [
      'Add a goal with a due date in the Plan tab, or write a Team / Project Management entry (meeting notes, roles).',
      'Write 2+ management entries, set 3+ goals with due dates, and list your team members in the Team tab.',
      'Keep it running all season: 4+ management entries, 5+ dated goals with owners, statuses kept up to date, and entries authored by more than one teammate.',
      'Strong. The notebook shows how time, people and resources were managed.',
    ]);
  }
  { // 10
    const all = E.flatMap((e) => e.attachments || []), types = new Set(all.map((a) => a.type));
    const withVis = E.filter((e) => (e.attachments || []).length).length, team = nb.team;
    add('Notebook format, organization and innovation', [
      !!(team.number || team.name) && E.length >= 1,
      E.length >= 5 && types.size >= 3 && withVis / E.length >= 0.4 && !!team.number && !!team.name,
      E.length >= 10 && types.has('image') && types.has('matrix') && types.has('testlog') && types.has('code') && withVis / E.length >= 0.6 && nb.goals.length >= 1,
    ], `Team info ${team.number && team.name ? 'complete' : 'incomplete'}; ${all.length} attachments of ${types.size} kind${types.size === 1 ? '' : 's'}; ${withVis} of ${E.length} entries have visuals or data.`, [
      'Fill in the Team tab (number and name) so the cover page is complete, and write your first entry.',
      'Use at least three kinds of attachment (images, code, matrices, test logs) and put visuals or data in 40% or more of your entries.',
      'Use every tool: images, code snapshots, a decision matrix, test logs and a project timeline, with visuals or data in most of 10+ entries.',
      'Strong. The notebook is organized, visual and easy for a judge to navigate.',
    ]);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Print / PDF document                                                */
/* ------------------------------------------------------------------ */

const PRINT_CSS = `
*{box-sizing:border-box}
html,body{margin:0;background:#fff;color:#111;font-family:Georgia,'Times New Roman',serif;font-size:11.5pt;line-height:1.45}
.bar{position:sticky;top:0;background:#f3f4f6;border-bottom:1px solid #ccc;padding:8px 16px;font-family:system-ui,sans-serif;font-size:13px;display:flex;gap:12px;align-items:center}
.bar button{font:inherit;padding:6px 14px;border:1px solid #1d4f8f;background:#1d4f8f;color:#fff;border-radius:5px;cursor:pointer}
.sheet{max-width:7.5in;margin:0 auto;padding:0.4in 0.2in;page-break-after:always;break-after:page}
.sheet:last-child{page-break-after:auto;break-after:auto}
h1,h2,h3,h4{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;margin:0 0 6pt}
.cover{text-align:center;padding-top:1.6in}
.cover .num{font-size:54pt;font-weight:800;letter-spacing:.02em;font-family:system-ui,sans-serif}
.cover h1{font-size:26pt;margin-top:10pt}
.cover .sub{font-size:14pt;margin:6pt 0}
.cover .box{margin:0.6in auto 0;border:1.5pt solid #111;padding:14pt 20pt;max-width:5in;text-align:left;font-size:11pt}
.cover .box div{margin:3pt 0}
.note{font-size:9.5pt;color:#444;margin-top:0.5in;text-align:left}
table{border-collapse:collapse;width:100%;font-size:10pt;margin:4pt 0}
th,td{border:.75pt solid #555;padding:3pt 6pt;text-align:left;vertical-align:top}
th{background:#eceff3;font-family:system-ui,sans-serif}
.nb-win{background:#dff3e4;font-weight:700}
.nb-total td{font-weight:700;border-top:1.5pt solid #111}
.nb-dim{color:#555;font-size:9.5pt}
.ehead{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.5pt solid #111;padding-bottom:4pt;margin-bottom:8pt;font-family:system-ui,sans-serif;font-size:9.5pt}
.ehead .pg{font-size:15pt;font-weight:800}
.etitle{font-size:16pt;margin-bottom:2pt}
.emeta{font-family:system-ui,sans-serif;font-size:9.5pt;color:#333;margin-bottom:8pt}
.flag{display:inline-block;border:1pt solid #111;padding:0 5pt;font-family:system-ui,sans-serif;font-size:8.5pt;font-weight:700;margin-left:6pt}
.nb-h{font-size:11.5pt;margin:10pt 0 3pt;border-bottom:.5pt solid #999;padding-bottom:1pt}
.nb-md p{margin:0 0 6pt}.nb-md ul{margin:0 0 6pt;padding-left:18pt}
pre{background:#f5f6f8;border:.75pt solid #bbb;padding:6pt;font-family:Consolas,Menlo,monospace;font-size:8.5pt;white-space:pre-wrap;word-break:break-word;margin:4pt 0}
code{font-family:Consolas,Menlo,monospace;font-size:9.5pt;background:#f0f1f3;padding:0 2pt}
.nb-att{margin:10pt 0;break-inside:avoid;page-break-inside:avoid}
.nb-att pre,.nb-att table{break-inside:auto;page-break-inside:auto}
.nb-att-h{font-family:system-ui,sans-serif;font-size:9.5pt;font-weight:700;margin-bottom:3pt}
.nb-att img{max-width:100%;max-height:5.2in;border:.75pt solid #777;display:block}
.nb-cap{font-style:italic;font-size:10pt;margin-top:2pt}
.sig{display:grid;grid-template-columns:2fr 1fr;gap:6pt 18pt;margin-top:22pt;break-inside:avoid;page-break-inside:avoid;font-family:system-ui,sans-serif}
.sig .ln{border-bottom:1pt solid #111;min-height:20pt;font-size:12pt;font-family:'Segoe Script','Bradley Hand',cursive;padding:0 4pt}
.sig label{font-size:8pt;color:#333;text-transform:uppercase;letter-spacing:.05em}
.lock{font-family:system-ui,sans-serif;font-size:8.5pt;color:#333;margin-top:6pt}
.foot{margin-top:14pt;border-top:.5pt solid #999;padding-top:3pt;font-family:system-ui,sans-serif;font-size:8.5pt;color:#444;display:flex;justify-content:space-between}
@page{size:letter;margin:0.6in}
@media print{.bar{display:none}.sheet{max-width:none;padding:0;margin:0}}
`;

/** Complete, standalone white-paper HTML document for printing / saving as PDF. */
export function buildPrintHtml(nbIn) {
  const nb = normalize(nbIn);
  const t = nb.team, E = byPage(nb.entries);
  const teamLine = [t.number, t.name].filter(Boolean).join(' — ') || 'Team';
  const first = E[0]?.created, last = E[E.length - 1]?.created;
  const pageOf = (id) => nb.entries.find((x) => x.id === id)?.page;
  const tocRows = [
    ...E.map((e) => ({ page: e.page, html: `<tr><td>${e.page}</td><td>${esc(fmtDate(e.created))}</td><td>${esc(e.title || 'Untitled')}${e.amends ? ` <span class="nb-dim">(amends p.${pageOf(e.amends) ?? '?'})</span>` : ''}</td><td>${esc(PHASE[e.phase]?.label || '')}</td><td>${esc(e.authors || '')}</td><td>${e.signedAt ? 'Signed' : 'Draft'}</td></tr>` })),
    ...nb.voided.map((v) => ({ page: v.page, html: `<tr><td>${v.page}</td><td>${esc(fmtDate(v.date))}</td><td colspan="4"><em>Page voided — draft removed before signing</em></td></tr>` })),
  ].sort((a, b) => a.page - b.page).map((r) => r.html).join('');

  const cover = `<section class="sheet cover">
    <div class="num">${esc(t.number || '')}</div>
    <h1>Engineering Notebook</h1>
    <div class="sub">${esc(t.name || '')}</div>
    <div class="sub">${esc(t.school || '')}</div>
    <div class="box">
      <div><strong>Team members:</strong> ${esc(t.members.join(', ') || '—')}</div>
      <div><strong>Entries:</strong> ${E.length} (${E.filter((e) => e.signedAt).length} signed)</div>
      <div><strong>Dates covered:</strong> ${first ? esc(fmtDate(first)) + ' to ' + esc(fmtDate(last)) : '—'}</div>
      <div><strong>Printed:</strong> ${esc(fmtDate(new Date().toISOString()))}</div>
    </div>
    <div class="note">Notebook rules followed by this team: every entry is numbered and dated when it is created; signed entries are locked and never edited; corrections are made only by a new amendment entry that references the original page; removed drafts leave a voided page number in the table of contents.</div>
  </section>`;

  const toc = `<section class="sheet"><h2>Table of Contents</h2>
    <table><thead><tr><th>Page</th><th>Date</th><th>Title</th><th>Design-process phase</th><th>Authors</th><th>Status</th></tr></thead><tbody>${tocRows || '<tr><td colspan="6">No entries yet.</td></tr>'}</tbody></table></section>`;

  const entries = E.map((e) => {
    const amendedBy = E.filter((x) => x.amends === e.id).map((x) => 'p.' + x.page);
    return `<section class="sheet">
      <div class="ehead"><div>${esc(teamLine)} &middot; Engineering Notebook</div><div class="pg">Page ${e.page}</div></div>
      <h2 class="etitle">${esc(e.title || 'Untitled')}${e.signedAt ? '' : '<span class="flag">DRAFT — NOT SIGNED</span>'}</h2>
      <div class="emeta"><strong>Date:</strong> ${esc(fmtDateTime(e.created))} &nbsp;|&nbsp; <strong>Phase:</strong> ${esc(PHASE[e.phase]?.label || '')} &nbsp;|&nbsp; <strong>Authors:</strong> ${esc(e.authors || '—')}
        ${e.amends ? `<br><strong>Amendment to page ${pageOf(e.amends) ?? '?'}.</strong> The original page is unchanged.` : ''}
        ${amendedBy.length ? `<br><strong>See amendment on ${amendedBy.join(', ')}.</strong>` : ''}
        ${e.auto ? '<br>Includes data auto-captured from the simulator.' : ''}</div>
      ${entryContentHtml(e, false)}
      <div class="sig">
        <div><div class="ln">${esc(e.signedBy || '')}</div><label>Signed by (author)</label></div>
        <div><div class="ln">${esc(e.signedAt ? fmtDate(e.signedAt) : '')}</div><label>Date</label></div>
        <div><div class="ln">${esc(e.witnessedBy || '')}</div><label>Witnessed by</label></div>
        <div><div class="ln">${esc(e.signedAt && e.witnessedBy ? fmtDate(e.signedAt) : '')}</div><label>Date</label></div>
      </div>
      ${e.signedAt ? `<div class="lock">Electronically signed and locked ${esc(fmtDateTime(e.signedAt))}. No edits after this time.</div>` : ''}
      <div class="foot"><span>${esc(teamLine)}</span><span>Page ${e.page}</span></div>
    </section>`;
  }).join('');

  const c = cycleProgress(E);
  const plan = nb.goals.length ? `<section class="sheet"><h2>Appendix — Project Plan</h2>
    <table><thead><tr><th>Goal</th><th>Owner</th><th>Start</th><th>Due</th><th>Status</th></tr></thead><tbody>${
      nb.goals.map((g) => `<tr><td>${esc(g.title || '')}</td><td>${esc(g.owner || '')}</td><td>${esc(g.start || '')}</td><td>${esc(g.due || '')}</td><td>${esc(g.status || '')}</td></tr>`).join('')
    }</tbody></table>
    <p class="nb-dim">Design cycles fully documented (Identify to Reflect): ${c.loops}. Entries per phase: ${PHASES.map((p) => esc(p.label) + ' ' + E.filter((e) => e.phase === p.id).length).join('; ')}.</p></section>` : '';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(teamLine)} — Engineering Notebook</title><style>${PRINT_CSS}</style></head><body>
<div class="bar"><button onclick="window.print()">Print / Save as PDF</button><span>In the print dialog choose "Save as PDF" as the destination. Turn off browser headers and footers for the cleanest pages.</span></div>
${cover}${toc}${entries}${plan}
</body></html>`;
}

/* ------------------------------------------------------------------ */
/* Data model                                                          */
/* ------------------------------------------------------------------ */

function normalize(raw) {
  const nb = raw && typeof raw === 'object' ? raw : {};
  const team = nb.team && typeof nb.team === 'object' ? nb.team : {};
  nb.team = {
    number: String(team.number || ''), name: String(team.name || ''), school: String(team.school || ''),
    members: Array.isArray(team.members) ? team.members.map(String).filter(Boolean) : splitNames(team.members),
  };
  nb.entries = (Array.isArray(nb.entries) ? nb.entries : []).filter((e) => e && typeof e === 'object').map((e, i) => ({
    id: String(e.id || uid() + i), page: Number(e.page) || 0, created: e.created || new Date().toISOString(),
    title: String(e.title || ''), phase: PHASE[e.phase] ? e.phase : phaseId(e.phase), authors: String(e.authors || ''),
    body: String(e.body || ''), attachments: Array.isArray(e.attachments) ? e.attachments.filter((a) => a && a.type) : [],
    signedBy: String(e.signedBy || ''), witnessedBy: String(e.witnessedBy || ''), signedAt: e.signedAt || null,
    auto: !!e.auto, autoText: String(e.autoText || ''), amends: e.amends || null,
  }));
  nb.voided = Array.isArray(nb.voided) ? nb.voided.filter((v) => v && v.page) : [];
  nb.goals = (Array.isArray(nb.goals) ? nb.goals : []).filter((g) => g && typeof g === 'object').map((g) => ({
    id: String(g.id || uid()), title: String(g.title || ''), owner: String(g.owner || ''), start: g.start || '', due: g.due || '',
    status: GOAL_STATUS.includes(g.status) ? g.status : GOAL_STATUS[0],
  }));
  let next = Math.max(0, ...nb.entries.map((e) => e.page), ...nb.voided.map((v) => Number(v.page) || 0)) + 1;
  for (const e of nb.entries) if (!e.page) { e.page = next; next += 1; } // repair imported entries without a page
  nb.nextPage = Math.max(Number(nb.nextPage) || 1, next);
  nb.rev = Number(nb.rev) || 0;
  return nb;
}

const blankMatrix = () => ({ title: '', criteria: [{ name: '', weight: 3 }, { name: '', weight: 3 }, { name: '', weight: 3 }], options: ['', '', ''], scores: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] });
const blankTestlog = () => ({ title: '', metric: '', higherBetter: true, rows: [{ setup: '', result: '', notes: '' }, { setup: '', result: '', notes: '' }, { setup: '', result: '', notes: '' }] });

function normalizeTools(raw) {
  const t = raw && typeof raw === 'object' ? raw : {};
  const m = t.matrix && Array.isArray(t.matrix.criteria) && Array.isArray(t.matrix.options) ? t.matrix : blankMatrix();
  m.scores = m.criteria.map((_, ci) => m.options.map((__, o) => Number(m.scores?.[ci]?.[o]) || 0));
  const l = t.testlog && Array.isArray(t.testlog.rows) ? t.testlog : blankTestlog();
  return { matrix: m, testlog: l };
}

function downscale(dataUrl, maxW = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxW / (img.naturalWidth || 1));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * s));
      c.height = Math.max(1, Math.round(img.naturalHeight * s));
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('That file could not be read as an image.'));
    img.src = dataUrl;
  });
}

const readFile = (file, as = 'DataURL') => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(new Error('Could not read the file.'));
  r['readAs' + as](file);
});

function dataToAttachment(data, title) {
  if (data == null) return null;
  if (Array.isArray(data) && data.length && data.every((r) => r && typeof r === 'object' && 'result' in r)) {
    return { id: uid(), type: 'testlog', title: title || 'Simulator data', metric: '', higherBetter: true, at: new Date().toISOString(),
      rows: data.map((r) => ({ setup: String(r.setup ?? r.variable ?? r.challenge ?? ''), result: String(r.result ?? ''), notes: String(r.notes ?? r.details ?? '') })) };
  }
  const cell = (v) => (v != null && typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''));
  let columns, rows;
  if (Array.isArray(data)) {
    if (data.every((r) => r && typeof r === 'object' && !Array.isArray(r))) {
      columns = [...new Set(data.flatMap((r) => Object.keys(r)))];
      rows = data.map((r) => columns.map((c) => cell(r[c])));
    } else { columns = ['#', 'Value']; rows = data.map((v, i) => [String(i + 1), cell(v)]); }
  } else if (typeof data === 'object') { columns = ['Field', 'Value']; rows = Object.entries(data).map(([k, v]) => [k, cell(v)]); }
  else { columns = ['Value']; rows = [[cell(data)]]; }
  return { id: uid(), type: 'data', title: title || 'Simulator data', columns, rows, at: new Date().toISOString() };
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const CSS = `
.nb-tabs{display:flex;gap:4px;flex-wrap:wrap}
.nb-spacer{flex:1}
.nb-warn{background:#e0453a26;border:1px solid #e0453a88;color:#ffb3ad;border-radius:6px;padding:6px 10px;width:100%;font-size:12.5px}
.nb-rule{border-left:3px solid var(--yellow);background:#f2c23014;padding:8px 12px;border-radius:0 6px 6px 0;font-size:12.5px;line-height:1.5}
.nb-intro{max-width:760px;margin:0 auto}
.nb-intro ul{margin:0 0 8px;padding-left:20px;line-height:1.6}
.nb-phasegrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}
.nb-phasebtn{text-align:left;cursor:pointer;white-space:normal;display:block}
.nb-phasebtn:hover{border-color:var(--accent)}
.nb-toc tr.nb-row{cursor:pointer}
.nb-toc tr.nb-row:hover td{background:var(--panel2)}
.nb-toc td.nb-void{color:var(--muted);font-style:italic}
.nb-snip{color:var(--muted);font-size:12px;margin-top:2px}
.nb-paper{background:var(--panel2);border:1px solid var(--border);border-radius:var(--radius);padding:16px 18px}
.nb-md ul{margin:0 0 8px;padding-left:20px;line-height:1.5}
.nb-h{margin:12px 0 4px;color:var(--text);text-transform:none;letter-spacing:0;font-size:13.5px;border-bottom:1px solid var(--border);padding-bottom:2px}
.nb-hint{color:var(--muted);font-style:italic;font-size:12.5px;border-left:2px solid var(--border);padding-left:8px}
.nb-md code{background:#0d1116;border:1px solid var(--border);border-radius:4px;padding:0 4px}
.nb-att{margin:12px 0;border:1px solid var(--border);border-radius:6px;padding:10px;background:var(--panel)}
.nb-att-h{font-weight:600;font-size:12.5px;margin-bottom:6px}
.nb-att img{max-width:100%;max-height:420px;border-radius:4px;display:block}
.nb-cap{font-style:italic;color:var(--muted);margin-top:4px;font-size:12.5px}
.nb-dim{color:var(--muted);font-size:12px}
.nb-win{background:#35b36b2e !important;font-weight:650}
.nb-total td{font-weight:650;border-top:2px solid var(--border)}
.nb-table{margin-bottom:4px}
.nb-attctl{display:flex;gap:8px;align-items:center;margin-top:6px}
.nb-body{min-height:300px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px}
.nb-mx input[type=number]{width:58px}
.nb-mx td,.nb-mx th{padding:4px}
.nb-mx input[type=text]{width:100%;min-width:90px}
.nb-x{background:none;border:0;color:var(--muted);cursor:pointer;padding:2px 6px;font-size:14px}
.nb-x:hover{color:var(--red)}
.nb-gantt{position:relative;border:1px solid var(--border);border-radius:6px;background:var(--panel);padding:22px 10px 8px;overflow:hidden}
.nb-grow{display:grid;grid-template-columns:150px 1fr;gap:8px;align-items:center;height:26px}
.nb-glabel{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}
.nb-gtrack{position:relative;height:16px;background:#ffffff0a;border-radius:4px}
.nb-gbar{position:absolute;top:0;bottom:0;border-radius:4px;min-width:6px;background:var(--accent)}
.nb-gbar.done{background:var(--green)}.nb-gbar.blocked,.nb-gbar.late{background:var(--red)}.nb-gbar.todo{background:#5b6779}
.nb-gaxis{position:absolute;top:4px;left:168px;right:10px;height:14px;font-size:10.5px;color:var(--muted)}
.nb-gaxis span{position:absolute;white-space:nowrap}
.nb-today{position:absolute;top:20px;bottom:6px;width:0;border-left:2px dashed var(--yellow);pointer-events:none}
.nb-bar{height:10px;border-radius:5px;background:var(--accent);min-width:2px}
.nb-cyc{display:grid;grid-template-columns:230px 1fr 30px;gap:8px;align-items:center;font-size:12.5px;margin:3px 0}
.nb-steps{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}
.nb-step{padding:3px 9px;border-radius:12px;border:1px solid var(--border);font-size:12px;color:var(--muted)}
.nb-step.done{background:#35b36b33;color:#8fe0b3;border-color:#35b36b66}
.nb-step.next{border-color:var(--yellow);color:#f7da7c}
.nb-lvl{display:flex;gap:3px}
.nb-lvl span{padding:2px 8px;border-radius:10px;border:1px solid var(--border);font-size:11px;color:var(--muted)}
.nb-lvl span.on1{background:#e0453a33;color:#ff9d95;border-color:#e0453a66}
.nb-lvl span.on2{background:#f2c23033;color:#f7da7c;border-color:#f2c23066}
.nb-lvl span.on3{background:#35b36b33;color:#8fe0b3;border-color:#35b36b66}
.nb-toast{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);background:#0e1217f2;border:1px solid var(--border);padding:8px 14px;border-radius:8px;z-index:5;max-width:80%}
.nb-modal h3{margin-bottom:10px}
.nb-field{display:flex;flex-direction:column;gap:4px;color:var(--muted);font-size:12px}
`;

function injectCss() {
  if (document.getElementById('nb-style')) return;
  document.head.append(h('style', { id: 'nb-style', textContent: CSS }));
}

let disposePrevious = null;

/* ------------------------------------------------------------------ */
/* mountNotebook                                                       */
/* ------------------------------------------------------------------ */

/**
 * Render the Engineering Notebook into `el`.
 * @param {HTMLElement} el  flex-column container that fills the panel
 * @param {{store?:object, bus?:object, app?:object}} ctx
 * @returns {{refresh:Function, openEntry:Function, addEntry:Function, destroy:Function}}
 */
export function mountNotebook(el, ctx = {}) {
  const S = ctx.store || defaultStore;
  const B = ctx.bus || defaultBus;
  const app = ctx.app || {};
  injectCss();
  if (disposePrevious) disposePrevious();

  let nb = normalize(S.get(KEY, null));
  let tools = normalizeTools(S.get(TOOLS_KEY, null));
  const ui = { tab: 'contents', openId: null, phase: '', search: '', preview: false };
  let saveTimer = null, toolsTimer = null, toastTimer = null;

  /* ---------- persistence ---------- */
  const warnEl = h('div.nb-warn', { style: 'display:none' },
    'Browser storage is full or unavailable, so your latest changes are NOT saved. Use "Export JSON" now to keep a backup, then remove large images or old drafts.');

  function save() {
    clearTimeout(saveTimer); saveTimer = null;
    nb.rev = (nb.rev || 0) + 1;
    S.set(KEY, nb);
    const back = S.get(KEY, null);
    const ok = !!back && back.rev === nb.rev;
    warnEl.style.display = ok ? 'none' : '';
    return ok;
  }
  const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); };
  const flush = () => { if (saveTimer) save(); };
  const saveTools = () => { clearTimeout(toolsTimer); toolsTimer = setTimeout(() => S.set(TOOLS_KEY, tools), 300); };

  /* ---------- small UI helpers ---------- */
  function toast(msg) {
    const host = document.getElementById('toast');
    if (host) {
      const d = h('div', msg); host.append(d); setTimeout(() => d.remove(), 4000);
      return;
    }
    el.querySelector('.nb-toast')?.remove();
    const d = h('div.nb-toast', msg);
    el.append(d);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => d.remove(), 4000);
  }

  let closeModal = null;
  function modal(title, content, buttons) {
    return new Promise((resolve) => {
      const close = (v) => { back.remove(); document.removeEventListener('keydown', onKey); closeModal = null; resolve(v); };
      closeModal = close;
      const onKey = (ev) => { if (ev.key === 'Escape') close(null); };
      const back = h('div.modal-back', { onclick: (ev) => { if (ev.target === back) close(null); } },
        h('div.modal.nb-modal', h('h3', title), content,
          h('div.row', { style: 'justify-content:flex-end;margin-top:14px' },
            buttons.map((b) => h('button.btn' + (b.cls ? '.' + b.cls : ''), { onclick: () => close(b.value) }, b.label)))));
      document.addEventListener('keydown', onKey);
      document.body.append(back);
    });
  }
  const confirmBox = (title, text, okLabel, cls = 'primary') => modal(title, h('p', text), [{ label: 'Cancel', value: false }, { label: okLabel, value: true, cls }]);

  function select(options, value, onchange, attrs = {}) {
    const s = h('select', { ...attrs, onchange: () => onchange(s.value) },
      options.map((o) => h('option', { value: o.value ?? o }, o.label ?? o)));
    s.value = value;
    return s;
  }
  const field = (label, control) => h('label.nb-field', label, control);
  const phaseTag = (id) => h('span.tag' + (PHASE[id]?.tag ? '.' + PHASE[id].tag : ''), PHASE[id]?.label || id);
  const getEntry = (id) => nb.entries.find((e) => e.id === id);
  const drafts = () => byPage(nb.entries).filter((e) => !e.signedAt).reverse();

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ---------- entry operations ---------- */
  function addEntry(fields = {}) {
    const lastAuthors = byPage(nb.entries).reverse().find((e) => e.authors)?.authors || '';
    const phase = PHASE[fields.phase] ? fields.phase : 'identify';
    const e = {
      id: uid(), page: nb.nextPage, created: new Date().toISOString(), title: '', phase, authors: lastAuthors,
      body: PHASE[phase].template, attachments: [], signedBy: '', witnessedBy: '', signedAt: null, auto: false, autoText: '', amends: null,
      ...fields, phase,
    };
    nb.nextPage += 1;
    nb.entries.push(e);
    save();
    return e;
  }

  function addAttachment(entry, att) {
    entry.attachments.push(att);
    if (save()) return true;
    entry.attachments.pop();
    save();
    toast('Not enough browser storage for that attachment. Export a JSON backup and remove some images first.');
    return false;
  }

  async function chooseNewEntry() {
    const grid = h('div.nb-phasegrid');
    const p = modal('New entry — which design-process phase?', h('div.col',
      h('p.muted', 'Pick the phase you are working in. The page is pre-filled with the prompts that strong notebooks answer for that phase.'), grid),
    [{ label: 'Cancel', value: null }]);
    for (const ph of PHASES) {
      grid.append(h('button.card.nb-phasebtn', {
        'data-phase': ph.id,
        onclick: () => {
          closeModal?.(null);
          const e = addEntry({ phase: ph.id });
          open(e.id);
        },
      }, h('div', { style: 'font-weight:650;margin-bottom:4px' }, ph.label), h('div.muted.small', ph.blurb)));
    }
    await p;
  }

  function open(id) { flush(); ui.tab = 'contents'; ui.openId = id; ui.preview = false; render(); }

  /* ---------- export / import ---------- */
  function exportJson() {
    flush();
    const name = `notebook-${(nb.team.number || 'team').replace(/[^\w-]+/g, '_')}-${dayKey(new Date().toISOString())}.json`;
    download(name, JSON.stringify({ format: 'vexvr-notebook', version: 1, exported: new Date().toISOString(), notebook: nb, tools }, null, 1), 'application/json');
    toast('Backup downloaded: ' + name);
  }

  function importJson() {
    const input = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;
      try {
        const data = JSON.parse(await readFile(file, 'Text'));
        const raw = data?.notebook || data;
        if (!raw || !Array.isArray(raw.entries)) throw new Error('This file is not a notebook backup.');
        const incoming = normalize(clone(raw));
        const ok = await confirmBox('Replace the current notebook?',
          `The backup has ${incoming.entries.length} entries (${incoming.entries.filter((e) => e.signedAt).length} signed). Your current notebook has ${nb.entries.length}. Importing replaces the current notebook on this computer. Export the current one first if you want to keep it.`,
          'Replace with backup', 'danger');
        if (!ok) return;
        const previous = nb;
        nb = incoming;
        if (!save()) { nb = previous; save(); toast('The backup is too large for browser storage. Nothing was changed.'); return; }
        if (data.tools) { tools = normalizeTools(data.tools); S.set(TOOLS_KEY, tools); }
        ui.openId = null; ui.tab = 'contents';
        render();
        toast('Notebook imported.');
      } catch (err) {
        toast('Import failed: ' + (err?.message || 'the file is not valid JSON.'));
      }
    });
    document.body.append(input);
    input.click();
  }

  function printNotebook() {
    flush();
    const html = buildPrintHtml(clone(nb));
    let w = null;
    try { w = window.open('', '_blank'); } catch { w = null; }
    if (!w) {
      download('engineering-notebook.html', html, 'text/html');
      toast('Pop-up blocked, so the print view was downloaded as engineering-notebook.html. Open it and print from there.');
      return null;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    const go = () => { try { w.focus(); w.print(); } catch { /* user can press the button in the print view */ } };
    if (w.document.readyState === 'complete') setTimeout(go, 400);
    else w.addEventListener('load', () => setTimeout(go, 400));
    return w;
  }

  /* ---------- shell ---------- */
  const TABS = [['contents', 'Contents'], ['tools', 'Matrix & Test log'], ['plan', 'Plan & Cycle'], ['rubric', 'Rubric self-check'], ['team', 'Team']];
  const head = h('div.panel-head');
  const body = h('div.panel-body');
  el.replaceChildren(head, body);
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';

  function renderHead() {
    const pending = nb.entries.filter((e) => !e.signedAt).length;
    head.replaceChildren(
      h('h2', 'Engineering Notebook'),
      nb.team.number ? h('span.tag.blue', nb.team.number) : null,
      h('span.tag', `${nb.entries.length} entr${nb.entries.length === 1 ? 'y' : 'ies'}${pending ? ` · ${pending} unsigned` : ''}`),
      h('div.nb-spacer'),
      h('button.btn.primary', { 'data-act': 'new', onclick: chooseNewEntry }, '+ New entry'),
      h('button.btn', { 'data-act': 'print', onclick: printNotebook, title: 'Open a white, paginated print layout' }, 'Print / Save as PDF'),
      h('button.btn', { 'data-act': 'export', onclick: exportJson }, 'Export JSON'),
      h('button.btn', { 'data-act': 'import', onclick: importJson }, 'Import JSON'),
      h('div.nb-tabs', { style: 'width:100%' }, TABS.map(([id, label]) => h('button.btn.small' + (ui.tab === id ? '.active' : ''), {
        'data-tab': id, onclick: () => { flush(); ui.tab = id; if (id !== 'contents') ui.openId = null; render(); },
      }, label))),
      warnEl,
    );
  }

  function render() {
    renderHead();
    const top = body.scrollTop;
    let view;
    if (ui.tab === 'tools') view = viewTools();
    else if (ui.tab === 'plan') view = viewPlan();
    else if (ui.tab === 'rubric') view = viewRubric();
    else if (ui.tab === 'team') view = viewTeam();
    else {
      const e = ui.openId && getEntry(ui.openId);
      if (!e) ui.openId = null;
      view = e ? (e.signedAt ? viewSigned(e) : viewDraft(e)) : viewContents();
    }
    body.replaceChildren(view);
    body.scrollTop = view.dataset.keepScroll ? top : 0;
  }

  /* ---------- Contents (table of contents, search, filter) ---------- */
  function intro() {
    return h('div.nb-intro.col',
      h('div.card',
        h('h3', 'Welcome to your engineering notebook'),
        h('p', 'An engineering notebook is the dated, page-by-page record of how your team designed the robot: the problem you set out to solve, the ideas you considered, why you chose one, what you built and coded, what the tests showed, and what you changed because of it.'),
        h('p', 'At VEX events, judges read the notebook to decide the Design, Innovate and Excellence awards. They score it with the Engineering Notebook Rubric, and they are looking for evidence that the students ran a real design process, more than once, and can prove it. A robot that works but has no record of how it got there scores poorly.'),
        h('ul',
          h('li', h('strong', 'Write as you go. '), 'An entry made on the day of the work is worth far more than one written from memory later.'),
          h('li', h('strong', 'Show your thinking. '), 'Include the ideas you rejected and the tests that failed, with the reasons.'),
          h('li', h('strong', 'Use data. '), 'Decision matrices and test tables turn opinions into evidence.'),
          h('li', h('strong', 'Sign each page. '), 'Signed pages lock like ink. To correct one, add an amendment entry; never rewrite history.')),
        h('p.muted', 'The simulator can capture runs, code and screenshots for you, but only your own explanation counts with judges.')),
      h('h3', 'Start your first entry'),
      h('div.nb-phasegrid', PHASES.map((ph) => h('button.card.nb-phasebtn', { 'data-phase': ph.id, onclick: () => open(addEntry({ phase: ph.id }).id) },
        h('div', { style: 'font-weight:650;margin-bottom:4px' }, ph.label), h('div.muted.small', ph.blurb)))),
      h('p.muted.small', 'Most teams begin with "Identify Problem". Also fill in the Team tab so the cover page is complete.'));
  }

  function haystack(e) {
    return [e.title, e.authors, e.body, PHASE[e.phase]?.label, e.signedBy, e.witnessedBy, 'page ' + e.page,
      ...(e.attachments || []).map((a) => [a.title, a.caption, a.code, a.text, a.type === 'matrix' ? [...a.options, ...a.criteria.map((c) => c.name)].join(' ') : '',
        a.type === 'testlog' ? a.rows.map((r) => `${r.setup} ${r.result} ${r.notes}`).join(' ') : '', a.type === 'data' ? a.rows.flat().join(' ') : ''].join(' '))].join('\n').toLowerCase();
  }

  function snippet(e, tokens) {
    const text = stripHints(e.body).replace(/\s+/g, ' ');
    const low = text.toLowerCase();
    const at = tokens.map((t) => low.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
    if (at == null) return null;
    const start = Math.max(0, at - 40);
    let html = esc((start ? '…' : '') + text.slice(start, at + 90) + (at + 90 < text.length ? '…' : ''));
    for (const t of tokens) {
      const safe = esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (safe) html = html.replace(new RegExp(safe, 'gi'), (m) => `<mark>${m}</mark>`);
    }
    return h('div.nb-snip', { html });
  }

  function viewContents() {
    if (!nb.entries.length && !nb.voided.length) return intro();
    const tableHost = h('div');
    const draw = () => {
      const tokens = ui.search.toLowerCase().split(/\s+/).filter(Boolean);
      const rows = byPage(nb.entries).filter((e) => (!ui.phase || e.phase === ui.phase)).filter((e) => { const hs = tokens.length ? haystack(e) : ''; return tokens.every((t) => hs.includes(t)); });
      const voided = !ui.phase && !tokens.length ? nb.voided : [];
      const all = [...rows.map((e) => ({ page: e.page, e })), ...voided.map((v) => ({ page: v.page, v }))].sort((a, b) => a.page - b.page);
      tableHost.replaceChildren(
        h('div.muted.small', { style: 'margin-bottom:6px' }, `${rows.length} of ${nb.entries.length} entries shown`),
        all.length ? h('table.nb-toc',
          h('thead', h('tr', ['Page', 'Date', 'Title', 'Phase', 'Authors', 'Signed?'].map((c) => h('th', c)))),
          h('tbody', all.map(({ e, v }) => (v
            ? h('tr', h('td', v.page), h('td', fmtDate(v.date)), h('td.nb-void', { colSpan: 4 }, 'Page voided — draft removed before signing'))
            : h('tr.nb-row', { 'data-entry': e.id, onclick: () => open(e.id) },
              h('td', e.page), h('td', fmtDate(e.created)),
              h('td', h('div', e.title || h('span.muted', 'Untitled')),
                e.amends ? h('div.nb-dim', `Amendment to page ${getEntry(e.amends)?.page ?? '?'}`) : null,
                needsAnalysis(e) && !e.signedAt ? h('span.tag.yellow', 'auto-captured — add your analysis before signing') : null,
                tokens.length ? snippet(e, tokens) : null),
              h('td', phaseTag(e.phase)), h('td', e.authors || h('span.muted', '—')),
              h('td', e.signedAt ? h('span.tag.green', 'Signed ' + fmtDate(e.signedAt)) : h('span.tag.yellow', 'Draft')))))))
          : h('div.card.muted', 'No entries match. Clear the search or the phase filter.'));
    };
    const search = h('input.grow', { type: 'search', placeholder: 'Search titles, text, code, data…', value: ui.search, 'data-nb': 'search',
      oninput: () => { ui.search = search.value; draw(); } });
    draw();
    return h('div.col',
      h('div.row', search,
        select([{ value: '', label: 'All phases' }, ...PHASES.map((p) => ({ value: p.id, label: p.label }))], ui.phase, (v) => { ui.phase = v; draw(); }, { 'data-nb': 'phase-filter' })),
      tableHost);
  }

  /* ---------- Entry: shared pieces ---------- */
  const inkRule = () => h('div.nb-rule',
    h('strong', 'The ink rule: '), 'a real engineering notebook is written in pen. Once you sign a page it is locked and can never be edited or deleted. If you find a mistake later, add an ',
    h('strong', 'amendment'), ' entry that points back to the original page and explains the correction. Judges trust notebooks that show their history honestly.');

  function entryHeader(e) {
    return h('div.row',
      h('button.btn.small', { 'data-act': 'back', onclick: () => { flush(); ui.openId = null; render(); } }, '← Contents'),
      h('span.tag', 'Page ' + e.page), h('span.muted.small', fmtDateTime(e.created)),
      e.signedAt ? h('span.tag.green', 'Signed and locked') : h('span.tag.yellow', 'Draft'),
      e.auto ? h('span.tag' + (needsAnalysis(e) ? '.yellow' : ''), needsAnalysis(e) ? 'auto-captured — add your analysis before signing' : 'auto-captured') : null);
  }

  function amendLinks(e) {
    const orig = e.amends && getEntry(e.amends);
    const later = byPage(nb.entries).filter((x) => x.amends === e.id);
    if (!orig && !later.length) return null;
    return h('div.card.small',
      orig ? h('div', 'This entry is an amendment to ', h('a', { href: '#', onclick: (ev) => { ev.preventDefault(); open(orig.id); } }, `page ${orig.page}: ${orig.title || 'Untitled'}`), '. The original page is unchanged.') : null,
      later.length ? h('div', 'Amended by: ', later.map((x, i) => [i ? ', ' : '', h('a', { href: '#', onclick: (ev) => { ev.preventDefault(); open(x.id); } }, `page ${x.page}`)])) : null);
  }

  /* ---------- Entry: signed (read-only) ---------- */
  function viewSigned(e) {
    return h('div.col',
      entryHeader(e),
      amendLinks(e),
      h('div.nb-paper',
        h('h2', e.title || 'Untitled'),
        h('div.row.small.muted', { style: 'margin-bottom:10px' }, phaseTag(e.phase), h('span', 'Authors: ' + (e.authors || '—'))),
        h('div', { html: entryContentHtml(e, false) }),
        h('div.grid2', { style: 'margin-top:14px' },
          h('div.card.small', h('div.muted', 'Signed by'), h('div', { style: 'font-size:15px' }, e.signedBy), h('div.muted', fmtDateTime(e.signedAt))),
          h('div.card.small', h('div.muted', 'Witnessed by'), h('div', { style: 'font-size:15px' }, e.witnessedBy || '— (no witness recorded)'), h('div.muted', e.witnessedBy ? fmtDateTime(e.signedAt) : '')))),
      h('div.nb-rule', 'This page is signed and locked, so it cannot be edited. Found a mistake or have new information? Add an amendment: a new page that references this one.'),
      h('div.row', h('button.btn.primary', { 'data-act': 'amend', onclick: () => {
        const a = addEntry({
          phase: e.phase, amends: e.id, title: `Amendment to page ${e.page}: ${e.title || 'Untitled'}`,
          body: `## What needs correcting on page ${e.page}\n> Quote or describe the part of the original page that was wrong, incomplete, or has changed.\n\n## Correction / new information\n> Write the corrected statement, data or drawing. Attach new evidence if you have it.\n\n## How we found out and why it matters\n> What showed you the original was wrong? Does it change any decision you made?\n`,
        });
        open(a.id);
      } }, 'Add amendment to this page')));
  }

  /* ---------- Entry: draft (editable) ---------- */
  function viewDraft(e) {
    const preview = h('div.nb-paper', { style: ui.preview ? '' : 'display:none' });
    const drawPreview = () => { if (ui.preview) preview.innerHTML = '<div class="nb-dim" style="margin-bottom:6px">Preview. Grey prompt lines are removed when you sign.</div>' + `<div class="nb-md">${mdToHtml(e.body, true)}</div>`; };
    const wordsEl = h('span.muted.small');
    const drawWords = () => { wordsEl.textContent = `${studentWords(e)} words in your own words`; };

    const title = h('input', { type: 'text', value: e.title, placeholder: 'e.g. Intake concept comparison', 'data-nb': 'title', oninput: () => { e.title = title.value; saveSoon(); } });
    const authors = h('input', { type: 'text', value: e.authors, placeholder: nb.team.members.slice(0, 2).join(', ') || 'Names of everyone who wrote this', 'data-nb': 'authors', oninput: () => { e.authors = authors.value; saveSoon(); } });
    const ta = h('textarea.nb-body', { value: e.body, rows: 18, 'data-nb': 'body', spellcheck: true,
      oninput: () => { e.body = ta.value; saveSoon(); drawPreview(); drawWords(); } });
    const phaseSel = select(PHASES.map((p) => ({ value: p.id, label: p.label })), e.phase, (v) => {
      const untouched = !e.body.trim() || e.body.trim() === PHASE[e.phase].template.trim();
      e.phase = v;
      if (untouched && !e.amends && !e.auto) { e.body = PHASE[v].template; ta.value = e.body; drawPreview(); drawWords(); toast('Template loaded for ' + PHASE[v].label + '.'); }
      save();
    }, { 'data-nb': 'phase' });

    const attHost = h('div');
    const drawAtts = () => {
      attHost.replaceChildren(...e.attachments.map((a, i) => {
        const cap = h('input.grow', { type: 'text', value: a.caption || '', placeholder: 'Caption: what does this show, and why does it matter?', oninput: () => { a.caption = cap.value; saveSoon(); } });
        return h('div', h('div', { html: attachmentHtml({ ...a, caption: '' }, i + 1) }),
          h('div.nb-attctl', { style: 'margin:-6px 0 12px' }, cap,
            a.type === 'matrix' || a.type === 'testlog' ? h('button.btn.small', { title: 'Copy into the tool to edit, then insert the new version', onclick: () => {
              const { id, type, at, caption, ...rest } = clone(a);
              if (type === 'matrix') tools.matrix = normalizeTools({ matrix: rest }).matrix; else tools.testlog = rest;
              S.set(TOOLS_KEY, tools); flush(); ui.tab = 'tools'; ui.openId = null; render();
              toast('Copied into the tool. Edit it, then insert the new version into the entry.');
            } }, 'Edit copy in tool') : null,
            h('button.btn.small', { onclick: () => { e.attachments.splice(i, 1); save(); drawAtts(); } }, 'Remove')));
      }));
      if (!e.attachments.length) attHost.append(h('div.muted.small', 'No attachments yet. Sketches, screenshots, code and data make an entry far stronger.'));
    };

    const file = h('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none', 'data-nb': 'file', onchange: async () => {
      for (const f of [...file.files]) {
        try {
          const src = await downscale(await readFile(f));
          if (!addAttachment(e, { id: uid(), type: 'image', title: f.name, src, caption: '', at: new Date().toISOString() })) break;
        } catch (err) { toast(err.message); }
      }
      file.value = ''; drawAtts();
    } });

    const capture = async () => {
      try {
        const shot = await app.captureScreenshot?.();
        if (!shot) { toast('The field view is not available to capture right now.'); return; }
        const src = await downscale(shot);
        if (addAttachment(e, { id: uid(), type: 'image', title: 'Field screenshot', src, caption: '', at: new Date().toISOString() })) drawAtts();
      } catch (err) { toast('Screenshot failed: ' + (err?.message || 'unknown error')); }
    };
    const snapCode = () => {
      const c = app.getCurrentCode?.();
      if (!c || !String(c.python || '').trim()) { toast('There is no program to snapshot yet. Write some code first.'); return; }
      if (addAttachment(e, { id: uid(), type: 'code', title: `${c.name || 'Program'} (${c.mode === 'blocks' ? 'blocks, shown as Python' : 'Python'})`, code: String(c.python), caption: '', at: new Date().toISOString() })) drawAtts();
    };
    const snapRobot = () => {
      const r = app.getRobotSummary?.();
      if (!r || !(r.text || r.name)) { toast('There is no robot build to snapshot yet.'); return; }
      if (addAttachment(e, { id: uid(), type: 'robot', title: r.name || 'Robot', text: String(r.text || ''), caption: '', at: new Date().toISOString() })) drawAtts();
    };
    const fromTool = (kind) => {
      const att = toolAttachment(kind);
      if (!att) { flush(); ui.tab = 'tools'; ui.openId = null; render(); toast(kind === 'matrix' ? 'Fill in the decision matrix first, then press "Insert into entry".' : 'Record some trials in the test log first, then press "Insert into entry".'); return; }
      if (addAttachment(e, att)) drawAtts();
    };

    const signedBy = h('input', { type: 'text', value: e.signedBy, placeholder: 'Your full name', 'data-nb': 'signedBy', oninput: () => { e.signedBy = signedBy.value; saveSoon(); } });
    const witnessedBy = h('input', { type: 'text', value: e.witnessedBy, placeholder: 'A teammate or mentor who read this page', 'data-nb': 'witnessedBy', oninput: () => { e.witnessedBy = witnessedBy.value; saveSoon(); } });
    const sign = async () => {
      flush();
      const problems = [];
      if (!e.title.trim()) problems.push('Give the entry a title.');
      if (!splitNames(e.authors).length) problems.push('List the authors.');
      if (!e.signedBy.trim()) problems.push('Type your name in "Signed by".');
      if (needsAnalysis(e)) problems.push(`This entry was auto-captured. Add your own analysis (at least ${AUTO_MIN_WORDS} words) explaining what happened and what you will do next.`);
      else if (studentWords(e) < 5 && !e.attachments.length) problems.push('The page is still empty. Answer the prompts in your own words.');
      if (problems.length) { await modal('Not ready to sign yet', h('ul', problems.map((p) => h('li', p))), [{ label: 'OK', value: true, cls: 'primary' }]); return; }
      const notes = [];
      if (!e.witnessedBy.trim()) notes.push('No witness is recorded. Judges value a witness signature, and you cannot add one after locking.');
      else if (e.witnessedBy.trim().toLowerCase() === e.signedBy.trim().toLowerCase()) notes.push('The witness should be a different person from the signer.');
      const ok = await modal(`Sign and lock page ${e.page}?`, h('div.col',
        h('p', 'After signing, this page can never be edited or deleted. Corrections must be made with an amendment entry. Unanswered grey prompt lines will be removed.'),
        notes.map((n) => h('p', { style: 'color:#f7da7c' }, n))),
      [{ label: 'Keep editing', value: false }, { label: 'Sign and lock', value: true, cls: 'good' }]);
      if (!ok) return;
      e.title = e.title.trim(); e.signedBy = e.signedBy.trim(); e.witnessedBy = e.witnessedBy.trim();
      if (e.auto && e.autoText && e.body.startsWith(e.autoText)) { const rest = stripHints(e.body.slice(e.autoText.length)); e.body = e.autoText + (rest ? '\n\n' + rest : ''); } else e.body = stripHints(e.body);
      e.signedAt = new Date().toISOString();
      save(); render();
      toast(`Page ${e.page} signed and locked.`);
    };
    const del = async () => {
      const ok = await confirmBox(`Delete draft page ${e.page}?`, `The draft is removed, but page number ${e.page} is never reused: it will be listed as "voided" in the table of contents, the same way a real notebook shows a crossed-out page.`, 'Delete draft', 'danger');
      if (!ok) return;
      clearTimeout(saveTimer); saveTimer = null;
      nb.entries = nb.entries.filter((x) => x.id !== e.id);
      nb.voided.push({ page: e.page, date: new Date().toISOString(), title: e.title });
      save(); ui.openId = null; render();
    };

    drawAtts(); drawPreview(); drawWords();
    const root = h('div.col',
      h('div.row', entryHeader(e), h('div.nb-spacer'), h('button.btn.small', { 'data-act': 'delete', onclick: del }, 'Delete draft')),
      inkRule(),
      amendLinks(e),
      needsAnalysis(e) ? h('div.nb-rule', h('strong', 'Auto-captured from the simulator. '), 'The data below was recorded for you, but judges only credit your own thinking. Under "My analysis" explain what happened, why, and what you will do next. You cannot sign until you do.') : null,
      h('div.grid2', field('Title', title), field('Design-process phase', phaseSel)),
      field('Authors (everyone who contributed to this page)', authors),
      h('div.row', h('span.muted.small', 'Entry text'), h('div.nb-spacer'), wordsEl,
        h('button.btn.small', { title: 'Append the guiding prompts for the selected phase', onclick: () => {
          e.body = (e.body.trimEnd() ? e.body.trimEnd() + '\n\n' : '') + PHASE[e.phase].template; ta.value = e.body; save(); drawPreview(); drawWords();
        } }, 'Insert template prompts'),
        h('button.btn.small', { 'data-act': 'preview', onclick: (ev) => { ui.preview = !ui.preview; preview.style.display = ui.preview ? '' : 'none'; ev.currentTarget.classList.toggle('active', ui.preview); drawPreview(); } }, 'Preview')),
      ta,
      h('div.muted.small', 'Formatting: blank line = new paragraph, **bold**, `code`, lines starting with "- " are bullets, "## " is a heading. Lines starting with ">" are prompts for you: answer them underneath; they are removed when you sign.'),
      preview,
      h('h3', { style: 'margin-top:8px' }, 'Attachments'),
      h('div.row',
        h('button.btn.small', { onclick: () => file.click() }, 'Upload image / sketch'), file,
        h('button.btn.small', { 'data-act': 'capture', onclick: capture }, 'Capture field screenshot'),
        h('button.btn.small', { 'data-act': 'snapcode', onclick: snapCode }, 'Snapshot current code'),
        h('button.btn.small', { 'data-act': 'snaprobot', onclick: snapRobot }, 'Snapshot robot build'),
        h('button.btn.small', { 'data-act': 'ins-matrix', onclick: () => fromTool('matrix') }, 'Insert decision matrix'),
        h('button.btn.small', { 'data-act': 'ins-testlog', onclick: () => fromTool('testlog') }, 'Insert test log')),
      attHost,
      h('div.card.col',
        h('h3', 'Sign and lock'),
        h('div.grid2', field('Signed by (author)', signedBy), field('Witnessed by (someone who read and understood it)', witnessedBy)),
        h('div.row', h('button.btn.good', { 'data-act': 'sign', onclick: sign }, 'Sign and lock this page'),
          h('span.muted.small', 'Sign at the end of the work session. Signing records the date and time and makes the page read-only.'))));
    return root;
  }

  /* ---------- Tools: decision matrix + test log ---------- */
  function toolAttachment(kind) {
    if (kind === 'matrix') {
      const m = tools.matrix;
      const named = m.options.filter((o) => String(o).trim()).length >= 2 && m.criteria.filter((c) => String(c.name).trim()).length >= 1;
      if (!named || !matrixTotals(m).winners.length) return null;
      return { id: uid(), type: 'matrix', at: new Date().toISOString(), caption: '', ...clone(m), title: m.title || 'Decision matrix' };
    }
    const t = tools.testlog;
    const rows = t.rows.filter((r) => String(r.setup || '').trim() || String(r.result ?? '').trim() || String(r.notes || '').trim());
    if (!rows.length) return null;
    return { id: uid(), type: 'testlog', at: new Date().toISOString(), caption: '', ...clone(t), rows: clone(rows), title: t.title || 'Test log' };
  }

  function insertRow(kind) {
    const ds = drafts();
    const phase = kind === 'matrix' ? 'select' : 'test';
    let target = ds[0]?.id || 'new';
    const pick = select([...ds.map((e) => ({ value: e.id, label: `Draft p.${e.page}: ${e.title || 'Untitled'} (${PHASE[e.phase].label})` })),
      { value: 'new', label: `New ${PHASE[phase].label} entry` }], target, (v) => { target = v; }, { 'data-nb': kind + '-target', style: 'max-width:320px' });
    return h('div.row', h('span.muted.small', 'Insert into:'), pick,
      h('button.btn.primary', { 'data-act': 'insert-' + kind, onclick: () => {
        const att = toolAttachment(kind);
        if (!att) { toast(kind === 'matrix' ? 'Name at least two options and one criterion, and enter some scores first.' : 'Record at least one trial first.'); return; }
        const created = target === 'new';
        const e = created ? addEntry({ phase }) : getEntry(target);
        if (!e || e.signedAt) { toast('That entry is no longer a draft. Pick another.'); render(); return; }
        if (addAttachment(e, att)) open(e.id);
        else if (created) { nb.entries = nb.entries.filter((x) => x.id !== e.id); nb.nextPage -= 1; save(); }
      } }, 'Insert into entry'));
  }

  function matrixCard() {
    const m = tools.matrix;
    const host = h('div.scroll');
    const result = h('div.small');
    const totalCells = [];
    const updateTotals = () => {
      const { totals, winners, maxPossible } = matrixTotals(m);
      totalCells.forEach((td, i) => { td.textContent = round2(totals[i]) + (winners.includes(i) ? ' ★' : ''); td.classList.toggle('nb-win', winners.includes(i)); });
      result.textContent = winners.length
        ? `Winner: ${winners.map((i) => m.options[i] || 'Option ' + (i + 1)).join(' / ')}${winners.length > 1 ? ' (tie — add a criterion or adjust weights to break it)' : ''} with ${round2(totals[winners[0]])} of ${maxPossible} possible.`
        : 'Enter scores from 1 (poor) to 5 (excellent). Totals are score × weight, added up for each option.';
    };
    const draw = () => {
      totalCells.length = 0;
      const numIn = (value, min, max, on) => { const i = h('input', { type: 'number', min, max, step: 1, value, oninput: () => { on(Math.max(min, Math.min(max, Number(i.value) || 0))); updateTotals(); saveTools(); } }); return i; };
      host.replaceChildren(h('table.nb-mx',
        h('thead', h('tr', h('th', 'Criterion'), h('th', { title: 'How important is this criterion? 1 = minor, 5 = critical' }, 'Weight (1–5)'),
          m.options.map((o, oi) => { const i = h('input', { type: 'text', value: o, placeholder: 'Option ' + (oi + 1), 'data-nb': 'mx-opt', oninput: () => { m.options[oi] = i.value; updateTotals(); saveTools(); } });
            return h('th', h('div.row', { style: 'flex-wrap:nowrap;gap:2px' }, i, m.options.length > 2 ? h('button.nb-x', { title: 'Remove option', onclick: () => { m.options.splice(oi, 1); m.scores.forEach((r) => r.splice(oi, 1)); saveTools(); draw(); } }, '×') : null)); }),
          h('th'))),
        h('tbody',
          m.criteria.map((c, ci) => { const i = h('input', { type: 'text', value: c.name, placeholder: ['e.g. Scoring speed', 'e.g. Build difficulty', 'e.g. Reliability'][ci % 3], 'data-nb': 'mx-crit', oninput: () => { c.name = i.value; saveTools(); } });
            return h('tr', h('td', i), h('td', numIn(c.weight, 1, 5, (v) => { c.weight = v; })),
              m.options.map((_, oi) => h('td', numIn(m.scores[ci][oi], 0, 5, (v) => { m.scores[ci][oi] = v; }))),
              h('td', m.criteria.length > 1 ? h('button.nb-x', { title: 'Remove criterion', onclick: () => { m.criteria.splice(ci, 1); m.scores.splice(ci, 1); saveTools(); draw(); } }, '×') : null)); }),
          h('tr.nb-total', h('td', 'Weighted total'), h('td'), m.options.map(() => { const td = h('td'); totalCells.push(td); return td; }), h('td')))));
      updateTotals();
    };
    const title = h('input.grow', { type: 'text', value: m.title, placeholder: 'What is being decided? e.g. Intake mechanism', oninput: () => { m.title = title.value; saveTools(); } });
    draw();
    return h('div.card.col', { 'data-nb': 'matrix' },
      h('h3', 'Decision matrix'),
      h('p.muted.small', 'List the options from your brainstorm as columns and the criteria that matter as rows. Give each criterion a weight, score every option against every criterion, and let the totals show which option best meets your goals. In the entry, explain why you chose each weight.'),
      field('Decision', title), host,
      h('div.row',
        h('button.btn.small', { 'data-act': 'add-crit', onclick: () => { m.criteria.push({ name: '', weight: 3 }); m.scores.push(m.options.map(() => 0)); saveTools(); draw(); } }, '+ Criterion'),
        h('button.btn.small', { 'data-act': 'add-opt', onclick: () => { m.options.push(''); m.scores.forEach((r) => r.push(0)); saveTools(); draw(); } }, '+ Option'),
        h('button.btn.small', { onclick: async () => { if (await confirmBox('Clear the decision matrix?', 'This empties the working matrix. Matrices already inserted into entries are not affected.', 'Clear')) { tools.matrix = blankMatrix(); S.set(TOOLS_KEY, tools); render(); } } }, 'Clear')),
      result, insertRow('matrix'));
  }

  function testlogCard() {
    const t = tools.testlog;
    const host = h('div.scroll');
    const stats = h('div.small');
    const updateStats = () => {
      const st = testStats(t);
      stats.textContent = st ? `Numeric trials: ${st.n}  ·  Mean: ${st.mean}  ·  Best: ${st.best}  ·  Worst: ${st.worst}  ·  Range: ${st.range}${st.n < 3 ? '   (run at least 3 trials before drawing a conclusion)' : ''}`
        : 'Results that start with a number are averaged automatically.';
    };
    const draw = () => {
      host.replaceChildren(h('table.nb-mx',
        h('thead', h('tr', h('th', { style: 'width:52px' }, 'Trial'), h('th', 'Setup / variable changed'), h('th', { style: 'width:120px' }, 'Result'), h('th', 'Notes / observations'), h('th'))),
        h('tbody', t.rows.map((r, i) => {
          const cell = (key, ph) => { const inp = h('input', { type: 'text', value: r[key] ?? '', placeholder: ph, 'data-nb': 'tl-' + key, oninput: () => { r[key] = inp.value; updateStats(); saveTools(); } }); return h('td', inp); };
          return h('tr', h('td', i + 1), cell('setup', i ? '' : 'e.g. drive speed 60%'), cell('result', i ? '' : 'e.g. 12'), cell('notes', i ? '' : 'e.g. drifted left on turn 2'),
            h('td', h('button.nb-x', { title: 'Remove trial', onclick: () => { t.rows.splice(i, 1); if (!t.rows.length) t.rows.push({ setup: '', result: '', notes: '' }); saveTools(); draw(); } }, '×')));
        }))));
      updateStats();
    };
    const title = h('input', { type: 'text', value: t.title, placeholder: 'e.g. Autonomous route consistency', oninput: () => { t.title = title.value; saveTools(); } });
    const metric = h('input', { type: 'text', value: t.metric, placeholder: 'e.g. points, seconds, cm', oninput: () => { t.metric = metric.value; saveTools(); } });
    const importRun = () => {
      const run = app.getLastRun?.();
      if (!run) { toast('No simulator run to import yet. Run a program or challenge first.'); return; }
      const row = {
        setup: String(run.challenge || 'Simulator run'), result: String(run.score ?? ''),
        notes: [run.stars != null ? `${run.stars} star${run.stars === 1 ? '' : 's'}` : '', run.time != null ? `time ${typeof run.time === 'number' ? round2(run.time) + ' s' : run.time}` : '',
          run.details ? (typeof run.details === 'string' ? run.details : JSON.stringify(run.details)) : ''].filter(Boolean).join('; '),
      };
      const empty = t.rows.findIndex((r) => !String(r.setup || '').trim() && !String(r.result ?? '').trim() && !String(r.notes || '').trim());
      if (empty >= 0) t.rows[empty] = row; else t.rows.push(row);
      if (!t.metric) t.metric = 'score';
      S.set(TOOLS_KEY, tools); render();
      toast('Last run added as a trial. Add what you changed for this run in the Setup column.');
    };
    draw();
    return h('div.card.col', { 'data-nb': 'testlog' },
      h('h3', 'Test log'),
      h('p.muted.small', 'Change one variable at a time, keep everything else the same, and repeat each setup at least three times. Record every trial, including the bad ones.'),
      h('div.grid2', field('What is being tested', title), field('Result is measured in', metric)),
      h('label', { style: 'flex-direction:row;align-items:center;gap:6px' },
        h('input', { type: 'checkbox', checked: t.higherBetter !== false, onchange: (ev) => { t.higherBetter = ev.target.checked; updateStats(); saveTools(); } }), 'A higher result is better (untick for times or errors)'),
      host,
      h('div.row',
        h('button.btn.small', { 'data-act': 'add-trial', onclick: () => { t.rows.push({ setup: '', result: '', notes: '' }); saveTools(); draw(); } }, '+ Trial'),
        h('button.btn.small', { 'data-act': 'import-run', onclick: importRun }, 'Import last simulator run'),
        h('button.btn.small', { onclick: async () => { if (await confirmBox('Clear the test log?', 'This empties the working log. Logs already inserted into entries are not affected.', 'Clear')) { tools.testlog = blankTestlog(); S.set(TOOLS_KEY, tools); render(); } } }, 'Clear')),
      stats, insertRow('testlog'));
  }

  const viewTools = () => h('div.col', matrixCard(), testlogCard());

  /* ---------- Plan: goals timeline + design-cycle tracker ---------- */
  function viewPlan() {
    const today = dayKey(new Date().toISOString());
    const ganttHost = h('div');
    const toDate = (s) => new Date(s + 'T00:00');
    const drawGantt = () => {
      const dated = nb.goals.filter((g) => g.due || g.start);
      if (!dated.length) { ganttHost.replaceChildren(h('div.muted.small', 'Add a goal with a due date to see it on the timeline.')); return; }
      const times = dated.flatMap((g) => [g.start, g.due].filter(Boolean)).map((s) => toDate(s).getTime());
      let min = Math.min(...times, toDate(today).getTime()), max = Math.max(...times, toDate(today).getTime());
      const padMs = Math.max((max - min) * 0.04, 86400000);
      min -= padMs; max += padMs;
      const pct = (ms) => ((ms - min) / (max - min)) * 100;
      const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => new Date(min + f * (max - min)));
      const wrap = h('div.nb-gantt',
        h('div.nb-gaxis', ticks.map((d, i) => h('span', { style: i === 4 ? 'right:0' : `left:${i * 25}%` + (i ? ';transform:translateX(-50%)' : '') }, d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })))),
        dated.map((g) => {
          const s = toDate(g.start || g.due).getTime(), e = toDate(g.due || g.start).getTime() + 86400000;
          const late = g.status !== 'Done' && g.due && g.due < today;
          const cls = g.status === 'Done' ? 'done' : g.status === 'Blocked' ? 'blocked' : late ? 'late' : g.status === 'Not started' ? 'todo' : '';
          return h('div.nb-grow', h('div.nb-glabel', { title: g.title }, g.title || 'Untitled goal'),
            h('div.nb-gtrack', h('div.nb-gbar' + (cls ? '.' + cls : ''), { title: `${g.title || 'Goal'}: ${g.start || '?'} to ${g.due || '?'} — ${g.status}${late ? ' (overdue)' : ''}`,
              style: `left:${pct(Math.min(s, e))}%;width:${Math.max(0.8, pct(Math.max(s, e)) - pct(Math.min(s, e)))}%` })));
        }));
      const line = h('div.nb-today', { title: 'Today' });
      wrap.append(line);
      ganttHost.replaceChildren(wrap, h('div.row.small.muted', { style: 'margin-top:6px' },
        h('span.tag', 'grey: not started'), h('span.tag.blue', 'blue: in progress'), h('span.tag.green', 'green: done'), h('span.tag.red', 'red: blocked or overdue'), h('span.tag.yellow', 'dashed line: today')));
      // Position the "today" marker relative to the track column (label column is 150px + 8px gap + 10px padding).
      line.style.left = `calc(168px + (100% - 178px) * ${pct(toDate(today).getTime() + 43200000) / 100})`;
    };
    const rowsHost = h('tbody');
    const drawRows = () => {
      rowsHost.replaceChildren(...nb.goals.map((g, i) => {
        const inp = (key, type, ph) => { const el2 = h('input', { type, value: g[key] || '', placeholder: ph || '', style: type === 'text' ? 'width:100%' : '', 'data-nb': 'goal-' + key, oninput: () => { g[key] = el2.value; saveSoon(); if (type === 'date') drawGantt(); }, onchange: () => drawGantt() }); return h('td', el2); };
        return h('tr', inp('title', 'text', 'e.g. Autonomous scores 3 rings'), inp('owner', 'text', 'Who'), inp('start', 'date'), inp('due', 'date'),
          h('td', select(GOAL_STATUS, g.status, (v) => { g.status = v; save(); drawGantt(); })),
          h('td', h('button.nb-x', { title: 'Remove goal', onclick: () => { nb.goals.splice(i, 1); save(); drawRows(); drawGantt(); } }, '×')));
      }));
      if (!nb.goals.length) rowsHost.append(h('tr', h('td.muted', { colSpan: 6 }, 'No goals yet. Break the season into goals with due dates: first prototype, first full autonomous, skills run target, notebook review.')));
    };
    drawRows(); drawGantt();

    const E = nb.entries, c = cycleProgress(E), maxCount = Math.max(1, ...PHASES.map((p) => E.filter((e) => e.phase === p.id).length));
    return h('div.col',
      h('div.card.col',
        h('h3', 'Project timeline'),
        h('p.muted.small', 'Judges look for evidence that the team managed its time. Set goals with owners and due dates, keep the status current, and refer to this plan in your Team / Project Management entries.'),
        h('div.scroll', h('table.nb-mx', h('thead', h('tr', ['Goal', 'Owner', 'Start', 'Due', 'Status', ''].map((x) => h('th', x)))), rowsHost)),
        h('div.row', h('button.btn.small', { 'data-act': 'add-goal', onclick: () => { nb.goals.push({ id: uid(), title: '', owner: '', start: today, due: '', status: GOAL_STATUS[0] }); save(); drawRows(); drawGantt(); } }, '+ Goal')),
        ganttHost),
      h('div.card.col',
        h('h3', 'Design cycle tracker'),
        h('p.muted.small', 'The engineering design process is a loop. A loop counts as documented when the notebook has, in page order: Identify, Brainstorm, Select, Build or Program, Test, then Reflect. Expert-level notebooks show the loop repeated.'),
        h('div', { style: 'font-size:15px' }, h('strong', { 'data-nb': 'loops' }, String(c.loops)), ` complete loop${c.loops === 1 ? '' : 's'} documented`),
        h('div.nb-steps', STAGE_NAMES.map((n, i) => h('span.nb-step' + (i < c.next ? '.done' : i === c.next ? '.next' : ''), (i < c.next ? '✓ ' : '') + n))),
        h('div.muted.small', `Current loop: next entry needed is ${STAGE_NAMES[c.next]}.`),
        h('div', { style: 'margin-top:8px' }, PHASES.map((p) => { const n = E.filter((e) => e.phase === p.id).length;
          return h('div.nb-cyc', h('span', p.label), h('div', h('div.nb-bar', { style: `width:${(n / maxCount) * 100}%;opacity:${n ? 1 : 0.25}` })), h('span', { style: 'text-align:right' }, n)); }))));
  }

  /* ---------- Rubric self-check ---------- */
  function viewRubric() {
    const items = rubricCheck(nb);
    const counts = [0, 1, 2, 3].map((l) => items.filter((i) => i.level === l).length);
    return h('div.col',
      h('div.nb-rule', h('strong', 'Self-check only — not an official score. '),
        'This panel estimates where your notebook stands on the judged criteria of the RECF Engineering Notebook Rubric by counting what is actually in your entries (words you wrote, matrices, test data, images, signatures, dates). It cannot judge the quality of your reasoning; real judges read every page. Use it to find gaps, and always check the current official rubric from the RECF.'),
      h('div.row', h('span.tag.green', `${counts[3]} Expert`), h('span.tag.yellow', `${counts[2]} Proficient`), h('span.tag.red', `${counts[1]} Emerging`), h('span.tag', `${counts[0]} Not started`)),
      items.map((it) => h('div.card.col', { 'data-level': it.level },
        h('div.row', h('strong.grow', it.name),
          h('div.nb-lvl', [1, 2, 3].map((l) => h('span' + (it.level === l ? '.on' + l : ''), LEVELS[l])))),
        h('div.small.muted', 'Evidence found: ' + it.evidence),
        h('div.small', h('strong', it.level === 3 ? 'Keep going: ' : `To reach ${LEVELS[it.level + 1]}: `), it.tip))));
  }

  /* ---------- Team info ---------- */
  function viewTeam() {
    const t = nb.team;
    const inp = (key, ph) => { const i = h('input', { type: 'text', value: t[key], placeholder: ph, 'data-nb': 'team-' + key, oninput: () => { t[key] = i.value; saveSoon(); }, onchange: () => { save(); renderHead(); } }); return i; };
    const members = h('textarea', { rows: 6, value: t.members.join('\n'), placeholder: 'One name per line. Add roles if you like, e.g. "Sam Lee — programmer"', 'data-nb': 'team-members',
      oninput: () => { t.members = members.value.split('\n').map((s) => s.trim()).filter(Boolean); saveSoon(); } });
    return h('div.col', { style: 'max-width:640px' },
      h('div.card.col',
        h('h3', 'Team information'),
        h('p.muted.small', 'This appears on the cover page of the printed notebook and in every page header.'),
        h('div.grid2', field('Team number', inp('number', 'e.g. 1234A')), field('Team name', inp('name', 'e.g. Gear Grinders'))),
        field('School / organization', inp('school', 'e.g. Lincoln Middle School')),
        field('Team members', members)),
      h('div.card.col',
        h('h3', 'Backup'),
        h('p.muted.small', 'The notebook is stored in this browser on this computer. Export a JSON backup regularly, and before switching computers. Import replaces the current notebook with a backup.'),
        h('div.row', h('button.btn', { onclick: exportJson }, 'Export JSON'), h('button.btn', { onclick: importJson }, 'Import JSON'), h('button.btn', { onclick: printNotebook }, 'Print / Save as PDF'))));
  }

  /* ---------- auto-capture from the simulator ---------- */
  async function onLog(p) {
    if (!p || typeof p !== 'object') return;
    const phase = phaseId(p.phase);
    const autoText = String(p.body || '').trim();
    const attachments = [];
    const now = new Date().toISOString();
    if (p.code) {
      const c = typeof p.code === 'string' ? { python: p.code } : p.code;
      const src = String(c.python ?? c.code ?? '');
      if (src.trim()) attachments.push({ id: uid(), type: 'code', title: `${c.name || 'Program'}${c.mode ? ` (${c.mode === 'blocks' ? 'blocks, shown as Python' : 'Python'})` : ''}`, code: src, caption: '', at: now });
    }
    if (p.data != null) { const a = dataToAttachment(p.data, 'Simulator data'); if (a) attachments.push(a); }
    if (p.image) {
      try { attachments.push({ id: uid(), type: 'image', title: 'Field screenshot', src: await downscale(String(p.image)), caption: '', at: now }); } catch { /* skip an unreadable image */ }
    }
    const e = addEntry({
      phase, title: String(p.title || 'Simulator capture'), auto: true, autoText,
      body: `${autoText}\n\n## My analysis\n> Auto-captured from the simulator. Before signing, explain in your own words: what happened, why it happened, and what you will do next.\n`,
      attachments,
    });
    if (S.get(KEY, null)?.rev !== nb.rev) { // storage full: retry without the image
      e.attachments = e.attachments.filter((a) => a.type !== 'image');
      save();
    }
    if (ui.tab === 'contents' && !ui.openId) render(); else renderHead();
    toast(`Notebook: draft page ${e.page} auto-captured. Add your analysis before signing.`);
  }

  const off = B.on('notebook:log', (p) => { onLog(p).catch((err) => console.error('notebook:log', err)); });
  const onUnload = () => flush();
  window.addEventListener('beforeunload', onUnload);
  const destroy = () => { flush(); off?.(); window.removeEventListener('beforeunload', onUnload); if (disposePrevious === destroy) disposePrevious = null; };
  disposePrevious = destroy;

  render();
  return {
    refresh: () => { clearTimeout(saveTimer); saveTimer = null; nb = normalize(S.get(KEY, null)); tools = normalizeTools(S.get(TOOLS_KEY, null)); render(); },
    openEntry: open,
    addEntry: (fields) => { const e = addEntry(fields); if (ui.tab === 'contents' && !ui.openId) render(); else renderHead(); return e.id; },
    destroy,
  };
}

export default mountNotebook;
