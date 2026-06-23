# Publishing `@pedra-ai/sdk` to npm

The package is published as a **public scoped** package (`@pedra-ai/sdk`).
`publishConfig.access` is already set to `public` in `package.json`, so a plain
`npm publish` works.

## One-time setup

1. Create the **npm organization** `pedra-ai` (free for public packages):
   https://www.npmjs.com/org/create — name it `pedra-ai`.
2. Log in on the machine that will publish:
   ```bash
   npm login   # or: npm login --scope=@pedra-ai
   ```
   You must be a member of the `pedra-ai` npm org with publish rights.

## Publish

```bash
npm install        # dev deps (typescript, @types/node)
npm test           # builds + runs the test suite
npm publish        # builds via prepublishOnly, publishes @pedra-ai/sdk@<version>
```

`prepublishOnly` runs `clean` + `build`, so `dist/` is always fresh. Only
`dist/`, `README.md`, and `LICENSE` are included in the tarball (see
`.npmignore`); verify with `npm pack --dry-run`.

## Releasing a new version

```bash
npm version patch   # or minor / major — bumps package.json + git tag
git push --follow-tags
npm publish
```

Update `CHANGELOG.md` before tagging.

## CI

`.github/workflows/ci.yml` runs `npm test` on Node 18/20/22 for every push and
PR. Consider adding an npm publish job gated on git tags + an `NPM_TOKEN` secret.
