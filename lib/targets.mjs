import fs from 'node:fs';
import path from 'node:path';

import { readDir } from './content.mjs';

/**
 * Rotation, selection, and the brief.
 *
 * All of this is deliberately ordinary code. Same inputs, same output, no model
 * involved. The judgement half of the pipeline is a separate step run by a
 * person or by an agent a person started, and keeping the boundary sharp is
 * what makes the pipeline auditable.
 */

export function loadTargets(config) {
  const file = path.join(config.root, config.pipeline.targets);
  if (!fs.existsSync(file)) {
    throw new Error(
      `No targets file at ${config.pipeline.targets}. Run "npx content-radar init" or create it.`,
    );
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function saveTargets(config, data) {
  fs.writeFileSync(
    path.join(config.root, config.pipeline.targets),
    `${JSON.stringify(data, null, 2)}\n`,
  );
}

/** Oldest first, never-checked first of all. Only 'open' is in rotation. */
export function nextTarget(targets) {
  const open = targets.filter((t) => t.status === 'open');
  if (open.length === 0) return null;

  return open.sort((a, b) => {
    if (a.lastChecked === b.lastChecked) return 0;
    if (!a.lastChecked) return -1;
    if (!b.lastChecked) return 1;
    return a.lastChecked < b.lastChecked ? -1 : 1;
  })[0];
}

export function claim(config, query, date) {
  const data = loadTargets(config);
  const target = data.targets.find((t) => t.query === query);
  if (!target) return null;
  target.lastChecked = date ?? new Date().toISOString().slice(0, 10);
  saveTargets(config, data);
  return target;
}

export function published(config) {
  const base = `/${path.posix.basename(config.content.articles)}`;
  return readDir(config.root, config.content.articles)
    .filter((e) => !config.frontmatter.draftField || e.front[config.frontmatter.draftField] !== 'true')
    .map((e) => {
      const title = e.front.title ?? e.file;
      const cluster = e.front.cluster ?? '?';
      const description = e.front[config.frontmatter.descriptionField] ?? '';
      return `  - ${title}  [${cluster}]  ${base}/${e.slugFromFile}\n      ${description}`;
    });
}

export function renderBrief(config, target) {
  const clusters = config.content.clusters.map((c) => c.slug).join(' | ');
  const voice = config.pipeline.voice.length > 0 ? config.pipeline.voice.join(', ') : '(none configured)';

  return `TARGET
  query:   ${target.query}
  cluster: ${target.cluster}
  checked: ${target.lastChecked ?? 'never'}
  hunch:   ${target.gap}

${config.brand.name ? `WRITING AS\n  ${config.brand.name}. ${config.brand.positioning}\n` : ''}
ALREADY PUBLISHED, do not duplicate or compete with these
${published(config).join('\n')}

WHAT TO DO
  1. Search the query. Read the top results properly rather than their titles.
  2. Name the specific weakness they share. If they are genuinely good, mark the
     target rejected with the reason and stop. That is a real outcome.
  3. MATCH THE INTENT. The incumbents rank because of their angle, not despite
     it. Somebody searching this query wants the thing those pages give them.
     Serve that, in the shape they expected, and win on the part done badly.
     Same angle, our flavour. An article arguing the whole format is wrong
     answers a question nobody typed and ranks for nothing.
  4. READ ${config.pipeline.knowledge}. Every article must carry at least one
     thing from it. That file holds what this project knows and other sites do
     not, and it is the only reliable difference between a piece worth
     publishing and a competent summary of what already ranks. A draft with
     nothing from it is working from the same public corpus as the pages you
     are trying to beat, and will read like them.
  5. GATHER SOURCES while you research. Any claim about the world, as opposed
     to a judgement or an illustration, needs a real citation with a link in
     the same paragraph. Do not write a statistic you have not seen.
     Judgements are allowed and should read as judgements: "most companies" is
     fine, "73% of companies" needs a source. The check prints every figure an
     article asserts as a review note, and somebody will read that list.
  6. Draft it, in the voice rules in: ${voice}
     TITLE: write the one a person would click, not the one that sounds clever.
     Start from the query. Under fifty characters where you can. No abstraction
     that only makes sense after reading the piece.
  7. Frontmatter needs: ${config.frontmatter.required.join(', ')}${
       config.frontmatter.draftField ? `, and ${config.frontmatter.draftField}: true` : ''
     }.
     ${config.frontmatter.slugField} must match the filename. ${config.frontmatter.descriptionField} is ${config.frontmatter.descriptionLength[0]} to ${config.frontmatter.descriptionLength[1]} characters.
     Cluster is one of: ${clusters || '(none configured)'}
  8. Link one sibling in the same cluster and one commercial page, or the
     check fails.
  9. Run: ${config.pipeline.checkCommand}
 10. npx content-radar claim "${target.query}"
 11. Open a pull request. Do not merge it.

THE RULE THAT MATTERS MOST${
    config.frontmatter.draftField
      ? `\n  ${config.frontmatter.draftField}: true is not a formality. Nothing publishes without a
  person reading it, because an article is a claim made in the project's name
  and a pipeline cannot be accountable for one.`
      : `\n  Nothing here should publish without a person reading it. This config has no
  draft field set, which means that is enforced by review alone.`
  }`;
}

export const NOTHING_DUE = `NOTHING DUE

Every target is done or rejected. That is a finished work list rather than a
broken radar. Add one when you find a query whose current top results are weak
in a way this project can specifically beat.`;
