import fs from 'node:fs';
import path from 'node:path';

import { internalLinks, prose, readDir, unquotedColons, wordCount } from './content.mjs';

/**
 * The quality floor.
 *
 * Every rule here exists because something specific got shipped once. They are
 * cheap, they run in under a second, and they are the reason a drafting step
 * cannot quietly lower the standard: a prompt can be ignored, a failing build
 * cannot.
 *
 * Two kinds of output. `errors` fail the run. `notes` do not, and are for the
 * things a machine can find but only a person can judge, chiefly every figure
 * an article asserts.
 */

const AMERICANISMS = [
  ['optimize', 'optimise'], ['optimized', 'optimised'], ['optimizing', 'optimising'],
  ['organize', 'organise'], ['organized', 'organised'], ['organization', 'organisation'],
  ['prioritize', 'prioritise'], ['prioritized', 'prioritised'], ['prioritization', 'prioritisation'],
  ['realize', 'realise'], ['recognize', 'recognise'], ['summarize', 'summarise'],
  ['analyze', 'analyse'], ['analyzing', 'analysing'], ['behavior', 'behaviour'],
  ['color', 'colour'], ['favor', 'favour'], ['labor', 'labour'], ['honor', 'honour'],
  ['center', 'centre'], ['fiber', 'fibre'], ['meter', 'metre'], ['license', 'licence'],
  ['defense', 'defence'], ['offense', 'offence'], ['practise', 'practice'],
  ['fulfill', 'fulfil'], ['enroll', 'enrol'], ['skillful', 'skilful'],
  ['traveling', 'travelling'], ['modeling', 'modelling'], ['canceled', 'cancelled'],
  ['catalog', 'catalogue'], ['dialog', 'dialogue'], ['gray', 'grey'],
];

const STAT = /(\d+(?:\.\d+)?\s?%|[£$€]\s?\d[\d,]*(?:\.\d+)?(?:[kmb]\b|\s?(?:million|billion))?)/gi;

