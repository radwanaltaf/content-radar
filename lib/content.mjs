import fs from 'node:fs';
import path from 'node:path';

/**
 * Reading content files.
 *
 * The frontmatter parse here is a line-based reader rather than a YAML parser,
 * so the package has no dependencies and runs anywhere Node runs. That choice
 * has one consequence worth naming: this reader accepts frontmatter that a real
 * YAML parser rejects, most commonly an unquoted value containing a colon
 * followed by a space, which YAML reads as a nested key.
 *
 * That would make the checks pass and the consuming project's build fail
 * several minutes later, which is the worst of both. So `unquotedColon` is
 * detected explicitly and reported as an error rather than left to be
 * discovered downstream.
 */

export function readDir(root, dir) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];

  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
    .map((file) => read(root, dir, file))
    .filter(Boolean);
}

export function read(root, dir, file) {
  const raw = fs.readFileSync(path.join(root, dir, file), 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  if (!match) {
    return {
      file,
      dir,
      rel: path.posix.join(dir, file),
      front: {},
      frontLines: [],
      body: raw,
      malformed: true,
    };
  }

  const frontLines = match[1].split('\n');
  const front = {};

  for (const line of frontLines) {
    const m = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!m) continue;
    front[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }

  return {
    file,
    dir,
    rel: path.posix.join(dir, file),
    slugFromFile: file.replace(/\.mdx?$/, ''),
    front,
    frontLines,
    body: match[2],
    malformed: false,
  };
}

/** Body with fenced and inline code removed, for prose rules. */
export function prose(entry) {
  return entry.body.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
}

export function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Internal links, as written. `[text](/path)` only, not external. */
export function internalLinks(entry) {
  return [...entry.body.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]);
}

/**
 * Frontmatter lines whose value contains ": " and is not quoted. Valid to the
 * reader above and fatal to a real YAML parser.
 */
export function unquotedColons(entry) {
  const out = [];
  for (const line of entry.frontLines) {
    const m = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!m) continue;
    const value = m[2].trim();
    const quoted = /^(['"]).*\1$/.test(value);
    if (!quoted && /:\s/.test(value)) out.push(m[1]);
  }
  return out;
}
