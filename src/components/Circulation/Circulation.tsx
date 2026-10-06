import React, { useState, useMemo } from 'react';
import { useLibrary } from '../../hooks/useLibrary';
import { useToast } from '../common/Toast';
import { SearchBar, StatusBadge, LoadingSpinner, EmptyState } from '../common';
import { formatDate, formatCurrency } from '../../utils/helpers';
import { Member, Book, Transaction, VerificationStatus, TransactionStatus } from '../../types';
import { CheckCircle, XCircle, Search, Clock, ArrowRight, CornerDownLeft, BookOpen, User } from 'lucide-react';

export const Circulation: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'BORROW' | 'RETURN'>('BORROW');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Circulation Desk</h1>
        <p className="text-sm text-gray-500">Automated check-out, fine calculations, and return receipts</p>
      </div>

      <div className="flex border-b border-gray-200">
        <button
          className={`px-6 py-3 font-semibold text-sm transition-colors ${
            activeTab === 'BORROW'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('BORROW')}
        >
          Check-Out (Borrow)
        </button>
        <button
          className={`px-6 py-3 font-semibold text-sm transition-colors ${
            activeTab === 'RETURN'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('RETURN')}
        >
          Check-In (Return)
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {activeTab === 'BORROW' ? <BorrowTab /> : <ReturnTab />}
      </div>
    </div>
  );
};

