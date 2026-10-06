/* FIFO HOLD QUEUE DATA STRUCTURE FOR PRIORITY RESERVATIONS */
class HoldQueue {
  constructor() {
    this.items = [];
  }

  enqueue(element) {
    this.items.push(element);
  }

  dequeue() {
    return this.items.shift();
  }

  peek() {
    return this.items[0];
  }

  isEmpty() {
    return this.items.length === 0;
  }

  size() {
    return this.items.length;
  }

  toArray() {
    return [...this.items];
  }

  contains(predicate) {
    return this.items.some(predicate);
  }

  remove(predicate) {
    this.items = this.items.filter(x => !predicate(x));
  }
}
