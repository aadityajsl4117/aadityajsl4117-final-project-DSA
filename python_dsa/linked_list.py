"""
LinkedList Implementation in Python
Provides doubly linked list for active transactions and member directory history.
"""

class ListNode:
    def __init__(self, value):
        self.value = value
        self.next = None
        self.prev = None


class LinkedList:
    def __init__(self):
        self._head = None
        self._tail = None
        self._size = 0

    def append(self, value):
        """Append node to end of list."""
        new_node = ListNode(value)
        if not self._tail:
            self._head = new_node
            self._tail = new_node
        else:
            new_node.prev = self._tail
            self._tail.next = new_node
            self._tail = new_node
        self._size += 1

    def prepend(self, value):
        """Prepend node to start of list."""
        new_node = ListNode(value)
        if not self._head:
            self._head = new_node
            self._tail = new_node
        else:
            new_node.next = self._head
            self._head.prev = new_node
            self._head = new_node
        self._size += 1

    def find(self, predicate_fn):
        """Find and return first node matching predicate_fn, or None."""
        current = self._head
        while current:
            if predicate_fn(current.value):
                return current
            current = current.next
        return None

    def delete(self, predicate_fn):
        """Delete first node matching predicate_fn. Return True if deleted, False otherwise."""
        node = self.find(predicate_fn)
        if not node:
            return False

        if node.prev:
            node.prev.next = node.next
        else:
            self._head = node.next

        if node.next:
            node.next.prev = node.prev
        else:
            self._tail = node.prev

        self._size -= 1
        return True

    def to_list(self):
        """Return items in order as a Python list."""
        result = []
        current = self._head
        while current:
            result.append(current.value)
            current = current.next
        return result

    @property
    def size(self):
        return self._size

    def filter(self, predicate_fn):
        """Return list of values matching predicate_fn."""
        result = []
        current = self._head
        while current:
            if predicate_fn(current.value):
                result.append(current.value)
            current = current.next
        return result
