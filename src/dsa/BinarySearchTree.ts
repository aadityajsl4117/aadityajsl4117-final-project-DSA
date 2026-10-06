class TreeNode<K, V> {
  key: K;
  value: V;
  left: TreeNode<K, V> | null = null;
  right: TreeNode<K, V> | null = null;
  
  constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
  }
}

export class BinarySearchTree<K, V> {
  private root: TreeNode<K, V> | null = null;
  private _size: number = 0;
  private comparator: (a: K, b: K) => number;

  constructor(comparator?: (a: K, b: K) => number) {
    this.comparator = comparator || ((a, b) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
  }

  insert(key: K, value: V): void {
    const newNode = new TreeNode(key, value);
    if (!this.root) {
      this.root = newNode;
      this._size++;
      return;
    }

    let current = this.root;
    while (true) {
      const cmp = this.comparator(key, current.key);
      if (cmp === 0) {
        current.value = value; // update
        return;
      } else if (cmp < 0) {
        if (!current.left) {
          current.left = newNode;
          this._size++;
          return;
        }
        current = current.left;
      } else {
        if (!current.right) {
          current.right = newNode;
          this._size++;
          return;
        }
        current = current.right;
      }
    }
  }

  search(key: K): V | null {
    let current = this.root;
    while (current) {
      const cmp = this.comparator(key, current.key);
      if (cmp === 0) {
        return current.value;
      } else if (cmp < 0) {
        current = current.left;
      } else {
        current = current.right;
      }
    }
    return null;
  }

  delete(key: K): void {
    this.root = this._deleteNode(this.root, key);
  }

  private _deleteNode(node: TreeNode<K, V> | null, key: K): TreeNode<K, V> | null {
    if (!node) return null;

    const cmp = this.comparator(key, node.key);
    if (cmp < 0) {
      node.left = this._deleteNode(node.left, key);
      return node;
    } else if (cmp > 0) {
      node.right = this._deleteNode(node.right, key);
      return node;
    } else {
      this._size--;
      if (!node.left && !node.right) {
        return null;
      }
      if (!node.left) {
        return node.right;
      }
      if (!node.right) {
        return node.left;
      }

      let minNode = node.right;
      while (minNode.left) {
        minNode = minNode.left;
      }
      node.key = minNode.key;
      node.value = minNode.value;
      node.right = this._deleteNode(node.right, minNode.key);
      this._size++; // adjust size back, _deleteNode would have decremented
      return node;
    }
  }

  inOrder(): {key: K, value: V}[] {
    const result: {key: K, value: V}[] = [];
    this._inOrder(this.root, result);
    return result;
  }

  private _inOrder(node: TreeNode<K, V> | null, result: {key: K, value: V}[]): void {
    if (node) {
      this._inOrder(node.left, result);
      result.push({ key: node.key, value: node.value });
      this._inOrder(node.right, result);
    }
  }

  min(): {key: K, value: V} | null {
    if (!this.root) return null;
    let current = this.root;
    while (current.left) {
      current = current.left;
    }
    return { key: current.key, value: current.value };
  }

  max(): {key: K, value: V} | null {
    if (!this.root) return null;
    let current = this.root;
    while (current.right) {
      current = current.right;
    }
    return { key: current.key, value: current.value };
  }

  get size(): number {
    return this._size;
  }

  toArray(): V[] {
    return this.inOrder().map(item => item.value);
  }
}
