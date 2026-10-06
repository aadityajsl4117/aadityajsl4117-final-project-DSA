import React, { useState, useMemo } from 'react';
import { useLibrary } from '../../hooks/useLibrary';
import { useToast } from '../common/Toast';
import { SearchBar, StatusBadge, EmptyState, Modal } from '../common';
import { formatDateTime, formatCurrency } from '../../utils/helpers';
import { Fine, Payment, PaymentMethod, FineStatus } from '../../types';
import { DollarSign, CreditCard, QrCode, FileText } from 'lucide-react';

export const Fines: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'FINES' | 'PAYMENTS'>('FINES');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fines & Payment Processing</h1>
        <p className="text-sm text-gray-500">Autonomous overdue fines calculation, digital collections, and receipts</p>
      </div>

      <div className="flex border-b border-gray-200">
        <button
          className={`px-6 py-3 font-semibold text-sm transition-colors ${
            activeTab === 'FINES' ? 'border-b-2 border-rose-600 text-rose-600' : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('FINES')}
        >
          Overdue Fines
        </button>
        <button
          className={`px-6 py-3 font-semibold text-sm transition-colors ${
            activeTab === 'PAYMENTS' ? 'border-b-2 border-rose-600 text-rose-600' : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('PAYMENTS')}
        >
          Payment Transactions
        </button>
      </div>
      {activeTab === 'FINES' ? <FinesTab /> : <PaymentsTab />}
    </div>
  );
};

const FinesTab: React.FC = () => {
  const { state, payFine } = useLibrary();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('PENDING');
  const [selectedFine, setSelectedFine] = useState<Fine | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredFines = useMemo(() => {
    let result = state.fines;
    if (filter !== 'ALL') {
      result = result.filter((f) => f.status === filter);
    }
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (f) =>
          f.id.toLowerCase().includes(lower) ||
          f.memberName.toLowerCase().includes(lower) ||
          f.bookTitle.toLowerCase().includes(lower) ||
          f.memberId.toLowerCase().includes(lower)
      );
    }
    return result;
  }, [state.fines, search, filter]);

  const totalPending = state.fines
    .filter((f) => f.status === FineStatus.PENDING)
    .reduce((sum, f) => sum + f.amount, 0);

  const handlePayment = async () => {
    if (!selectedFine) return;
    setIsProcessing(true);
    try {
      const res = await payFine(selectedFine.id, paymentMethod);
      if (res.success) {
        showToast('Payment confirmed! Receipt emailed to patron.', 'success');
        setSelectedFine(null);
      } else {
        showToast(res.error || 'Payment failed', 'error');
      }
    } catch {
      showToast('Payment failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-rose-100 flex items-center gap-4">
          <div className="bg-rose-50 p-3.5 rounded-xl text-rose-600">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Pending Fines</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalPending)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <div className="w-full sm:w-80">
            <SearchBar value={search} onChange={setSearch} placeholder="Search fines by Patron or Book..." />
          </div>
          <div className="flex gap-2">
            {(['ALL', 'PENDING', 'PAID'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filter === f ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Patron</th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Overdue Book</th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Amount</th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Days Late</th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Status</th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredFines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12">
                    <EmptyState title="No fines found" description="There are no fines matching this filter." icon={DollarSign} />
                  </td>
                </tr>
              ) : (
                filteredFines.map((fine) => (
                  <tr key={fine.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900 text-sm">{fine.memberName}</div>
                      <div className="text-xs text-gray-400 font-mono">{fine.memberId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {fine.bookTitle}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900 text-sm">
                      {formatCurrency(fine.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {fine.daysOverdue} days
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={fine.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      {fine.status === FineStatus.PENDING && (
                        <button
                          onClick={() => setSelectedFine(fine)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition shadow-sm"
                        >
                          Collect Payment
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

      <Modal isOpen={!!selectedFine} onClose={() => !isProcessing && setSelectedFine(null)} title="Collect Fine Payment">
        {selectedFine && (
          <div className="space-y-6 py-2">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-500 text-sm">Amount Outstanding</span>
                <span className="text-2xl font-bold text-gray-900">{formatCurrency(selectedFine.amount)}</span>
              </div>
              <div className="text-xs text-gray-600 space-y-1">
                <p>Patron: <strong>{selectedFine.memberName}</strong> ({selectedFine.memberId})</p>
                <p>Book: <strong>{selectedFine.bookTitle}</strong> ({selectedFine.daysOverdue} days overdue)</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-700 mb-2">Payment Method</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod(PaymentMethod.CASH)}
                  className={`p-3 border rounded-xl flex flex-col items-center gap-1.5 transition ${
                    paymentMethod === PaymentMethod.CASH ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  <DollarSign className="w-5 h-5" /> Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod(PaymentMethod.UPI)}
                  className={`p-3 border rounded-xl flex flex-col items-center gap-1.5 transition ${
                    paymentMethod === PaymentMethod.UPI ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  <QrCode className="w-5 h-5" /> UPI / QR
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod(PaymentMethod.ONLINE)}
                  className={`p-3 border rounded-xl flex flex-col items-center gap-1.5 transition ${
                    paymentMethod === PaymentMethod.ONLINE ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  <CreditCard className="w-5 h-5" /> Online
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                disabled={isProcessing}
                onClick={() => setSelectedFine(null)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={isProcessing}
                onClick={handlePayment}
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 shadow-sm"
              >
                {isProcessing ? 'Recording...' : 'Confirm Receipt'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const PaymentsTab: React.FC = () => {
  const { state } = useLibrary();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-bold mb-4 text-gray-800">Financial Circulation Ledger</h3>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Date</th>
              <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Payment ID</th>
              <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Patron</th>
              <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Amount</th>
              <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Method</th>
              <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {state.payments && state.payments.length > 0 ? (
              state.payments.map((p: Payment) => (
                <tr key={p.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateTime(p.createdAt)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-900">{p.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{p.memberName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-emerald-600">{formatCurrency(p.amount)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold">{p.method}</td>
                  <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={p.status} size="sm" /></td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12">
                  <EmptyState title="No payments recorded" description="No fine collections have occurred yet." icon={FileText} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default Fines;
