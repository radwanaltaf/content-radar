---
description: Research what ranks for the next target query and draft an article that beats it
---

# Content radar

Run the judgement half of the pipeline. The deterministic half has already chosen the target.

## 1. Get the brief

```bash
npx content-radar brief
```

That prints the target query, the hunch about why the incumbents are weak, and everything already published so you do not compete with your own pages. If it prints `NOTHING DUE`, stop and say so.

## 2. Read what actually ranks

Search the query. Then **fetch and read the top three to five results properly.** Titles are not enough and neither are search snippets, because the whole exercise is finding the specific thing they all skip, and that is never in the summary.

For each one, note what structure it uses, what it tells the reader to do, and **where it stops.** That last one is the important one. Almost every ranking page in a given space stops at the same place, and naming it precisely is the article.

## 3. Match the intent. Do not invent a new angle

**The incumbents rank because of their angle, not despite it.** Somebody searching "how to prioritise X" wants a method for prioritising X. If you serve them an argument that prioritisation is broken, you have not beaten the incumbent, you have left the competition. The page now ranks for nothing, because it answers a question nobody typed.

So: **same angle, your flavour.** Give the reader the thing they came for, in the shape they expected, and win on the part the incumbents do badly. The differentiator belongs inside the structure, not instead of it.

The test: **if your draft would not satisfy somebody who typed the query, it is the wrong draft**, however good the argument is.

## 4. Decide whether you can beat it, honestly

You are allowed to conclude no. If the incumbents are genuinely good, or the gap needs something this project does not have, mark the target `rejected` in the targets file with the real reason and stop. A radar that never returns no is a radar producing filler.

Two automatic rejections:

- **We already own it.** If an existing page or tool answers the query, a second page competes with the first. Check the published list in the brief.
- **We would have to invent something.** If beating the incumbents needs a statistic, client name or result this project does not have, that is not a gap you can fill.

## 5. Load what only this project knows

**Read the knowledge file named in the brief before drafting.** Every article must carry at least one thing from it.

This is the step that decides whether the piece is worth publishing. Without it you are drafting from the same public corpus as the pages you are trying to beat, so you will produce a competent summary of them, which is exactly what a search engine treats as unhelpful content made to rank.

If nothing in that file is relevant to this target, that is a strong signal the target is wrong. Reconsider step 4.

## 6. Gather sources as you go

Any claim about the world needs a real citation with a link **in the same paragraph**. A judgement does not, and should read as a judgement.

- "Most companies cannot answer this" is a judgement. Fine.
- "73% of companies cannot answer this" is a claim. It needs a source, and if you have not seen one, you may not write it.

The check prints every figure an article asserts as a review note, with its context. Somebody reads that list before merging, so an invented number gets caught. Do not make it their job.

Illustrative arithmetic is allowed and needs no citation, because it is not a claim about the world. Keep it obviously hypothetical.

## 7. Draft it

Read every file listed under `pipeline.voice` in `radar.config.json` in full before writing a sentence.

**The title.** Write the one a person would click, not the one that sounds clever. Titles that describe the argument rather than the answer lose twice: nobody searches them and nobody clicks them.

- **Start from the query.** "How to prioritise AI use cases" beats "Every AI prioritisation framework skips the only hard part". The second is a better sentence and a worse title.
- **Say what the reader gets.** "How to", "what happens when", "what it costs".
- **Under about fifty characters** where you can manage it.
- **No abstraction that only makes sense after reading.** Whoever is choosing whether to click has not read it.

Same rule for the slug: match the query, in words, with hyphens.

Frontmatter must satisfy `radar.config.json`, including the draft field. **The draft field is not a formality.** It keeps the piece out of the site until a person removes it, because an article is a claim made in the project's name and a pipeline cannot be accountable for one.

## 8. Check it

```bash
npx content-radar check
```

It must pass. Read the notes as well as the errors: the notes list every figure the article asserts, and each one is your responsibility.

## 9. Record and open a PR

```bash
npx content-radar claim "<the exact query string>"
```

Then branch, commit, push, and open a pull request. **Do not merge it.** Say in the PR body which pages you read, the specific weakness you are attacking, and what you are least sure about. That last part is what makes the review worth doing.

If a GitHub issue raised this, close it with a link to the PR.

## A note on automating steps 2 to 7

You could put a model in CI and have this run unattended. Before doing that, notice what step 4 is for: the answer is sometimes that the competition is fine and you should not write anything. A job that runs unattended will never return that answer, because returning an article is what it was built to do.
