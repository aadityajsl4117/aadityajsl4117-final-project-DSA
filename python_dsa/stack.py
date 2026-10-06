"""
UndoStack Implementation in Python
Provides LIFO Stack functionality for application undo history and state management.
"""

class UndoStack:
    def __init__(self):
        self._stack = []

    def push(self, action):
        """Push an action or state onto the stack."""
        self._stack.append(action)

    def pop(self):
        """Pop and return the top element, or None if empty."""
        if self.is_empty():
            return None
        return self._stack.pop()

    def peek(self):
        """Return the top element without removing it, or None if empty."""
        if self.is_empty():
            return None
        return self._stack[-1]

    @property
    def size(self):
        """Return the current number of elements in the stack."""
        return len(self._stack)

    def is_empty(self):
        """Check if the stack is empty."""
        return len(self._stack) == 0

    def clear(self):
        """Clear all elements from the stack."""
        self._stack.clear()

    def to_list(self):
        """Return stack items in reverse order (most recent first)."""
        return list(reversed(self._stack))
