import React, { useState } from 'react';
import { AlertTriangle, Package, XCircle } from 'lucide-react';
import { useLibrary } from '../../hooks/useLibrary';
import { Modal } from '../common';
import { useToast } from '../common/Toast';
import { RestockRequest, RestockStatus, ReservationStatus } from '../../types';
import { formatDate } from '../../utils/helpers';

export default function Restock() {
  const { state, requestRestock, approveRestock, receiveRestock } = useLibrary();
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [requestedCopies, setRequestedCopies] = useState(1);
  const [reason, setReason] = useState('');

  // Books needing restock: available 0 AND has waiting reservations
  const needsRestock = state.books.filter((b) => {
    if (b.availableCopies > 0) return false;
    const waitingRes = state.reservations.filter(
      (r) => r.bookId === b.id && r.status === ReservationStatus.WAITING
    );
    return waitingRes.length > 0;
  });

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (requestedCopies < 1 || requestedCopies > 20) {
      showToast('Copies must be between 1 and 20', 'error');
      return;
    }
    requestRestock(selectedBookId, requestedCopies, reason);
    showToast('Restock request submitted successfully', 'success');
    setIsModalOpen(false);
    setSelectedBookId('');
    setRequestedCopies(1);
    setReason('');
  };

  const openRequestModal = (bookId: string) => {
    setSelectedBookId(bookId);
    setRequestedCopies(1);
    setReason('');
    setIsModalOpen(true);
  };

  const handleApprove = (id: string) => {
    approveRestock(id);
    showToast('Restock request approved', 'success');
  };

  const handleReceive = (id: string) => {
    receiveRestock(id);
    showToast('Restock copies received and added to inventory', 'success');
  };

  const Pipeline: React.FC<{ status: RestockRequest['status'] }> = ({ status }) => {
    const steps = [
      { id: RestockStatus.REQUESTED, label: 'Requested', color: 'bg-yellow-500' },
      { id: RestockStatus.APPROVED, label: 'Approved', color: 'bg-blue-500' },
      { id: RestockStatus.ORDERED, label: 'Ordered', color: 'bg-purple-500' },
      { id: RestockStatus.RECEIVED, label: 'Received', color: 'bg-green-500' },
    ];

    const currentIndex = steps.findIndex((s) => s.id === status);
    const isRejected = status === RestockStatus.REJECTED;

    if (isRejected) {
      return (
        <div className="flex items-center gap-2 text-red-500">
          <XCircle size={18} />
          <span className="text-sm font-medium">Rejected</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        {steps.map((step, idx) => (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center">
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 ${
                  idx <= currentIndex ? `${step.color} border-transparent` : 'border-gray-300 bg-white'
                }`}
                title={step.label}
              />
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`w-4 h-0.5 ${
                  idx < currentIndex ? 'bg-gray-400' : 'bg-gray-200'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const activeRequests = state.restockRequests || [];
  const stats = {
    total: activeRequests.length,
    pending: activeRequests.filter((r) => r.status === RestockStatus.REQUESTED).length,
    inTransit: activeRequests.filter((r) => r.status === RestockStatus.ORDERED).length,
    completed: activeRequests.filter((r) => r.status === RestockStatus.RECEIVED).length,
  };

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
          <Package className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Restock Management</h1>
          <p className="text-sm text-gray-500">Track replenishment workflows and high-demand inventory</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Total Requests</div>
          <div className="text-2xl font-semibold text-gray-900">{stats.total}</div>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Pending Approval</div>
          <div className="text-2xl font-semibold text-amber-600">{stats.pending}</div>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">In Transit</div>
          <div className="text-2xl font-semibold text-purple-600">{stats.inTransit}</div>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">Completed</div>
          <div className="text-2xl font-semibold text-emerald-600">{stats.completed}</div>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-bold mb-4 text-gray-800">Restock Alerts (High Demand)</h2>
        {needsRestock.length === 0 ? (
          <div className="p-6 bg-white rounded-xl border border-gray-100 text-center text-gray-500">
            No books currently require emergency restocking.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {needsRestock.map((book) => {
              const resCount = state.reservations.filter(
                (r) => r.bookId === book.id && r.status === ReservationStatus.WAITING
              ).length;
              return (
                <div key={book.id} className="p-5 bg-white rounded-xl border border-rose-200 shadow-sm flex flex-col gap-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-1.5 h-full bg-rose-500" />
                  <div className="flex items-center gap-2 text-rose-600">
                    <AlertTriangle size={18} />
                    <span className="font-semibold text-sm">High Hold Demand</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 line-clamp-1">{book.title}</h3>
                    <div className="text-sm text-gray-600 mt-1">
                      0 available copies • <span className="font-semibold text-rose-600">{resCount}</span> waiting holds
                    </div>
                  </div>
                  <button
                    onClick={() => openRequestModal(book.id)}
                    className="mt-auto px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg transition-colors text-sm font-medium"
                  >
                    Request Restock
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold mb-4 text-gray-800">Restock Request Pipeline</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-4 text-xs font-semibold uppercase text-gray-500">ID</th>
                <th className="p-4 text-xs font-semibold uppercase text-gray-500">Book</th>
                <th className="p-4 text-xs font-semibold uppercase text-gray-500">Req / Cur</th>
                <th className="p-4 text-xs font-semibold uppercase text-gray-500">Reason</th>
                <th className="p-4 text-xs font-semibold uppercase text-gray-500">Status</th>
                <th className="p-4 text-xs font-semibold uppercase text-gray-500">Date</th>
                <th className="p-4 text-xs font-semibold uppercase text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activeRequests.map((req) => {
                const book = state.books.find((b) => b.id === req.bookId);
                return (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="p-4 text-sm text-gray-500 font-mono">{req.id.slice(0, 8)}</td>
                    <td className="p-4 text-sm font-medium text-gray-900 line-clamp-1 max-w-[200px]">
                      {book?.title || req.bookTitle || 'Unknown Book'}
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      <span className="font-semibold text-gray-900">{req.requestedCopies}</span> / {req.currentCopies}
                    </td>
                    <td className="p-4 text-sm text-gray-600 max-w-[150px] truncate" title={req.reason}>
                      {req.reason}
                    </td>
                    <td className="p-4">
                      <Pipeline status={req.status} />
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                      {formatDate(req.requestedAt)}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {req.status === RestockStatus.REQUESTED && (
                        <button
                          onClick={() => handleApprove(req.id)}
                          className="px-3 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md"
                        >
                          Approve
                        </button>
                      )}
                      {(req.status === RestockStatus.APPROVED || req.status === RestockStatus.ORDERED) && (
                        <button
                          onClick={() => handleReceive(req.id)}
                          className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
                        >
                          Mark Received
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {activeRequests.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    No active restock requests.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Request Book Restock">
        <form onSubmit={handleSubmitRequest} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Copies to Request</label>
            <input
              type="number"
              min="1"
              max="20"
              value={requestedCopies}
              onChange={(e) => setRequestedCopies(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3}
              placeholder="e.g. High waitlist demand, semester reserve..."
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
            >
              Submit Request
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
