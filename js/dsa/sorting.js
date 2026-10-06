/* MERGE SORT ALGORITHM IMPLEMENTATION FOR ANALYTICS AND SORTING */
function mergeSort(arr, keyExtractor = x => x) {
  if (!arr || arr.length <= 1) return arr;
  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid), keyExtractor);
  const right = mergeSort(arr.slice(mid), keyExtractor);
  
  const result = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    if (keyExtractor(left[i]) <= keyExtractor(right[j])) {
      result.push(left[i++]);
    } else {
      result.push(right[j++]);
    }
  }
  return result.concat(left.slice(i)).concat(right.slice(j));
}
