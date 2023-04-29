# Tester Guide
*This document is definitely incomplete and could use some PRs from the community to complete it*

## Purpose
This document is intended as a checklist for someone testing the functionality of a build.

This document can also serve as a source of what automated end to end tests are needed if we get to that point.

## Tests
### Settings
#### Templating
##### Placeholder Settings
- Require Template Title Placeholder `off`
  - [ ] Template File without `{{title}}` accepted
- Require Template Link Placeholder `off`
  - [ ] Template File without `{{link}}` accepted
- Require Template Title Placeholder `on` & Require Template Link Placeholder `on`
  - [ ] Should display notice `[LUHMAN] Template Malformed. Missing {{title}} and {{link}} placeholder. Please add them to the template and try again...`
- Require Template Title Placeholder `on` & Require Template Link Placeholder `off`
  - [ ] Should display notice `[LUHMAN] Template Malformed. Missing {{title}} placeholder. Please add it to the template and try again...`
- Require Template Title Placeholder `off` & Require Template Link Placeholder `on`
  - [ ] Should display notice `[LUHMAN] Template Malformed. Missing {{link}} placeholder. Please add it to the template and try again...`