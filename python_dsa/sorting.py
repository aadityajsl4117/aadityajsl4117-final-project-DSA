"""
Sorting & Searching Algorithms in Python
Provides Merge Sort O(N log N) and Binary Search O(log N) implementations.
"""

def merge_sort(arr, key_fn=lambda x: x):
    """
    Perform O(N log N) Merge Sort on list using key_fn extractor.
    Returns a new sorted list.
    """
    if not arr or len(arr) <= 1:
        return list(arr) if arr else []

    mid = len(arr) // 2
    left = merge_sort(arr[:mid], key_fn)
    right = merge_sort(arr[mid:], key_fn)

    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if key_fn(left[i]) <= key_fn(right[j]):
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1

    result.extend(left[i:])
    result.extend(right[j:])
    return result


def binary_search(sorted_arr, target_val, key_fn=lambda x: x):
    """
    Perform O(log N) Binary Search on a sorted array.
    Returns index of target if found, else -1.
    """
    low = 0
    high = len(sorted_arr) - 1

    while low <= high:
        mid = (low + high) // 2
        val = key_fn(sorted_arr[mid])
        if val == target_val:
            return mid
        elif val < target_val:
            low = mid + 1
        else:
            high = mid - 1

    return -1
