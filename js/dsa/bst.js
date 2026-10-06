/* BINARY SEARCH TREE (BST) DATA STRUCTURE FOR BOOK CATALOG INDEXING */
class BSTNode {
  constructor(book) {
    this.book = book;
    this.left = null;
    this.right = null;
  }
}

class BookBST {
  constructor() {
    this.root = null;
    this.size = 0;
  }

  insert(book) {
    const newNode = new BSTNode(book);
    this.size++;
    if (!this.root) {
      this.root = newNode;
      return;
    }
    let current = this.root;
    while (true) {
      if (book.bookID < current.book.bookID) {
        if (!current.left) {
          current.left = newNode;
          break;
        }
        current = current.left;
      } else {
        if (!current.right) {
          current.right = newNode;
          break;
        }
        current = current.right;
      }
    }
  }

  search(bookID) {
    const targetID = Number(bookID);
    let current = this.root;
    let hops = 0;
    while (current) {
      hops++;
      const currID = Number(current.book.bookID);
      if (targetID === currID) return { book: current.book, hops, complexity: "O(log n)" };
      if (targetID < currID) current = current.left;
      else current = current.right;
    }
    return null;
  }

  inorderTraversal(node = this.root, result = []) {
    if (node) {
      this.inorderTraversal(node.left, result);
      result.push(node.book);
      this.inorderTraversal(node.right, result);
    }
    return result;
  }

  rebuild(booksArray) {
    this.root = null;
    this.size = 0;
    booksArray.forEach(b => this.insert(b));
  }
}
