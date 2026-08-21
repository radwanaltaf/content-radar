/**
 * Programmatic entry point, for a project that wants to call the pieces
 * directly rather than through the CLI. The CLI is the supported interface;
 * these are exported because a build script sometimes needs the check without
 * spawning a process.
 */

export { check } from './check.mjs';
export { CONFIG_FILE, DEFAULTS, loadConfig } from './config.mjs';
export { internalLinks, prose, read, readDir, unquotedColons, wordCount } from './content.mjs';
export {
  NOTHING_DUE,
  claim,
  loadTargets,
  nextTarget,
  published,
  renderBrief,
  saveTargets,
} from './targets.mjs';
