class ListNode<T> {
  value: T;
  next: ListNode<T> | null = null;
  prev: ListNode<T> | null = null;

  constructor(value: T) {
    this.value = value;
  }
}

export class LinkedList<T> {
  private head: ListNode<T> | null = null;
  private tail: ListNode<T> | null = null;
  private _size: number = 0;

  append(value: T): void {
    const newNode = new ListNode(value);
    if (!this.tail) {
      this.head = newNode;
      this.tail = newNode;
    } else {
      newNode.prev = this.tail;
      this.tail.next = newNode;
      this.tail = newNode;
    }
    this._size++;
  }

  prepend(value: T): void {
    const newNode = new ListNode(value);
    if (!this.head) {
      this.head = newNode;
      this.tail = newNode;
    } else {
      newNode.next = this.head;
      this.head.prev = newNode;
      this.head = newNode;
    }
    this._size++;
  }

  find(predicate: (value: T) => boolean): ListNode<T> | null {
    let current = this.head;
    while (current) {
      if (predicate(current.value)) {
        return current;
      }
      current = current.next;
    }
    return null;
  }

  delete(predicate: (value: T) => boolean): boolean {
    const node = this.find(predicate);
    if (!node) return false;

    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    this._size--;
    return true;
  }

  toArray(): T[] {
    const result: T[] = [];
    let current = this.head;
    while (current) {
      result.push(current.value);
      current = current.next;
    }
    return result;
  }

  get size(): number {
    return this._size;
  }

  forEach(callback: (value: T, index: number) => void): void {
    let current = this.head;
    let index = 0;
    while (current) {
      callback(current.value, index);
      current = current.next;
      index++;
    }
  }

  filter(predicate: (value: T) => boolean): T[] {
    const result: T[] = [];
    let current = this.head;
    while (current) {
      if (predicate(current.value)) {
        result.push(current.value);
      }
      current = current.next;
    }
    return result;
  }
}
