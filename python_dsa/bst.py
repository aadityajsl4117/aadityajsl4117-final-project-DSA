"""
BinarySearchTree Implementation in Python
Provides BST indexed key-value lookup and In-Order Traversal for book catalog index.
"""

class TreeNode:
    def __init__(self, key, value):
        self.key = key
        self.value = value
        self.left = None
        self.right = None


class BinarySearchTree:
    def __init__(self, comparator=None):
        self.root = None
        self._size = 0
        if comparator:
            self.comparator = comparator
        else:
            self.comparator = lambda a, b: -1 if a < b else (1 if a > b else 0)

    def insert(self, key, value):
        """Insert or update key-value pair in BST."""
        new_node = TreeNode(key, value)
        if not self.root:
            self.root = new_node
            self._size += 1
            return

        current = self.root
        while True:
            cmp = self.comparator(key, current.key)
            if cmp == 0:
                current.value = value  # Update value
                return
            elif cmp < 0:
                if not current.left:
                    current.left = new_node
                    self._size += 1
                    return
                current = current.left
            else:
                if not current.right:
                    current.right = new_node
                    self._size += 1
                    return
                current = current.right

    def search(self, key):
        """Search for key in BST and return value, or None if not found."""
        current = self.root
        while current:
            cmp = self.comparator(key, current.key)
            if cmp == 0:
                return current.value
            elif cmp < 0:
                current = current.left
            else:
                current = current.right
        return None

    def delete(self, key):
        """Delete key from BST."""
        self.root = self._delete_node(self.root, key)

    def _delete_node(self, node, key):
        if not node:
            return None

        cmp = self.comparator(key, node.key)
        if cmp < 0:
            node.left = self._delete_node(node.left, key)
            return node
        elif cmp > 0:
            node.right = self._delete_node(node.right, key)
            return node
        else:
            self._size -= 1
            if not node.left and not node.right:
                return None
            if not node.left:
                return node.right
            if not node.right:
                return node.left

            min_node = node.right
            while min_node.left:
                min_node = min_node.left
            node.key = min_node.key
            node.value = min_node.value
            node.right = self._delete_node(node.right, min_node.key)
            self._size += 1  # Adjust size compensating for recursive delete
            return node

    def in_order(self):
        """Return list of dicts {'key': k, 'value': v} in In-Order traversal sequence."""
        result = []
        self._in_order_traverse(self.root, result)
        return result

    def _in_order_traverse(self, node, result):
        if node:
            self._in_order_traverse(node.left, result)
            result.append({'key': node.key, 'value': node.value})
            self._in_order_traverse(node.right, result)

    def min(self):
        """Return element with minimum key, or None."""
        if not self.root:
            return None
        current = self.root
        while current.left:
            current = current.left
        return {'key': current.key, 'value': current.value}

    def max(self):
        """Return element with maximum key, or None."""
        if not self.root:
            return None
        current = self.root
        while current.right:
            current = current.right
        return {'key': current.key, 'value': current.value}

    @property
    def size(self):
        return self._size

    def to_list(self):
        """Return list of values ordered by in-order key sequence."""
        return [item['value'] for item in self.in_order()]
