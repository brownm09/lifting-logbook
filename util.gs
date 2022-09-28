/**
 * Flatten a two-dimensional array.
 * @param {[]} arr The array to flatten.
 * @return [] The flattened array
 */
function flatten(arr) {
  return arr.reduce((acc, val) => acc.concat(val), []);
}
