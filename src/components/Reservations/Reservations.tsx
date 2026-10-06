import React, { useState, useMemo } from 'react';
import { useLibrary } from '../../hooks/useLibrary';
import { useToast } from '../common/Toast';
import { SearchBar, StatusBadge, EmptyState, Modal } from '../common';
import { formatDateTime } from '../../utils/helpers';
import { Book, ReservationStatus } from '../../types';
import { ListOrdered, BookOpen, AlertCircle } from 'lucide-react';

export const Reservations: React.FC = () => {
  const { state, cancelReservation, reserveBook } = useLibrary();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newResMember, setNewResMember] = useState<string>('');
  const [newResBook, setNewResBook] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

  const activeReservations = useMemo(() => {
    return state.reservations
      .filter((r) => r.status === ReservationStatus.WAITING || r.status === ReservationStatus.AVAILABLE)
      .map((r) => ({
        ...r,
        book: state.books.find((b) => b.id === r.bookId),
        member: state.members.find((m) => m.id === r.memberId),
      }))
      .sort((a, b) => new Date(a.reservedAt).getTime() - new Date(b.reservedAt).getTime());
  }, [state.reservations, state.books, state.members]);

  const filteredReservations = useMemo(() => {
    if (!search) return activeReservations;
    const lower = search.toLowerCase();
    return activeReservations.filter(
      (r) =>
        r.id.toLowerCase().includes(lower) ||
        r.book?.title.toLowerCase().includes(lower) ||
        r.member?.fullName.toLowerCase().includes(lower) ||
        r.memberName.toLowerCase().includes(lower)
    );
  }, [activeReservations, search]);

  const queueForSelectedBook = useMemo(() => {
    if (!selectedBook) return [];
    return activeReservations.filter((r) => r.bookId === selectedBook.id);
  }, [activeReservations, selectedBook]);

  const handleCancel = (id: string) => {
    try {
      cancelReservation(id);
      showToast('Reservation cancelled', 'success');
    } catch {
      showToast('Error cancelling reservation', 'error');
    }
  };

  const handleCreate = async () => {
    if (!newResBook || !newResMember) return;
    setIsCreating(true);
    try {
      const res = await reserveBook(newResBook, newResMember);
      if (res.success) {
        showToast('Reservation placed in waitlist', 'success');
        setIsModalOpen(false);
        setNewResBook('');
        setNewResMember('');
      } else {
        showToast(res.error || 'Error creating reservation', 'error');
      }
    } catch {
      showToast('Error creating reservation', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservations & Hold Waitlist</h1>
          <p className="text-sm text-gray-500">Automated queue priority and claim notifications</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium transition-colors"
        >
          Place New Hold
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
            <ListOrdered className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Active Holds</p>
            <p className="text-2xl font-bold text-gray-800">{activeReservations.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-lg text-gray-800">Active Queue Ledger</h3>
            <div className="w-64">
              <SearchBar value={search} onChange={setSearch} placeholder="Search reservations..." />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Book</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Member</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Position</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReservations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8">
                      <EmptyState title="No reservations found" icon={ListOrdered} />
                    </td>
                  </tr>
                ) : (
                  filteredReservations.map((res) => (
                    <tr
                      key={res.id}
                      onClick={() => res.book && setSelectedBook(res.book)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{res.book?.title || res.bookTitle}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {res.member?.fullName || res.memberName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-indigo-600">
                        #{res.position}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={res.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(res.reservedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {res.status === ReservationStatus.WAITING && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancel(res.id);
                            }}
                            className="text-rose-600 hover:text-rose-900 font-medium"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-fit">
          <h3 className="font-semibold text-lg text-gray-800 mb-4">Waitlist Flow</h3>
          {!selectedBook ? (
            <div className="text-center py-8 text-gray-500 flex flex-col items-center">
              <BookOpen className="w-12 h-12 text-gray-300 mb-2" />
              <p>Click any reservation to visualize its real-time queue.</p>
            </div>
          ) : (
            <div>
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="font-bold text-gray-900">{selectedBook.title}</p>
                <p className="text-sm text-gray-500">
                  Available: {selectedBook.availableCopies} / Total: {selectedBook.totalCopies}
                </p>
              </div>

              {queueForSelectedBook.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No active holds for this book.</p>
              ) : (
                <div className="space-y-3">
                  {queueForSelectedBook.map((r, idx) => (
                    <div key={r.id} className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{r.member?.fullName || r.memberName}</p>
                          <p className="text-xs text-gray-500">Held on {formatDateTime(r.reservedAt)}</p>
                        </div>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Place Book Hold">
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Unavailable Book</label>
            <select
              value={newResBook}
              onChange={(e) => setNewResBook(e.target.value)}
              className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
            >
              <option value="">Select a book...</option>
              {state.books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} ({b.availableCopies} available)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Member</label>
            <select
              value={newResMember}
              onChange={(e) => setNewResMember(e.target.value)}
              className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
            >
              <option value="">Select a member...</option>
              {state.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} ({m.id})
                </option>
              ))}
            </select>
          </div>
          <div className="bg-indigo-50 text-indigo-800 p-3 rounded-lg text-sm flex gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>Holds follow automatic FIFO promotion as soon as copies are checked back in.</p>
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newResBook || !newResMember || isCreating}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
            >
              {isCreating ? 'Placing Hold...' : 'Place Hold'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default Reservations;
