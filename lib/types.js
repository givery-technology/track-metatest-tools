/**
 * @typedef {{
 *     name:    string,
 *     ok:      boolean,
 *     message: ?string,
 * }} TestResult
 */

/**
 * @typedef {{
 *     target: {
 *         type: string,
 *         name: string,
 *     },
 *     conditions: {
 *         line: number=,
 *         branch: number=,
 *     },
 * }} CoverageTarget
 */
