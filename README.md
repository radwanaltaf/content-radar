# content-radar

A content pipeline that finds what ranks for a query you want to own, briefs a better version, and refuses to publish it without a human.

Two halves, deliberately separated:

- **Deterministic.** Rotation, target selection, the record of what has already been looked at, and the quality floor. Ordinary code, no model, same inputs give the same output. Runs in CI on a schedule.
- **Judgement.** Reading the competition, deciding whether you can genuinely beat it, and drafting. Run by a person, or by an agent a person started.

The boundary is the point. The step where the honest answer is sometimes *"the incumbents are fine, write nothing"* lives on the judgement side, because a job that runs unattended will never return that answer. It will return an article, since that is what it was built to do.

---

## Install

Not on the npm registry. Install from the repository:

```bash
npm i -D github:radwanaltaf/content-radar
npx content-radar init
```

Pin a tag once there is one, so a project does not silently take a new version:

```bash
npm i -D github:radwanaltaf/content-radar#v0.1.0
```

If the repository is private, this works wherever git has your credentials, which is your machine and anywhere you have added a deploy key. In GitHub Actions the checkout token cannot read another private repo, so either add a personal access token as a secret and configure git to use it, or make the repository public. That choice is described at the bottom of this file.

`init` writes six files and skips any that already exist:

| File | What it is |
| --- | --- |
| `radar.config.json` | Everything this project controls |
| `content/pipeline/targets.json` | The work list |
| `content/pipeline/knowledge.md` | What only this project knows |
| `.github/workflows/content-radar.yml` | The schedule |
| `.github/ISSUE_TEMPLATE/radar-target.yml` | Propose a target from the GitHub UI |
| `.claude/commands/content-radar.md` | The judgement half, as a command |

Then wire the check into your build:

```json
{ "scripts": { "prebuild": "content-radar check" } }
```

## Commands

```
content-radar brief          the brief for the next target due
content-radar list           the whole work list and its state
content-radar claim <query>  record that a target was looked at
content-radar check          run the quality floor
content-radar init           write the starter files
```

## The two files that decide output quality

Everything else is plumbing.

**`content/pipeline/knowledge.md`** holds what this project knows and no other site does. Every article must carry at least one thing from it.

This is not optional decoration. A drafting step without it is working from the same public corpus as the pages it is trying to beat, so it produces a version of them, which is exactly what a search engine treats as unhelpful content made to rank. An empty knowledge file produces generic articles no matter how good the prompt is. Fill it in before you run the pipeline once.

**`radar.config.json` → `pipeline.voice`** lists the files a drafting step must read in full before writing. House style, tone, whatever rules you enforce. If you have none, output will read like everyone else's.

## Configuration

Unknown keys **fail** rather than being ignored. A typo in a rule name would otherwise silently disable a gate you believe is running.

```jsonc
{
  "brand": {
    "name": "Acme",
    "positioning": "One line. Goes into the brief so a drafting step knows who is speaking."
  },

  "content": {
    "articles": "content/articles",   // the directory the radar produces into
    "also": ["content/guides"],       // swept for prose rules, not the full contract
    "clusters": [{ "slug": "pricing", "name": "Pricing" }],
    "commercialPaths": ["/pricing", "/contact"]
  },

  "frontmatter": {
    "required": ["title", "slug", "description", "publishedAt"],
    "slugField": "slug",              // must equal the filename
    "descriptionField": "description",
    "descriptionLength": [40, 200],
    "draftField": "draft"             // null to opt out of the draft convention
  },

  "vocabulary": {
    "banned": ["seamless", "robust"],
    "bannedPhrases": [["\\bit'?s not just\\b", "\"it's not just X, it's Y\""]],
    "spelling": "en-GB",              // or "en-US", or null
    "spellingExceptions": ["Organization"],  // identifiers, case sensitive
    "alsoSweep": ["src"]              // apply the same vocabulary to app source
  },

  "rules": {
    "requireSiblingLink": true,       // one link to another article in the same cluster
    "requireCommercialLink": true,    // one link to a commercialPath
    "concessionMarkers": ["\\bthe limit\\b", "<Limit>"],
    "emDashPerWords": 500,            // allowance is max(1, words / this)
    "auditStatistics": true
  },

  "pipeline": {
    "targets": "content/pipeline/targets.json",
    "knowledge": "content/pipeline/knowledge.md",
    "voice": ["STYLE.md"],
    "checkCommand": "npx content-radar check"
  }
}
```

### Which rules apply where

`frontmatter.required` applies to `content.articles` only. That is the directory the radar produces, so it carries the full contract. Directories in `content.also` get the prose rules plus the two checks that are true of any frontmatter anywhere: a slug must match its filename, and an unquoted colon breaks YAML.

Requiring an article's fields of a case study would be the package asserting a content model it does not own.

### Spelling exceptions

`spelling` will flag identifiers as misspellings, because `Organization` is a schema.org type and `color` is a CSS property. Every real project hits this within a day.

`spellingExceptions` blanks those terms before the check runs, **case sensitively**, so `Organization` the identifier is exempt and `organization` the word is not. Keep the list short: an escape hatch stops people disabling the whole rule, which is the outcome it exists to prevent.

## The statistics audit

`check` prints every figure an article asserts, with the sentence around it, as a **note** rather than an error.

An invented statistic is the most damaging thing a content pipeline can produce, and it is invisible in a diff because it looks exactly like a researched one. But failing on every digit is wrong: *"a candidate worth £4,000 a month that costs £3,000 to run"* is arithmetic, not a claim about the world. Telling those apart needs to understand the sentence.

So the machine finds them and a person judges them. Read the notes in your pull requests.

## Why the frontmatter parser is not YAML

It is a line reader, so the package has no dependencies. That has one consequence: it accepts frontmatter a real YAML parser rejects, most often an unquoted value containing a colon followed by a space, which YAML reads as a nested key.

That would make `check` pass and your build fail minutes later, which is the worst of both. So it is detected explicitly and reported as an error.

## Adding a target

Add one because a gap exists, not because a keyword is available. A page written because the keyword was free is what this whole quality floor exists to prevent.

Two automatic rejections, both enforced by the issue form:

1. **You already own it.** If an existing page answers the query, a second page competes with the first and both lose.
2. **You would have to invent something.** If beating the incumbents needs a statistic, client name or result you do not have, that is not a gap you can fill.

A target marked `rejected` records that you looked and the incumbents were good enough. That is a real outcome and keeping it stops the radar suggesting the same query again.

## Where this lives

Extracted from the AISynq site with `git subtree split`, which is why the history starts partway through. It has no dependencies and no imports outside its own directory, so it moves cleanly.

**Private or public.** It ships private, because it is a business asset rather than a library, and nothing in it is secret. Two consequences: installing it in GitHub Actions needs a token with read access, and nobody else can use it.

To make it public, which removes the token step and makes it installable anywhere:

```bash
gh repo edit radwanaltaf/content-radar --visibility public --accept-visibility-change-consequences
```

Check `content/pipeline/knowledge.md` in any consuming project before doing that. The package itself carries no client information; a consuming project's knowledge file usually does.

**Pushing changes back.** Edit here, commit, and consuming projects pick it up on their next `npm install`. If you would rather keep editing inside the AISynq repo, re-split and force-push:

```bash
git subtree split --prefix packages/content-radar -b content-radar
git push content-radar content-radar:main --force
```