function word(w) {
  return new RegExp(`\\b${w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
}

export function check(config) {
  const errors = [];
  const notes = [];

  const articles = readDir(config.root, config.content.articles).map((e) => ({
    ...e,
    isArticle: true,
  }));
  const others = config.content.also.flatMap((dir) =>
    readDir(config.root, dir).map((e) => ({ ...e, isArticle: false })),
  );
  const all = [...articles, ...others];

  const live = (entries) =>
    config.frontmatter.draftField
      ? entries.filter((e) => e.front[config.frontmatter.draftField] !== 'true')
      : entries;

  // ── Frontmatter ───────────────────────────────────────────────────────────
  //
  // `frontmatter.required` applies to the articles directory only. That is the
  // one the radar produces, so it carries the full contract. The directories in
  // `content.also` are swept for prose and for the two checks that are true of
  // any frontmatter anywhere: a slug must match its filename, and an unquoted
  // colon breaks YAML. Requiring an article's fields of a case study would be
  // the package asserting a content model it does not own.
  for (const entry of all) {
    if (entry.malformed) {
      errors.push(`${entry.rel}: no frontmatter block`);
      continue;
    }

    if (entry.isArticle) {
      for (const field of config.frontmatter.required) {
        if (!entry.front[field]) errors.push(`${entry.rel}: missing "${field}" in the frontmatter`);
      }
    }

    const slugField = config.frontmatter.slugField;
    if (slugField && entry.front[slugField] && entry.front[slugField] !== entry.slugFromFile) {
      errors.push(
        `${entry.rel}: ${slugField} is "${entry.front[slugField]}" but the filename says ` +
          `"${entry.slugFromFile}". They must match.`,
      );
    }

    const descField = config.frontmatter.descriptionField;
    const [min, max] = config.frontmatter.descriptionLength;
    const description = descField ? entry.front[descField] : undefined;
    if (description) {
      if (description.length < min) {
        errors.push(`${entry.rel}: ${descField} is ${description.length} characters, minimum ${min}.`);
      } else if (description.length > max) {
        errors.push(
          `${entry.rel}: ${descField} is ${description.length} characters, maximum ${max}. ` +
            `Cut ${description.length - max}.`,
        );
      }
    }

    for (const field of unquotedColons(entry)) {
      errors.push(
        `${entry.rel}: "${field}" contains a colon followed by a space and is not quoted. ` +
          `YAML reads that as a nested key and the build fails. Quote it or rewrite the value.`,
      );
    }
  }

  // ── Linking ───────────────────────────────────────────────────────────────
  const liveArticles = live(articles);
  const clusterField = 'cluster';

  for (const article of liveArticles) {
    const links = internalLinks(article);

    if (config.rules.requireSiblingLink && config.content.clusters.length > 0) {
      const siblings = liveArticles
        .filter(
          (a) =>
            a.front[clusterField] === article.front[clusterField] &&
            a.slugFromFile !== article.slugFromFile,
        )
        .map((a) => `/${path.posix.basename(config.content.articles)}/${a.slugFromFile}`);

      if (siblings.length === 0) {
        notes.push(
          `${article.rel}: alone in the "${article.front[clusterField]}" cluster, so the ` +
            `sibling-link rule is not applied yet.`,
        );
      } else if (!links.some((l) => siblings.includes(l.split('#')[0]))) {
        errors.push(
          `${article.rel}: links to no other article in the "${article.front[clusterField]}" ` +
            `cluster. Available: ${siblings.join(', ')}`,
        );
      }
    }

    if (config.rules.requireCommercialLink && config.content.commercialPaths.length > 0) {
      const linked = links.some((l) =>
        config.content.commercialPaths.some(
          (p) => l === p || l.startsWith(`${p}#`) || l.startsWith(`${p}/`),
        ),
      );
      if (!linked) {
        errors.push(
          `${article.rel}: links to no commercial page. Link one of: ` +
            config.content.commercialPaths.join(', '),
        );
      }
    }

    if (config.rules.concessionMarkers.length > 0) {
      const markers = config.rules.concessionMarkers.map((m) => new RegExp(m, 'i'));
      if (!markers.some((re) => re.test(article.body))) {
        errors.push(
          `${article.rel}: no concession found. Every article admits one real limit. ` +
            `Add a section stating what this does not cover.`,
        );
      }
    }
  }

  // ── Prose ─────────────────────────────────────────────────────────────────
  for (const entry of live(all)) {
    const text = `${Object.values(entry.front).join(' ')}\n${entry.body}`;
    const clean = prose({ body: text });

    for (const banned of config.vocabulary.banned) {
      const hit = clean.match(word(banned));
      if (hit) errors.push(`${entry.rel}: banned word "${hit[0]}"`);
    }

    for (const [pattern, label] of config.vocabulary.bannedPhrases) {
      if (new RegExp(pattern, 'i').test(clean)) {
        errors.push(`${entry.rel}: banned construction ${label ?? pattern}`);
      }
    }

    if (config.vocabulary.spelling === 'en-GB') {
      for (const [wrong, right] of AMERICANISMS) {
        if (word(wrong).test(clean)) {
          errors.push(`${entry.rel}: American spelling "${wrong}". Use "${right}".`);
        }
      }
    } else if (config.vocabulary.spelling === 'en-US') {
      for (const [right, wrong] of AMERICANISMS) {
        if (word(wrong).test(clean)) {
          errors.push(`${entry.rel}: British spelling "${wrong}". Use "${right}".`);
        }
      }
    }

    if (config.rules.emDashPerWords) {
      const words = wordCount(clean);
      const dashes = (clean.match(/—/g) ?? []).length;
      const allowance = Math.max(1, Math.floor(words / config.rules.emDashPerWords));
      if (dashes > allowance) {
        errors.push(
          `${entry.rel}: ${dashes} em dashes over ${words} words, allowance is ${allowance}.`,
        );
      }
    }

    // Every figure asserted, printed for a person to check. A note rather than
    // an error because illustrative arithmetic is legitimate and telling it
    // apart from a claim about the world needs to understand the sentence.
    if (config.rules.auditStatistics) {
      const found = [];
      for (const paragraph of prose(entry).split(/\n\s*\n/)) {
        const hits = [...paragraph.matchAll(STAT)].map((m) => m[0]);
        if (hits.length === 0) continue;
        const cited = /\]\((https?:|\/)/.test(paragraph);
        for (const hit of hits) found.push(`${hit}${cited ? '' : '  (no link in this paragraph)'}`);
      }
      if (found.length > 0) {
        notes.push(
          `${entry.rel}: ${found.length} figure(s) asserted. Check each is real before merging:\n` +
            found.map((f) => `      ${f}`).join('\n'),
        );
      }
    }
  }

  // ── Extra sweeps, same vocabulary, for app source ─────────────────────────
  for (const dir of config.vocabulary.alsoSweep) {
    for (const file of walk(path.join(config.root, dir))) {
      const text = fs.readFileSync(file, 'utf8');
      const rel = path.relative(config.root, file);

      for (const banned of config.vocabulary.banned) {
        const hit = text.match(word(banned));
        if (hit) errors.push(`${rel}: banned word "${hit[0]}"`);
      }
      if (config.vocabulary.spelling === 'en-GB') {
        for (const [wrong, right] of AMERICANISMS) {
          if (word(wrong).test(text)) {
            errors.push(`${rel}: American spelling "${wrong}". Use "${right}".`);
          }
        }
      }
    }
  }

  return { errors, notes, counts: { articles: articles.length, other: others.length } };
}

const SWEEPABLE = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.md', '.mdx']);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (SWEEPABLE.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}
