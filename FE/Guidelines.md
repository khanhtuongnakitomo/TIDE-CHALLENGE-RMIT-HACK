<!-- make-kit-guidelines -->
## Design System Setup — MANDATORY

This project depends on `@figma/astraui-kit` packages. Before writing
any code:

1. Read guidelines/setup.md and guidelines/Guidelines.md by their exact
   path (e.g. node_modules/<scope>/<package>/guidelines/setup.md).
   This project uses pnpm, which symlinks packages — do NOT use
   `find`, `glob`, or `file_search` to discover files as they silently
   fail on symlinks. Instead use: reading files by exact path,
   `ls` (follows symlinks), `find -L` (`-L` follows symlinks), or `cat`.
2. Execute all setup instructions (config changes) against THIS project — not the package itself.
3. Do not skip, modify, or improvise any setup steps.
4. Read ALL other required .md files specified in guidelines/Guidelines.md.
5. Verify that all required .md files have been read before proceeding.
<!-- /make-kit-guidelines -->

