"""
Python DSA Runner Engine
CLI & JSON interface to execute Python DSA data structures & algorithms.
"""

import sys
import json
from stack import UndoStack
from queue import FIFOQueue
from linked_list import LinkedList
from bst import BinarySearchTree
from sorting import merge_sort, binary_search


def process_action(action, payload):
    if action == "merge_sort":
        arr = payload.get("items", [])
        sort_key = payload.get("key", None)
        if sort_key:
            sorted_items = merge_sort(arr, key_fn=lambda item: item.get(sort_key, ""))
        else:
            sorted_items = merge_sort(arr)
        return {"success": True, "action": action, "result": sorted_items}

    elif action == "bst_index":
        items = payload.get("items", [])
        key_field = payload.get("key_field", "book_id")
        bst = BinarySearchTree()
        for item in items:
            k = item.get(key_field)
            if k is not None:
                bst.insert(k, item)
        in_order_nodes = bst.in_order()
        search_target = payload.get("search_key", None)
        search_result = bst.search(search_target) if search_target is not None else None

        return {
            "success": True,
            "action": action,
            "size": bst.size,
            "in_order": in_order_nodes,
            "search_result": search_result
        }

    elif action == "fifo_queue":
        queue = FIFOQueue()
        items = payload.get("items", [])
        for item in items:
            queue.enqueue(item)
        
        remove_id = payload.get("remove_id", None)
        removed_item = None
        if remove_id:
            removed_item = queue.remove_by_predicate(lambda item: item.get("id") == remove_id or item.get("member_id") == remove_id)

        return {
            "success": True,
            "action": action,
            "size": queue.size,
            "items": queue.to_list(),
            "removed_item": removed_item
        }

    elif action == "stack_history":
        stack = UndoStack()
        actions = payload.get("actions", [])
        for act in actions:
            stack.push(act)
        
        return {
            "success": True,
            "action": action,
            "size": stack.size,
            "top": stack.peek(),
            "history": stack.to_list()
        }

    else:
        return {"success": False, "error": f"Unknown action: {action}"}


def main():
    if len(sys.argv) > 1:
        raw_input = sys.argv[1]
    else:
        raw_input = sys.stdin.read()

    try:
        data = json.loads(raw_input)
        action = data.get("action", "")
        payload = data.get("payload", {})
        result = process_action(action, payload)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


if __name__ == "__main__":
    main()