const BorrowTab: React.FC = () => {
  const { state, borrowBook } = useLibrary();
  const { showToast } = useToast();

  const [memberSearch, setMemberSearch] = useState('');
  const [bookSearch, setBookSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isBorrowing, setIsBorrowing] = useState(false);

  const filteredMembers = useMemo(() => {
    if (!memberSearch) return [];
    const q = memberSearch.toLowerCase();
    return state.members
      .filter(
        (m) =>
          m.id.toLowerCase().includes(q) ||
          m.fullName.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [state.members, memberSearch]);

  const filteredBooks = useMemo(() => {
    if (!bookSearch) return [];
    const q = bookSearch.toLowerCase();
    return state.books
      .filter(
        (b) =>
          (b.id.toLowerCase().includes(q) ||
            b.title.toLowerCase().includes(q) ||
            b.isbn.includes(q)) &&
          b.availableCopies > 0
      )
      .slice(0, 5);
  }, [state.books, bookSearch]);

  const memberBorrowedCount = useMemo(() => {
    if (!selectedMember) return 0;
    return state.transactions.filter(
      (t) => t.memberId === selectedMember.id && t.status === TransactionStatus.ACTIVE
    ).length;
  }, [state.transactions, selectedMember]);

  const hasFines = useMemo(() => {
    if (!selectedMember) return false;
    return state.fines.some((f) => f.memberId === selectedMember.id && f.status === 'PENDING');
  }, [state.fines, selectedMember]);

  const validations =
    selectedMember && selectedBook
      ? {
          memberActive: selectedMember.status === 'ACTIVE',
          memberVerified: selectedMember.verification === VerificationStatus.VERIFIED,
          bookAvailable: selectedBook.availableCopies > 0,
          borrowLimit: memberBorrowedCount < selectedMember.borrowLimit,
          noFines: !hasFines,
        }
      : null;

  const isValid = validations ? Object.values(validations).every(Boolean) : false;

  const handleBorrow = async () => {
    if (!selectedMember || !selectedBook || !isValid) return;
    setIsBorrowing(true);
    try {
      const res = await borrowBook(selectedBook.id, selectedMember.id);
      if (res.success) {
        showToast(`Checked out "${selectedBook.title}". Automated email sent to ${selectedMember.email}`, 'success');
        setSelectedMember(null);
        setSelectedBook(null);
        setMemberSearch('');
        setBookSearch('');
      } else {
        showToast(res.error || 'Failed to borrow book', 'error');
      }
    } catch {
      showToast('Failed to borrow book', 'error');
    } finally {
      setIsBorrowing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Step 1: Select Member</label>
          <div className="relative">
            <SearchBar value={memberSearch} onChange={setMemberSearch} placeholder="Search patron by Name, ID, or Email..." />
            {memberSearch && !selectedMember && filteredMembers.length > 0 && (
              <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto divide-y divide-gray-100">
                {filteredMembers.map((m) => (
                  <li
                    key={m.id}
                    className="px-4 py-2.5 hover:bg-indigo-50/50 cursor-pointer flex justify-between items-center transition-colors"
                    onClick={() => {
                      setSelectedMember(m);
                      setMemberSearch(m.fullName);
                    }}
                  >
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{m.fullName}</p>
                      <p className="text-xs text-gray-500">{m.id} • {m.department} ({m.memberType})</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {selectedMember && (
          <div className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-100 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-gray-900">{selectedMember.fullName}</h3>
                <p className="text-xs text-gray-500">{selectedMember.id} • {selectedMember.email}</p>
              </div>
              <StatusBadge status={selectedMember.status} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs pt-2">
              <p><strong className="text-gray-700">Limit:</strong> {memberBorrowedCount} / {selectedMember.borrowLimit} books</p>
              <p><strong className="text-gray-700">Verification:</strong> {selectedMember.verification}</p>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Step 2: Select Book</label>
          <div className="relative">
            <SearchBar value={bookSearch} onChange={setBookSearch} placeholder="Search by Book Title, ISBN, or ID..." />
            {bookSearch && !selectedBook && filteredBooks.length > 0 && (
              <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto divide-y divide-gray-100">
                {filteredBooks.map((b) => (
                  <li
                    key={b.id}
                    className="px-4 py-2.5 hover:bg-indigo-50/50 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedBook(b);
                      setBookSearch(b.title);
                    }}
                  >
                    <p className="font-semibold text-gray-900 text-sm">{b.title}</p>
                    <p className="text-xs text-gray-500">{b.author} • {b.availableCopies} available</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {selectedBook && (
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
            <h3 className="font-bold text-gray-900">{selectedBook.title}</h3>
            <p className="text-xs text-gray-500">{selectedBook.author} • Shelf: {selectedBook.shelf}</p>
            <p className="text-xs text-indigo-600 font-semibold">Available Copies: {selectedBook.availableCopies} / {selectedBook.totalCopies}</p>
          </div>
        )}
      </div>

      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase text-gray-700 mb-4">Autonomous Validation Checklist</h3>
          {!selectedMember || !selectedBook ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              Select a member and a book copy to run automatic circulation verification.
            </div>
          ) : (
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                {validations?.memberActive ? <CheckCircle className="text-emerald-500 w-5 h-5" /> : <XCircle className="text-rose-500 w-5 h-5" />}
                <span className={validations?.memberActive ? 'text-gray-700' : 'text-rose-600'}>Patron account status is Active</span>
              </li>
              <li className="flex items-center gap-2">
                {validations?.memberVerified ? <CheckCircle className="text-emerald-500 w-5 h-5" /> : <XCircle className="text-rose-500 w-5 h-5" />}
                <span className={validations?.memberVerified ? 'text-gray-700' : 'text-rose-600'}>University identity verified</span>
              </li>
              <li className="flex items-center gap-2">
                {validations?.bookAvailable ? <CheckCircle className="text-emerald-500 w-5 h-5" /> : <XCircle className="text-rose-500 w-5 h-5" />}
                <span className={validations?.bookAvailable ? 'text-gray-700' : 'text-rose-600'}>Physical copy available on shelf</span>
              </li>
              <li className="flex items-center gap-2">
                {validations?.borrowLimit ? <CheckCircle className="text-emerald-500 w-5 h-5" /> : <XCircle className="text-rose-500 w-5 h-5" />}
                <span className={validations?.borrowLimit ? 'text-gray-700' : 'text-rose-600'}>
                  Within borrowing limit ({memberBorrowedCount}/{selectedMember.borrowLimit})
                </span>
              </li>
              <li className="flex items-center gap-2">
                {validations?.noFines ? <CheckCircle className="text-emerald-500 w-5 h-5" /> : <XCircle className="text-rose-500 w-5 h-5" />}
                <span className={validations?.noFines ? 'text-gray-700' : 'text-rose-600'}>No outstanding blocking fines</span>
              </li>
            </ul>
          )}
        </div>

        <div className="mt-8">
          <button
            onClick={handleBorrow}
            disabled={!isValid || isBorrowing}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            {isBorrowing ? <LoadingSpinner size="sm" /> : <ArrowRight className="w-5 h-5" />}
            Issue Book & Send Receipt
          </button>
        </div>
      </div>
    </div>
  );
};

const ReturnTab: React.FC = () => {
  const { state, returnBook } = useLibrary();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [condition, setCondition] = useState('GOOD');
  const [isReturning, setIsReturning] = useState(false);

  const activeTransactions = useMemo(() => {
    return state.transactions.filter(
      (t) => t.status === TransactionStatus.ACTIVE || t.status === TransactionStatus.OVERDUE
    );
  }, [state.transactions]);

  const filteredTx = useMemo(() => {
    if (!search) return activeTransactions;
    const lower = search.toLowerCase();
    return activeTransactions.filter(
      (t) =>
        t.id.toLowerCase().includes(lower) ||
        t.bookTitle.toLowerCase().includes(lower) ||
        t.memberName.toLowerCase().includes(lower)
    );
  }, [activeTransactions, search]);

  const handleReturn = async () => {
    if (!selectedTx) return;
    setIsReturning(true);
    try {
      const res = await returnBook(selectedTx.id, condition);
      if (res.success) {
        showToast('Book checked in! Automated return receipt email dispatched.', 'success');
        setSelectedTx(null);
      } else {
        showToast(res.error || 'Failed to return book', 'error');
      }
    } catch {
      showToast('Failed to return book', 'error');
    } finally {
      setIsReturning(false);
    }
  };

  const today = new Date();
  const dueDate = selectedTx ? new Date(selectedTx.dueDate) : today;
  const isOverdue = dueDate < today;
  const daysOverdue = isOverdue ? Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const estimatedFine = isOverdue ? daysOverdue * state.dailyFineRate : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Search active checkouts by ID, Book Title, or Patron..." />

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Book</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Patron</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Due Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTx.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10">
                    <EmptyState title="No active loans" description="All loaned books have been checked in." icon={Search} />
                  </td>
                </tr>
              ) : (
                filteredTx.map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedTx?.id === tx.id ? 'bg-indigo-50/70 hover:bg-indigo-50' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900 text-sm">{tx.bookTitle}</div>
                      <div className="text-xs text-gray-400 font-mono">{tx.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-800">{tx.memberName}</div>
                      <div className="text-xs text-gray-400">{tx.memberId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(tx.dueDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={tx.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 h-fit">
        <h3 className="text-sm font-bold uppercase text-gray-700 mb-4">Check-In Processing</h3>

        {!selectedTx ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            Select an active transaction from the table to process return.
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold">Book Title</p>
              <p className="font-bold text-gray-900 text-sm mt-1">{selectedTx.bookTitle}</p>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold">Borrowing Patron</p>
              <p className="font-bold text-gray-900 text-sm mt-1">{selectedTx.memberName} ({selectedTx.memberId})</p>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Returned Copy Condition</p>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="NEW">New</option>
                <option value="GOOD">Good</option>
                <option value="FAIR">Fair</option>
                <option value="POOR">Poor</option>
                <option value="DAMAGED">Damaged</option>
              </select>
            </div>

            {isOverdue && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
                <Clock className="text-rose-500 w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-bold text-rose-900 text-sm">Overdue Return Detected</h4>
                  <p className="text-xs text-rose-700 mt-1">
                    {daysOverdue} days late. Autonomous late fine: <strong>{formatCurrency(estimatedFine)}</strong>
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={handleReturn}
              disabled={isReturning}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {isReturning ? <LoadingSpinner size="sm" /> : <CornerDownLeft className="w-5 h-5" />}
              Complete Return & Notify Next In Line
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
export default Circulation;
