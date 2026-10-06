"""
FIFOQueue Implementation in Python
Provides node-based FIFO queue for reservations and hold waiting lists.
"""

class QueueNode:
    def __init__(self, value):
        self.value = value
        self.next = None


class FIFOQueue:
    def __init__(self):
        self._head = None
        self._tail = None
        self._size = 0

    def enqueue(self, item):
        """Add an item to the end of the queue."""
        new_node = QueueNode(item)
        if not self._tail:
            self._head = new_node
            self._tail = new_node
        else:
            self._tail.next = new_node
            self._tail = new_node
        self._size += 1

    def dequeue(self):
        """Remove and return the item at the front of the queue, or None if empty."""
        if not self._head:
            return None
        val = self._head.value
        self._head = self._head.next
        if not self._head:
            self._tail = None
        self._size -= 1
        return val

    def peek(self):
        """Return front item without removing, or None if empty."""
        if not self._head:
            return None
        return self._head.value

    @property
    def size(self):
        return self._size

    def is_empty(self):
        return self._size == 0

    def to_list(self):
        """Return all queue elements in FIFO order as a list."""
        result = []
        current = self._head
        while current:
            result.append(current.value)
            current = current.next
        return result

    def remove_by_predicate(self, predicate_fn):
        """Remove first item matching predicate_fn and return it, or None."""
        current = self._head
        prev = None

        while current:
            if predicate_fn(current.value):
                if prev:
                    prev.next = current.next
                    if not current.next:
                        self._tail = prev
                else:
                    self._head = current.next
                    if not self._head:
                        self._tail = None
                self._size -= 1
                return current.value
            prev = current
            current = current.next
        return None

    def get_position(self, predicate_fn):
        """Return 0-based position of first item matching predicate_fn, or -1."""
        current = self._head
        pos = 0
        while current:
            if predicate_fn(current.value):
                return pos
            pos += 1
            current = current.next
        return -1
