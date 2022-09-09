# How To Release

We use `@release-it/release-it` to generate new releases of this plugin.

## Prerequisites

- Your working tree must be clean.
- You must be on the `master` branch for official releases. Pre-releases may be made from any branch, however `master` is preferred.

## Beta Release

1. Ensure all desired changes are committed and the working tree is clean.
2. Ensure `CHANGELOG.md` is updated with all relevant changes for this beta release.
3. Run `npm run release-it` and follow interactive options. If you are not on `master`, you may need to add ` -- --no-git.requireUpstream` to the end of the command.
   1. Select desired version bump (i.e., prepatch, preminor, or premajor). Please do not use the `Other, please specify...` option.
   2. At `? Commit (Release vX.Y.Z-beta.A)?` prompt, enter `Y` to commit the changes made by `release-it`.
   3. At `? Tag (vX.Y.Z-beta.A)?` prompt, enter `Y` to create a new Git tag.
   4. At `? Push?` prompt, enter `Y` to push the changes to the remote.
   5. At `? Create a pre-release on GitHub (vX.Y.Z-beta.A)?` prompt, enter `Y` to create the release on GitHub.
4. Verify beta release.
## Official Release

1. Ensure you are on the `master` branch.
2. Ensure all desired changes are committed and the working tree is clean.
3. Ensure `CHANGELOG.md` is updated with all relevant changes for this release.
4. Run `npm run release-it` and follow interactive options.
   1. Select desired version bump (i.e., patch, minor, or major). Please do not use the `Other, please specify...` option.
   2. At `? Commit (Release vX.Y.Z)?` prompt, enter `Y` to commit the changes made by `release-it`.
   3. At `? Tag (vX.Y.Z)?` prompt, enter `Y` to create a new Git tag.
   4. At `? Push?` prompt, enter `Y` to push the changes to the remote.
   5. At `? Create a release on GitHub (vX.Y.Z)?` prompt, enter `Y` to create the release on GitHub.
5. Verify release.
