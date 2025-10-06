// @ts-check

/**
 * @typedef {any} CartTransformRunInput
 * @typedef {any} CartTransformRunResult
 */

/**
 * @type {CartTransformRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

/**
 * @param {CartTransformRunInput} input
 * @returns {CartTransformRunResult}
 */
export function cartTransformRun(input) {
  // Disable cart transform - we'll handle gift products via Cart Update AJAX API instead
  // This prevents the bundle creation issue
  return { operations: [] };
}

