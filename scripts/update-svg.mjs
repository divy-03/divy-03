#!/usr/bin/env node
// Refreshes the dynamic values in the profile README SVG (replaces the n8n workflow in WORKFLOW.md).
//
// Usage: node scripts/update-svg.mjs [svg-path]    (defaults to dark_mode.svg)
// Env:   GITHUB_TOKEN  optional, raises the GitHub API rate limit (Actions provides it)
//
// Each data source returns { svgKey: value }. A source that fails keeps its old values in the SVG,
// the others are still written, and the script exits non-zero so the workflow run is marked failed.

import { readFile, writeFile } from 'node:fs/promises';

const CONFIG = {
  githubUser: 'divy-03',
  monkeytypeUser: 'divy03',
  birthDate: '2003-12-03',
  timeZone: 'Asia/Kolkata',
  resumeUrl: 'https://raw.githubusercontent.com/divy-03/Resume/main/resume.tex',
};

async function get(url, headers = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': `${CONFIG.githubUser}-readme-updater`, ...headers },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${url}`);
  return res;
}

// Public repos owned by the user, same list the n8n "Get a user's repositories" node returned.
async function githubStats() {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const repos = [];
  for (let page = 1; ; page++) {
    const url = `https://api.github.com/users/${CONFIG.githubUser}/repos?per_page=100&page=${page}`;
    const batch = await (await get(url, headers)).json();
    repos.push(...batch);
    if (batch.length < 100) break;
  }

  const sum = (field) => repos.reduce((total, repo) => total + repo[field], 0);
  return {
    Repos: repos.length,
    Contributed: repos.filter((repo) => repo.fork).length,
    Issues: sum('open_issues_count'), // GitHub counts open PRs here too
    Stars: sum('stargazers_count'),
  };
}

// Highest personal best across every Monkeytype mode (time 15/30/60/120, words 10/25/50/100, ...).
async function typingSpeed() {
  const url = `https://api.monkeytype.com/users/${CONFIG.monkeytypeUser}/profile`;
  const { data } = await (await get(url)).json();
  // personalBests looks like { time: { "15": [pb, ...], "60": [...] }, words: { "10": [...] } }
  const wpms = Object.values(data.personalBests ?? {})
    .flatMap((byLength) => Object.values(byLength).flat())
    .map((pb) => pb.wpm);
  if (!wpms.length) throw new Error(`no personal bests on Monkeytype profile "${CONFIG.monkeytypeUser}"`);
  return { Speed: `${Math.floor(Math.max(...wpms))} WPM` };
}

// Age as "Y years, M months, D days", where D counts from the last monthly birthday.
function uptime(now = new Date()) {
  // The runner is on UTC; use the calendar date in CONFIG.timeZone.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.timeZone }).format(now);
  const [ty, tm, td] = today.split('-').map(Number);
  const [by, bm, bd] = CONFIG.birthDate.split('-').map(Number);

  let months = (ty - by) * 12 + (tm - bm);
  if (td < bd) months--;

  // Last monthly birthday, clamped to the month's length (a 31st birthday falls on Feb 28/29).
  const anchorYear = by + Math.floor((bm - 1 + months) / 12);
  const anchorMonth = (bm - 1 + months) % 12;
  const anchorDay = Math.min(bd, new Date(Date.UTC(anchorYear, anchorMonth + 1, 0)).getUTCDate());
  const days = (Date.UTC(ty, tm - 1, td) - Date.UTC(anchorYear, anchorMonth, anchorDay)) / 86_400_000;

  return { Uptime: `${Math.floor(months / 12)} years, ${months % 12} months, ${days} days` };
}

// "Languages:" line from the resume's LaTeX source, e.g. "C++, JavaScript, TypeScript, Python".
async function resumeLanguages() {
  const tex = await (await get(CONFIG.resumeUrl)).text();
  const match = tex.match(/\\textbf\{Languages:\}(.+)/);
  if (!match) throw new Error(`no "\\textbf{Languages:}" line in ${CONFIG.resumeUrl}`);
  return { Programming: match[1].replace(/\\([#&%$_{}])/g, '$1').trim() };
}

const escapeXml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Replaces VALUE in: class="keyColor">KEY</tspan>: <tspan class="valueColor">VALUE</tspan>
function setValue(svg, key, value) {
  const pattern = new RegExp(`(class="keyColor">${key}</tspan>: <tspan class="valueColor">)[^<]*(</tspan>)`, 'g');
  const count = svg.match(pattern)?.length ?? 0;
  if (count !== 1) throw new Error(`expected one "${key}" value in the SVG, found ${count}`);
  return svg.replace(pattern, (_, open, close) => open + escapeXml(String(value)) + close);
}

const svgPath = process.argv[2] ?? 'dark_mode.svg';
const sources = {
  'GitHub stats': githubStats,
  Monkeytype: typingSpeed,
  Resume: resumeLanguages,
  Uptime: uptime,
};

const results = await Promise.allSettled(Object.values(sources).map(async (source) => source()));
let svg = await readFile(svgPath, 'utf8');
let failed = false;

Object.keys(sources).forEach((name, i) => {
  const result = results[i];
  if (result.status === 'rejected') {
    failed = true;
    // "::error::" becomes an annotation on the GitHub Actions run summary.
    console.log(`::error::${name} failed, keeping its old values: ${result.reason?.message ?? result.reason}`);
    return;
  }
  for (const [key, value] of Object.entries(result.value)) {
    svg = setValue(svg, key, value);
    console.log(`${key}: ${value}`);
  }
});

await writeFile(svgPath, svg);
if (failed) process.exitCode = 1;
