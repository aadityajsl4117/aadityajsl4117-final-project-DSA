import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  LayoutGrid,
  List as ListIcon,
  Plus,
  Star,
  Edit,
  Search,
  MessageSquare,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { useLibrary } from '../../hooks/useLibrary';
import { Modal, StatusBadge, SearchBar, EmptyState, LoadingSpinner } from '../common';
import { useToast } from '../common/Toast';
import { BOOK_CATEGORIES } from '../../utils/constants';
import { Book, MemberStatus, VerificationStatus } from '../../types';
import { formatDate } from '../../utils/helpers';

export const BookCatalog: React.FC = () => {
  const {
    state,
    addBook,
    updateBook,
    borrowBook,
    reserveBook,
    addReview,
  } = useLibrary();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '', memberId: '' });

  // Add / Edit form state
  const [formData, setFormData] = useState<Partial<Book>>({
    title: '',
    author: '',
    isbn: '',
    category: BOOK_CATEGORIES[0] || 'Computer Science',
    publisher: '',
    publishYear: new Date().getFullYear(),
    shelf: 'A1-S1',
    description: '',
    totalCopies: 3,
    coverImage: '',
  });

  const books = state.books || [];
  const members = state.members || [];

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      const matchesSearch =
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.isbn.includes(searchQuery) ||
        book.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        categoryFilter === 'All' || book.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [books, searchQuery, categoryFilter]);

  const activeMembers = useMemo(() => {
    return members.filter(
      (m) => m.status === MemberStatus.ACTIVE && m.verification === VerificationStatus.VERIFIED
    );
  }, [members]);

  const handleOpenAddModal = () => {
    setEditingBook(null);
    setFormData({
      title: '',
      author: '',
      isbn: '',
      category: BOOK_CATEGORIES[0] || 'Computer Science',
      publisher: '',
      publishYear: new Date().getFullYear(),
      shelf: 'A1-S1',
      description: '',
      totalCopies: 3,
      coverImage: '',
    });
    setShowAddModal(true);
  };

  const handleOpenEditModal = (book: Book) => {
    setEditingBook(book);
    setFormData({
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      category: book.category,
      publisher: book.publisher,
      publishYear: book.publishYear,
      shelf: book.shelf,
      description: book.description,
      totalCopies: book.totalCopies,
      coverImage: book.coverImage,
    });
    setShowAddModal(true);
  };

  const handleSaveBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim() || !formData.author?.trim() || !formData.isbn?.trim()) {
      showToast('Title, author, and ISBN are required.', 'error');
      return;
    }

    try {
      if (editingBook) {
        updateBook(editingBook.id, formData);
        showToast('Book updated successfully.', 'success');
      } else {
        addBook(formData);
        showToast('New book added to library collection.', 'success');
      }
      setShowAddModal(false);
    } catch {
      showToast('Failed to save book.', 'error');
    }
  };

  const handleBorrow = async () => {
    if (!selectedBook || !selectedMemberId) {
      showToast('Please select a member.', 'error');
      return;
    }
    setIsLoading(true);
    try {
      const res = await borrowBook(selectedBook.id, selectedMemberId);
      if (res.success) {
        showToast(`Book checked out. Automated email sent!`, 'success');
        setShowBorrowModal(false);
        if (showDetailModal) setShowDetailModal(false);
      } else {
        showToast(res.error || 'Failed to borrow book.', 'error');
      }
    } catch {
      showToast('Error processing borrow request.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReserve = async () => {
    if (!selectedBook || !selectedMemberId) {
      showToast('Please select a member.', 'error');
      return;
    }
    setIsLoading(true);
    try {
      const res = await reserveBook(selectedBook.id, selectedMemberId);
      if (res.success) {
        showToast(`Hold placed! Position #${res.reservation?.position}. Automated confirmation email sent.`, 'success');
        setShowReserveModal(false);
        if (showDetailModal) setShowDetailModal(false);
      } else {
        showToast(res.error || 'Failed to reserve book.', 'error');
      }
    } catch {
      showToast('Error placing hold.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook || !reviewForm.memberId || !reviewForm.comment.trim()) {
      showToast('Please select your member profile and enter a review.', 'error');
      return;
    }
    addReview(selectedBook.id, reviewForm.memberId, reviewForm.rating, reviewForm.comment);
    showToast('Review submitted successfully.', 'success');
    setShowReviewModal(false);
    setReviewForm({ rating: 5, comment: '', memberId: '' });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-indigo-600" />
            Book Catalog
          </h1>
          <p className="text-sm text-gray-500">Autonomous university library catalog and physical copy tracker</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all"
        >
          <Plus size={18} />
          Add New Book
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="w-full md:w-80">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search by title, author, ISBN..." />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="All">All Categories</option>
            {BOOK_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div className="flex border border-gray-200 rounded-xl p-1 bg-gray-50">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="Grid View"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="List View"
            >
              <ListIcon size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {filteredBooks.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <EmptyState icon={BookOpen} title="No books found" description="Try searching for a different title, author, or category." />
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredBooks.map((book) => (
            <div
              key={book.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="aspect-[4/3] bg-gradient-to-br from-indigo-500 to-purple-600 relative flex items-center justify-center p-4">
                  {book.coverImage ? (
                    <img src={book.coverImage} alt={book.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center text-white/90">
                      <BookOpen size={48} className="mx-auto mb-2 opacity-80" />
                      <span className="text-xs uppercase font-mono tracking-wider opacity-75">{book.id}</span>
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <StatusBadge status={book.status} size="sm" />
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">{book.category}</span>
                    <div className="flex items-center gap-1 text-xs font-semibold text-amber-500">
                      <Star size={14} className="fill-amber-400 text-amber-400" />
                      {book.rating || 4.5}
                    </div>
                  </div>

                  <h3 className="font-bold text-gray-900 text-base line-clamp-1" title={book.title}>
                    {book.title}
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-1">{book.author}</p>

                  <div className="pt-2 flex justify-between items-center text-xs text-gray-600 border-t border-gray-50">
                    <span>Available: <strong>{book.availableCopies}</strong> / {book.totalCopies}</span>
                    <span className="text-gray-400">Shelf: {book.shelf}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 pt-0 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setSelectedBook(book);
                    setShowDetailModal(true);
                  }}
                  className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold transition"
                >
                  View Details
                </button>
                {book.availableCopies > 0 ? (
                  <button
                    onClick={() => {
                      setSelectedBook(book);
                      setSelectedMemberId('');
                      setShowBorrowModal(true);
                    }}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition"
                  >
                    Borrow
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedBook(book);
                      setSelectedMemberId('');
                      setShowReserveModal(true);
                    }}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold transition"
                  >
                    Place Hold
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">ID</th>
                  <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Book</th>
                  <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Category</th>
                  <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Availability</th>
                  <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Shelf</th>
                  <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Status</th>
                  <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredBooks.map((book) => (
                  <tr key={book.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-medium text-gray-500">{book.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="font-semibold text-gray-900 text-sm">{book.title}</p>
                      <p className="text-xs text-gray-500">{book.author} • ISBN: {book.isbn}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600">{book.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-gray-800">
                      {book.availableCopies} / {book.totalCopies} copies
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600">{book.shelf}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={book.status} size="sm" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedBook(book);
                          setShowDetailModal(true);
                        }}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(book)}
                        className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium transition"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Book Detail Modal */}
      {selectedBook && (
        <Modal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          title={`Book Record #${selectedBook.id}`}
          size="xl"
        >
          <div className="space-y-6 py-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="aspect-[3/4] bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex flex-col items-center justify-center p-6 text-white text-center shadow-sm">
                {selectedBook.coverImage ? (
                  <img src={selectedBook.coverImage} alt={selectedBook.title} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <>
                    <BookOpen size={64} className="opacity-80 mb-3" />
                    <p className="font-bold text-lg">{selectedBook.title}</p>
                    <p className="text-xs opacity-75 mt-1">{selectedBook.author}</p>
                  </>
                )}
              </div>

              <div className="md:col-span-2 space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-semibold text-indigo-600 tracking-wider">{selectedBook.category}</span>
                    <StatusBadge status={selectedBook.status} />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mt-1">{selectedBook.title}</h2>
                  <p className="text-sm text-gray-600">{selectedBook.author}</p>
                </div>

                <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">
                  {selectedBook.description || 'No description available for this book.'}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-gray-400 block">ISBN</span>
                    <strong className="text-gray-800">{selectedBook.isbn}</strong>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-gray-400 block">Publisher</span>
                    <strong className="text-gray-800">{selectedBook.publisher || 'N/A'}</strong>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-gray-400 block">Year</span>
                    <strong className="text-gray-800">{selectedBook.publishYear}</strong>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-gray-400 block">Shelf Location</span>
                    <strong className="text-gray-800">{selectedBook.shelf}</strong>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-gray-400 block">Borrow Count</span>
                    <strong className="text-gray-800">{selectedBook.borrowCount} times</strong>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-gray-400 block">Copies Available</span>
                    <strong className="text-indigo-600">{selectedBook.availableCopies} / {selectedBook.totalCopies}</strong>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  {selectedBook.availableCopies > 0 ? (
                    <button
                      onClick={() => {
                        setSelectedMemberId('');
                        setShowBorrowModal(true);
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition"
                    >
                      Check-Out to Patron
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedMemberId('');
                        setShowReserveModal(true);
                      }}
                      className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600 transition"
                    >
                      Place Hold on Waitlist
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setReviewForm({ rating: 5, comment: '', memberId: '' });
                      setShowReviewModal(true);
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-200 transition"
                  >
                    Add Review
                  </button>
                </div>
              </div>
            </div>

            {/* Physical Copies Tracker */}
            <div>
              <h4 className="font-bold text-sm text-gray-900 mb-3">Individual Physical Copies Inventory</h4>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold text-gray-500">Copy ID</th>
                      <th className="px-4 py-2.5 font-semibold text-gray-500">Barcode</th>
                      <th className="px-4 py-2.5 font-semibold text-gray-500">Condition</th>
                      <th className="px-4 py-2.5 font-semibold text-gray-500">Shelf</th>
                      <th className="px-4 py-2.5 font-semibold text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {selectedBook.copies?.map((copy) => (
                      <tr key={copy.copyId}>
                        <td className="px-4 py-2.5 font-mono font-bold text-gray-800">{copy.copyId}</td>
                        <td className="px-4 py-2.5 font-mono text-gray-500">{copy.barcode}</td>
                        <td className="px-4 py-2.5">{copy.condition}</td>
                        <td className="px-4 py-2.5">{copy.shelf}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={copy.status} size="sm" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reviews Section */}
            <div>
              <h4 className="font-bold text-sm text-gray-900 mb-3">Patron Reviews ({selectedBook.reviews?.length || 0})</h4>
              {selectedBook.reviews && selectedBook.reviews.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedBook.reviews.map((rev) => (
                    <div key={rev.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-800">{rev.memberName}</span>
                        <div className="flex items-center text-amber-500">
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <Star key={i} size={12} className="fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                      </div>
                      <p className="text-gray-600">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No patron reviews recorded yet.</p>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Add / Edit Book Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={editingBook ? `Edit Book #${editingBook.id}` : 'Add Book to University Catalog'}
        size="lg"
      >
        <form onSubmit={handleSaveBook} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold uppercase text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. Structure and Interpretation of Computer Programs"
                required
              />
            </div>
            <div>
              <label className="block font-semibold uppercase text-gray-700 mb-1">Author *</label>
              <input
                type="text"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. Harold Abelson"
                required
              />
            </div>
            <div>
              <label className="block font-semibold uppercase text-gray-700 mb-1">ISBN *</label>
              <input
                type="text"
                value={formData.isbn}
                onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. 9780262510875"
                required
              />
            </div>
            <div>
              <label className="block font-semibold uppercase text-gray-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {BOOK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold uppercase text-gray-700 mb-1">Shelf Location</label>
              <input
                type="text"
                value={formData.shelf}
                onChange={(e) => setFormData({ ...formData, shelf: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. A2-S3"
              />
            </div>
            <div>
              <label className="block font-semibold uppercase text-gray-700 mb-1">Publisher</label>
              <input
                type="text"
                value={formData.publisher}
                onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. MIT Press"
              />
            </div>
            <div>
              <label className="block font-semibold uppercase text-gray-700 mb-1">Publication Year</label>
              <input
                type="number"
                value={formData.publishYear}
                onChange={(e) => setFormData({ ...formData, publishYear: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            {!editingBook && (
              <div>
                <label className="block font-semibold uppercase text-gray-700 mb-1">Initial Physical Copies</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={formData.totalCopies}
                  onChange={(e) => setFormData({ ...formData, totalCopies: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block font-semibold uppercase text-gray-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Overview of the book..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 border rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 shadow-sm"
            >
              {editingBook ? 'Save Changes' : 'Add Book'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Check-Out Modal */}
      <Modal
        isOpen={showBorrowModal}
        onClose={() => !isLoading && setShowBorrowModal(false)}
        title={`Check Out: ${selectedBook?.title}`}
      >
        <div className="space-y-4 py-2">
          <p className="text-xs text-gray-600">
            Select an active registered member to issue this physical book copy.
          </p>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-700 mb-1">Select Patron</label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">Choose a member...</option>
              {activeMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} ({m.id}) • {m.department}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setShowBorrowModal(false)}
              className="px-4 py-2 border rounded-xl text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedMemberId || isLoading}
              onClick={handleBorrow}
              className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? <LoadingSpinner size="sm" /> : <CheckCircle size={16} />}
              Confirm Check-Out
            </button>
          </div>
        </div>
      </Modal>

      {/* Quick Hold Modal */}
      <Modal
        isOpen={showReserveModal}
        onClose={() => !isLoading && setShowReserveModal(false)}
        title={`Place Hold: ${selectedBook?.title}`}
      >
        <div className="space-y-4 py-2">
          <p className="text-xs text-gray-600">
            All copies of this book are currently on loan. Placing a hold joins the automated priority waitlist.
          </p>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-700 mb-1">Select Patron</label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">Choose a member...</option>
              {activeMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} ({m.id}) • {m.department}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setShowReserveModal(false)}
              className="px-4 py-2 border rounded-xl text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedMemberId || isLoading}
              onClick={handleReserve}
              className="px-5 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? <LoadingSpinner size="sm" /> : <Clock size={16} />}
              Join Hold Waitlist
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Review Modal */}
      <Modal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title={`Review "${selectedBook?.title}"`}
      >
        <form onSubmit={handleAddReview} className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-700 mb-1">Reviewing Patron</label>
            <select
              value={reviewForm.memberId}
              onChange={(e) => setReviewForm({ ...reviewForm, memberId: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              required
            >
              <option value="">Select your member profile...</option>
              {activeMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} ({m.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-700 mb-1">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                  className="p-1 text-amber-400 hover:scale-110 transition"
                >
                  <Star size={24} className={star <= reviewForm.rating ? 'fill-amber-400' : 'text-gray-300'} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-700 mb-1">Feedback & Notes</label>
            <textarea
              rows={3}
              value={reviewForm.comment}
              onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="What did you think of this book?"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowReviewModal(false)}
              className="px-4 py-2 border rounded-xl text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 shadow-sm"
            >
              Submit Review
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default BookCatalog;
