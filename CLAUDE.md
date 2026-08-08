# CLAUDE.md

See [DEVELOPMENT.md](./DEVELOPMENT.md) for setup, scripts, and development workflow.

## Rebuild after editing, or the change is not live

Consumers (`brint`, `multindex`, `hanbok`, `taterhome`) depend on this package
by `file:` link and resolve it through `package.json` exports to **`dist/`**,
which is gitignored. Editing `src/` therefore changes nothing for them until
`npm run build` runs.

This fails in a specific and misleading way. `dist/` ships sourcemaps, so a
stack trace from a consumer reports **`src/` paths with the original line
numbers** — a stale `dist` is indistinguishable from an unfixed `src`. The
symptom is a fix that appears not to have applied: the same error, at the same
`src/...:NN`, after you have already changed that line.

So when a change here does not seem to take effect in a consumer, build before
debugging. This cost real time on 2026-08-08, when a fix verified by a minimal
repro against `src/` kept failing from hanbok until the rebuild.

## One object belongs to exactly one ChangeDomain

This is a deliberate invariant, not an oversight, and the
`Object is already associated with a different ChangeDomain` error is a
load-bearing tripwire. **Do not relax it.**

A domain owns a change context and a transaction, so multiple domains are only
meaningful as *isolated worlds over disjoint object graphs*. If one data object
lived in two domains, `withTransaction` on one would not cover writes the other
could see. Making `proxyStateMap` per-domain was considered and rejected for
exactly that reason.

When the error fires, the question is therefore "what is being wrongly shared?"
rather than "how do we allow sharing?". Inherited *methods* were the answer once
— shared class-level code miscounted as per-instance state, fixed by returning
them unwrapped in `object-handler`. Inherited *data* properties are genuinely
shared mutable state and should keep throwing. See commit `6a1dee4`.

Corollary worth knowing: nothing can hold two domains over instances of one
class unless this rule is respected, so anything that builds a fresh domain per
unit of work — hanbok builds one per `orient()` — will exercise it.
