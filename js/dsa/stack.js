/* LIFO STACK DATA STRUCTURE FOR ACTION UNDO MEMORY */
class UndoStack {
  constructor() {
    this.items = [];
  }

  push(state) {
    this.items.push(state);
  }

  pop() {
    return this.items.pop();
  }

  isEmpty() {
    return this.items.length === 0;
  }

  size() {
    return this.items.length;
  }
}
