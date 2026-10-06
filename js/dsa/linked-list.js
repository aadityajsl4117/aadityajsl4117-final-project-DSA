/* LINKED LIST DATA STRUCTURE FOR BORROW HISTORY LEDGER */
class TransactionNode {
  constructor(data) {
    this.data = data;
    this.next = null;
  }
}

class BorrowHistoryLinkedList {
  constructor() {
    this.head = null;
    this.size = 0;
  }

  append(transaction) {
    const newNode = new TransactionNode(transaction);
    newNode.next = this.head;
    this.head = newNode;
    this.size++;
  }

  toArray() {
    const result = [];
    let curr = this.head;
    while (curr) {
      result.push(curr.data);
      curr = curr.next;
    }
    return result;
  }

  find(predicate) {
    let curr = this.head;
    while (curr) {
      if (predicate(curr.data)) return curr.data;
      curr = curr.next;
    }
    return null;
  }

  loadFromArray(arr) {
    this.head = null;
    this.size = 0;
    for (let i = arr.length - 1; i >= 0; i--) {
      this.append(arr[i]);
    }
  }
}
