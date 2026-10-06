class QueueNode<T> {
  value: T;
  next: QueueNode<T> | null = null;
  
  constructor(value: T) {
    this.value = value;
  }
}

export class FIFOQueue<T> {
  private head: QueueNode<T> | null = null;
  private tail: QueueNode<T> | null = null;
  private _size: number = 0;

  enqueue(item: T): void {
    const newNode = new QueueNode(item);
    if (!this.tail) {
      this.head = newNode;
      this.tail = newNode;
    } else {
      this.tail.next = newNode;
      this.tail = newNode;
    }
    this._size++;
  }

  dequeue(): T | null {
    if (!this.head) return null;
    const value = this.head.value;
    this.head = this.head.next;
    if (!this.head) {
      this.tail = null;
    }
    this._size--;
    return value;
  }

  peek(): T | null {
    if (!this.head) return null;
    return this.head.value;
  }

  get size(): number {
    return this._size;
  }

  isEmpty(): boolean {
    return this._size === 0;
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

  removeByPredicate(predicate: (item: T) => boolean): T | null {
    let current = this.head;
    let prev: QueueNode<T> | null = null;

    while (current) {
      if (predicate(current.value)) {
        if (prev) {
          prev.next = current.next;
          if (!current.next) {
            this.tail = prev;
          }
        } else {
          this.head = current.next;
          if (!this.head) {
            this.tail = null;
          }
        }
        this._size--;
        return current.value;
      }
      prev = current;
      current = current.next;
    }
    return null;
  }

  getPosition(predicate: (item: T) => boolean): number {
    let current = this.head;
    let position = 0;
    while (current) {
      if (predicate(current.value)) {
        return position;
      }
      position++;
      current = current.next;
    }
    return -1;
  }
}
