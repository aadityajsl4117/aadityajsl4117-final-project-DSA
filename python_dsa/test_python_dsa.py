"""
Automated Test Suite for Python DSA Implementations
Tests Stack, Queue, LinkedList, BST, MergeSort, BinarySearch, and Runner.
"""

import unittest
from stack import UndoStack
from queue import FIFOQueue
from linked_list import LinkedList
from bst import BinarySearchTree
from sorting import merge_sort, binary_search


class TestPythonDSA(unittest.TestCase):

    def test_stack(self):
        s = UndoStack()
        self.assertTrue(s.is_empty())
        s.push({"action": "ISSUE", "id": 101})
        s.push({"action": "RETURN", "id": 102})
        self.assertEqual(s.size, 2)
        self.assertEqual(s.peek()["action"], "RETURN")
        popped = s.pop()
        self.assertEqual(popped["action"], "RETURN")
        self.assertEqual(s.size, 1)

    def test_queue(self):
        q = FIFOQueue()
        q.enqueue({"member_id": "MEM-1", "hold": 1})
        q.enqueue({"member_id": "MEM-2", "hold": 2})
        self.assertEqual(q.size, 2)
        self.assertEqual(q.get_position(lambda x: x["member_id"] == "MEM-2"), 1)
        removed = q.remove_by_predicate(lambda x: x["member_id"] == "MEM-1")
        self.assertEqual(removed["member_id"], "MEM-1")
        self.assertEqual(q.size, 1)

    def test_linked_list(self):
        ll = LinkedList()
        ll.append("Book A")
        ll.append("Book B")
        ll.prepend("Book 0")
        self.assertEqual(ll.size, 3)
        self.assertEqual(ll.to_list(), ["Book 0", "Book A", "Book B"])
        self.assertTrue(ll.delete(lambda x: x == "Book A"))
        self.assertEqual(ll.to_list(), ["Book 0", "Book B"])

    def test_bst(self):
        bst = BinarySearchTree()
        bst.insert(102, "Clean Code")
        bst.insert(101, "Design Patterns")
        bst.insert(103, "Refactoring")
        self.assertEqual(bst.size, 3)
        self.assertEqual(bst.search(102), "Clean Code")
        in_order = bst.in_order()
        self.assertEqual([x["key"] for x in in_order], [101, 102, 103])
        self.assertEqual(bst.min()["key"], 101)
        self.assertEqual(bst.max()["key"], 103)

    def test_sorting_and_searching(self):
        items = [
            {"id": 3, "title": "Zebra"},
            {"id": 1, "title": "Apple"},
            {"id": 2, "title": "Mango"}
        ]
        sorted_items = merge_sort(items, key_fn=lambda x: x["id"])
        self.assertEqual([x["id"] for x in sorted_items], [1, 2, 3])

        idx = binary_search(sorted_items, 2, key_fn=lambda x: x["id"])
        self.assertEqual(idx, 1)


if __name__ == "__main__":
    unittest.main()
