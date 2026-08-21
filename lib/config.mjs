import fs from 'node:fs';
import path from 'node:path';

/**
 * Configuration loading, with defaults.
 *
 * Everything a project might reasonably differ on lives here, and everything
 * that is the same everywhere is a default. The test applied to each field: if
 * two projects would sensibly set it differently, it belongs in config; if the
 * second project would only ever copy the first, it belongs in this file.
 *
 * Unknown keys are reported rather than ignored. A typo in a config key is
 * otherwise silent, and a silently disabled quality gate is worse than a
 * missing one because you believe it is running.
 */

export const CONFIG_FILE = 'radar.config.json';

const DEFAULTS = {
  brand: {
    name: '',
    /** One line. Goes into the brief so a drafting step knows who is speaking. */
    positioning: '',
  },

  content: {
    /** Where articles live, relative to the project root. */
    articles: 'content/articles',
    /** Optional. Other content directories to apply prose rules to. */
    also: [],
    /** Clusters, for the sibling-link rule. Empty disables that rule. */
    clusters: [],
    /** Pages an article must link at least one of. Empty disables that rule. */
    commercialPaths: [],
  },

  frontmatter: {
    /** Fields that must be present. */
    required: ['title', 'slug', 'description', 'publishedAt'],
    /** Field that must equal the filename without its extension. */
    slugField: 'slug',
    descriptionField: 'description',
    descriptionLength: [40, 200],
    /** Set to null to skip the draft convention entirely. */
    draftField: 'draft',
  },

  vocabulary: {
    /** Words that fail the build wherever they appear. */
    banned: [],
    /** [pattern, label] pairs. Patterns are case-insensitive strings. */
    bannedPhrases: [],
    /** 'en-GB' enforces British spelling, 'en-US' American, null disables. */
    spelling: null,
    /** Extra file globs to sweep with the same vocabulary, e.g. app source. */
    alsoSweep: [],
  },

  rules: {
    requireSiblingLink: true,
    requireCommercialLink: true,
    /** Regexes that count as admitting a limitation. Empty disables the rule. */
    concessionMarkers: [],
    /** Allowance is max(1, floor(words / this)). Null disables. */
    emDashPerWords: 500,
    /** Print every asserted figure as a review note. */
    auditStatistics: true,
  },

  pipeline: {
    targets: 'content/pipeline/targets.json',
    /** The file holding what only this project knows. The highest-value input. */
    knowledge: 'content/pipeline/knowledge.md',
    /** Files a drafting step must read before writing. */
    voice: [],
    /** Commands the brief tells a drafting step to run before opening a PR. */
    checkCommand: 'npx content-radar check',
  },
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stripComments(node) {
  if (Array.isArray(node)) {
    for (const item of node) if (isObject(item) || Array.isArray(item)) stripComments(item);
    return;
  }
  if (!isObject(node)) return;
  for (const key of Object.keys(node)) {
    if (key.startsWith('_')) delete node[key];
    else stripComments(node[key]);
  }
}

function merge(defaults, supplied, trail, unknown) {
  const out = Array.isArray(defaults) ? [...defaults] : { ...defaults };

  for (const [key, value] of Object.entries(supplied)) {
    if (!(key in defaults)) {
      unknown.push([...trail, key].join('.'));
      continue;
    }
    out[key] =
      isObject(defaults[key]) && isObject(value)
        ? merge(defaults[key], value, [...trail, key], unknown)
        : value;
  }

  return out;
}

export function loadConfig(root = process.cwd()) {
  const file = path.join(root, CONFIG_FILE);

  if (!fs.existsSync(file)) {
    const error = new Error(
      `No ${CONFIG_FILE} found in ${root}.\n` +
        `Run "npx content-radar init" to write a starter config and the workflow files.`,
    );
    error.code = 'NO_CONFIG';
    throw error;
  }

  let supplied;
  try {
    supplied = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (cause) {
    throw new Error(`${CONFIG_FILE} is not valid JSON: ${cause.message}`);
  }

  // Comment keys, so a config can explain itself to the next person. Stripped
  // recursively: the shipped template puts a _readme inside vocabulary, and a
  // top-level-only strip made the package reject its own starter config.
  stripComments(supplied);

  const unknown = [];
  const config = merge(DEFAULTS, supplied, [], unknown);

  if (unknown.length > 0) {
    throw new Error(
      `${CONFIG_FILE} has ${unknown.length} key(s) this version does not understand:\n` +
        unknown.map((k) => `  - ${k}`).join('\n') +
        `\n\nThese are reported rather than ignored on purpose. A typo in a rule name` +
        `\nwould otherwise silently disable a quality gate you believe is running.`,
    );
  }

  config.root = root;
  return config;
}

export { DEFAULTS };
