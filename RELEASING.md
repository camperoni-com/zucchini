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

## The first release (once)

npm configures trusted publishing on a package that already exists, so the first version is published by hand
by a maintainer of the `camperoni` npm organization:

1. Merge the "Version packages" pull request that makes the version `0.1.0`, and the pull request that removes
   `"private": true` from `package.json`.
2. On an up-to-date `main`:

   ```sh
   npm ci
   npm login                 # as a member of the camperoni organization, with two-factor authentication
   npm run release:first     # builds, then publishes publicly under the `latest` tag
   ```

   `npm run release:dry-run` checks this without publishing; CI runs it on every pull request.

3. On npmjs.com, open the package's **Settings → Trusted publishing** and add a GitHub Actions publisher:
   organization `camperoni-com`, repository `zucchini`, workflow `release.yml`, no environment.
4. In the GitHub repository's **Settings → Secrets and variables → Actions → Variables**, set `NPM_PUBLISH` to
   `true`. Until then the Release workflow does nothing.
5. Re-run the Release workflow's latest run on `main` (or push anything to `main`): it finds `0.1.0` on npm,
   tags it `v0.1.0` and creates the GitHub release.

From then on, releases happen as described above.
