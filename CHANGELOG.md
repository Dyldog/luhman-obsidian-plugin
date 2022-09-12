# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Sections are used under each version as follows:
- `Added` for new features.
- `Changed` for changes in existing functionality.
- `Deprecated` for soon-to-be removed features.
- `Removed` for now removed features.
- `Fixed` for any bug fixes.
- `Security` in case of vulnerabilities.

## [Unreleased]

### Added

- Added documentation for the release process.
- Added beta versions (via [BRAT]).
- Added notifications for some failures.
- Added CHANGELOG.
- Added `Open New Zettel on Creation` checkbox on Model screen
- Added new command `New Child Zettel Note (Don't Open)` same as `New Child Zettel Note` but defaults `Open New Zettel on Creation` to false
- Added new command `New Sibling Zettel Note (Don't Open)` same as `New Sibling Zettel Note` but defaults `Open New Zettel on Creation` to false

### Fixed

- Fixed [BUG] On Create Sibling or Child Note, link to child or sibling incorrect #24
- Fixed [BUG] Weird space added when making link to zettle
#30
- Add zettel command wasn't working.
- Titles were set to `# \n\n` by default when user didn't provide a title.
- Ignore filter for getting zettels was configured incorrectly.

## [1.1.0] - 2021-10-20

### Added

- Supported more complex file names.

## [1.0.2] - 2021-09-02

### Changed

- Sorted zettel modal contents.

### Fixed

- Fixed bug with suggester modal.

## [1.0.1] - 2021-08-22

### Fixed

- Corrected misspelling of Luhmann.

## [1.0.0] - 2021-08-14

### Added

- Initial Release





<!-- Links -->
[BRAT]: https://github.com/TfTHacker/obsidian42-brat

[Unreleased]: https://github.com/Dyldog/luhman-obsidian-plugin/compare/1.1.0...HEAD
[1.1.0]: https://github.com/Dyldog/luhman-obsidian-plugin/compare/1.0.2...1.1.0
[1.0.2]: https://github.com/Dyldog/luhman-obsidian-plugin/compare/1.0.1...1.0.2
[1.0.1]: https://github.com/Dyldog/luhman-obsidian-plugin/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/Dyldog/luhman-obsidian-plugin/releases/tag/1.0.0
