# Changes

## 0.1.0 2026-11-21

First published version.

- Seneca 4: the peer dependency is `seneca` `^4.0.0`.
- Node.js 24 or later (`engines.node` `>=24`).
- The peer dependencies `seneca-entity` and `seneca-promisify` are
  removed. The plugin uses neither. Seneca 4 has promises built in and
  deprecates the promisify plugin (D4).
- The option defaults are a function of the `valid` builders that
  Seneca passes in. The `ignore` option takes a list of any length, of
  string or object patterns, and a list that you pass replaces the
  default list (B13). Seneca 4 read the old default list as a closed
  two-element tuple.
- Tests cover the audit hook on Seneca 4: intercepted patterns,
  `include` and `exclude` lists, prior calls, the `ignore` list and
  entity saves.
