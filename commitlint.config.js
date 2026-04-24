/*
 * Conventional Commits — enforces the commit message format specified in
 * README ("Commits convencionales: feat:, chore:, refactor:, fix:").
 *
 * Rule defaults from @commitlint/config-conventional:
 *   - type-enum:    feat, fix, chore, refactor, docs, style, perf, test,
 *                   build, ci, revert
 *   - header-max:   100 chars
 *   - subject-case: must not be sentence/start/pascal/upper case
 *
 * Example: `feat(brief): add dark mode toggle`
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
}
