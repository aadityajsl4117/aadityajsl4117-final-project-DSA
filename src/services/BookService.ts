import { Book, BookCopy, BookStatus, CopyStatus } from '../types';
import { generateId } from '../utils/helpers';

export class BookService {
  static createBook(data: Partial<Book>): Book {
    const totalCopies = data.totalCopies || 1;
    const id = data.id || generateId('BK');
    const shelf = data.shelf || 'A1-S1';
    const now = new Date().toISOString();

    return {
      id,
      isbn: data.isbn || '',
      title: data.title || '',
      author: data.author || '',
      category: data.category || '',
      publisher: data.publisher || '',
      publishYear: data.publishYear || new Date().getFullYear(),
      shelf,
      description: data.description || '',
      coverImage: data.coverImage || '',
      totalCopies,
      availableCopies: totalCopies,
      borrowCount: 0,
      rating: 0,
      reviews: [],
      status: BookStatus.AVAILABLE,
      copies: this.generateCopies(id, totalCopies, shelf),
      createdAt: now,
      updatedAt: now,
      ...data,
    } as Book;
  }

  static generateCopies(bookId: string, count: number, shelf: string): BookCopy[] {
    const copies: BookCopy[] = [];
    for (let i = 1; i <= count; i++) {
      copies.push({
        copyId: `${bookId}-C${i}`,
        bookId,
        barcode: `LIB${bookId.replace(/[^0-9]/g, '')}${i}`,
        condition: 'NEW',
        shelf,
        status: CopyStatus.AVAILABLE,
        borrowedBy: null,
        lastBorrowDate: null,
      });
    }
    return copies;
  }

  static findAvailableCopy(book: Book): BookCopy | null {
    return book.copies?.find(c => c.status === CopyStatus.AVAILABLE) || null;
  }

  static updateCopyStatus(book: Book, copyId: string, status: CopyStatus, borrowedBy?: string): Book {
    const updatedCopies = (book.copies || []).map(c => {
      if (c.copyId === copyId) {
        return { ...c, status, borrowedBy: borrowedBy || null, lastBorrowDate: status === CopyStatus.ISSUED ? new Date().toISOString() : c.lastBorrowDate };
      }
      return c;
    });

    const availableCopies = updatedCopies.filter(c => c.status === CopyStatus.AVAILABLE).length;

    return {
      ...book,
      copies: updatedCopies,
      availableCopies,
      status: availableCopies > 0 ? BookStatus.AVAILABLE : BookStatus.ISSUED,
      updatedAt: new Date().toISOString(),
    };
  }

  static searchBooks(books: Book[], query: string): Book[] {
    if (!query) return books;
    const q = query.toLowerCase();
    return books.filter(b =>
      b.id.toLowerCase().includes(q) ||
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      b.isbn.toLowerCase().includes(q) ||
      b.category.toLowerCase().includes(q)
    );
  }

  static getBooksByCategory(books: Book[]): Record<string, number> {
    const dist: Record<string, number> = {};
    books.forEach(b => { dist[b.category] = (dist[b.category] || 0) + 1; });
    return dist;
  }

  static getMostBorrowed(books: Book[], limit: number): Book[] {
    return [...books].sort((a, b) => b.borrowCount - a.borrowCount).slice(0, limit);
  }
}
