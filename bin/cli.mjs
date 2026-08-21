#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { check } from '../lib/check.mjs';
import { CONFIG_FILE, loadConfig } from '../lib/config.mjs';
import { NOTHING_DUE, claim, loadTargets, nextTarget, renderBrief } from '../lib/targets.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.join(HERE, '..', 'templates');

const USAGE = `content-radar

  brief            print the brief for the next target due
  list             the whole work list and its state
  claim <query>    record that a target was looked at today
  check            run the quality floor over the content
  init             write a starter config and the workflow files

Config lives in ${CONFIG_FILE} at the project root.`;

const [command, ...rest] = process.argv.slice(2);

function withConfig(fn) {
  try {
    return fn(loadConfig());
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

switch (command) {
  case 'brief': {
    withConfig((config) => {
      const target = nextTarget(loadTargets(config).targets);
      console.log(target ? renderBrief(config, target) : NOTHING_DUE);
    });
    break;
  }

  case 'list': {
    withConfig((config) => {
      const groups = { open: [], done: [], rejected: [] };
      for (const t of loadTargets(config).targets) (groups[t.status] ??= []).push(t);
      for (const [status, items] of Object.entries(groups)) {
        console.log(`\n${status.toUpperCase()} (${items.length})`);
        for (const t of items) {
          console.log(`  ${t.query}`);
          console.log(`    cluster: ${t.cluster}  last checked: ${t.lastChecked ?? 'never'}`);
          if (t.article) console.log(`    article: ${t.article}`);
        }
      }
      console.log('');
    });
    break;
  }

  case 'claim': {
    const query = rest[0];
    if (!query) {
      console.error('Which target? Run "content-radar list" for the exact query strings.');
      process.exit(1);
    }
    withConfig((config) => {
      const target = claim(config, query, rest[1]);
      if (!target) {
        console.error(`No target matching "${query}". Run "content-radar list".`);
        process.exit(1);
      }
      console.log(`Claimed "${query}", last checked ${target.lastChecked}.`);
    });
    break;
  }

  case 'check': {
    withConfig((config) => {
      const { errors, notes, counts } = check(config);
      const summary = `${counts.articles} articles, ${counts.other} other content files`;

      if (notes.length > 0) {
        console.log('Notes, for a person to judge:');
        for (const note of notes) console.log(`  · ${note}`);
        console.log('');
      }

      if (errors.length > 0) {
        console.error(`Failed. ${errors.length} problem(s) across ${summary}:\n`);
        for (const error of errors) console.error(`  ✗ ${error}`);
        console.error('');
        process.exit(1);
      }

      console.log(`Passed. ${summary}, quality floor clear.`);
    });
    break;
  }

  case 'init': {
    const root = process.cwd();
    const written = [];
    const skipped = [];

    const copy = (from, to) => {
      const dest = path.join(root, to);
      if (fs.existsSync(dest)) {
        skipped.push(to);
        return;
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(TEMPLATES, from), dest);
      written.push(to);
    };

    copy('radar.config.json', CONFIG_FILE);
    copy('targets.json', 'content/pipeline/targets.json');
    copy('knowledge.md', 'content/pipeline/knowledge.md');
    copy('workflow.yml', '.github/workflows/content-radar.yml');
    copy('issue-form.yml', '.github/ISSUE_TEMPLATE/radar-target.yml');
    copy('command.md', '.claude/commands/content-radar.md');

    for (const file of written) console.log(`  wrote    ${file}`);
    for (const file of skipped) console.log(`  kept     ${file}  (already existed)`);

    console.log(`
Next, in this order:

  1. Edit ${CONFIG_FILE}. The fields that matter most are content.clusters,
     content.commercialPaths, vocabulary.banned and pipeline.voice.
  2. Fill in content/pipeline/knowledge.md with what this project knows and
     other sites do not. This is the highest-value file in the pipeline and an
     empty one produces articles indistinguishable from the competition.
  3. Add real targets to content/pipeline/targets.json, or use the GitHub issue
     form. Add one because a gap exists, not because a keyword is available.
  4. Wire the check into your build: "content-radar check".`);
    break;
  }

  case 'help':
  case undefined:
    console.log(USAGE);
    break;

  default:
    console.error(`Unknown command "${command}".\n\n${USAGE}`);
    process.exit(1);
}
