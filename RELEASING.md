# Releasing

Zucchini is published to npm as `@camperoni/zucchini` from GitHub Actions, through npm's trusted publishing:
no npm token is stored anywhere, and every release carries a provenance statement linking it to the commit
and workflow that built it.

## How a release happens

1. Pull requests that change what users get add a changeset (`npx changeset`).
2. When it's time to release, open a **"Version packages"** pull request: on a branch from `main`, run

   ```sh
   npm run version-packages
   ```

   It bumps the version and moves the changesets into `CHANGELOG.md`. Commit the result (signed off) and open
   the pull request. CI checks it like any other.

3. Merging it publishes the new version to npm, tags it `v<version>` and creates the GitHub release with the
   version's changelog section.

4. Check the release: the version's page on npmjs.com shows its provenance (built by GitHub Actions from this
   repository's `release.yml`), and the `v<version>` tag and GitHub release exist. If provenance is missing,
   check the trusted publisher settings below before the next release.

The Release workflow runs on every push to `main` and does nothing when npm already has the version in
`package.json`. (A workflow can't open the "Version packages" pull request itself here: the organization doesn't
let workflows create pull requests.)

## Prereleases

To publish prereleases under npm's `next` tag, for example to try a change in a project before releasing it:

```sh
npx changeset pre enter next   # versions become 0.2.0-next.0, 0.2.0-next.1, ...
# release as usual: each "Version packages" merge publishes to `next`
npx changeset pre exit         # the next "Version packages" merge publishes to `latest`
```

Install a prerelease with `npm install @camperoni/zucchini@next`.

## Checking a release without publishing

`npm run release:dry-run` packs the package and dry-runs publishing it as the next patch version and as a
`next` prerelease: public, under the right tag, with `dist/`, and with `package.json` published as written
(npm silently "corrects" a manifest it dislikes). CI runs it on every pull request.

## The first release

npm configures trusted publishing on a package that already exists, so 0.1.0 was published by hand, on
2026-11-11, by a maintainer of the `camperoni` npm organization. The trusted publisher was added on npmjs.com
(**Settings → Trusted publishing**: GitHub Actions, organization `camperoni-com`, repository `zucchini`, workflow
`release.yml`, no environment), and the `NPM_PUBLISH` repository variable turned on publishing from CI.
