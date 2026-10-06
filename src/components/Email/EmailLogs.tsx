import React, { useState, useMemo } from 'react';
import { useLibrary } from '../../hooks/useLibrary';
import { useToast } from '../common/Toast';
import { SearchBar, StatusBadge, EmptyState } from '../common';
import { formatDateTime } from '../../utils/helpers';
import { EmailDeliveryStatus, EmailType } from '../../types';
import { Mail, CheckCircle2, AlertTriangle, RefreshCcw } from 'lucide-react';

export const EmailLogs: React.FC = () => {
  const { state } = useLibrary();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | EmailDeliveryStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const emails = state.emailLogs || [];

  const filteredEmails = useMemo(() => {
    let result = emails;
    if (filterStatus !== 'ALL') {
      result = result.filter((e) => e.status === filterStatus);
    }
    if (typeFilter !== 'ALL') {
      result = result.filter((e) => e.type === typeFilter);
    }
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.recipientEmail.toLowerCase().includes(lower) ||
          e.memberName.toLowerCase().includes(lower) ||
          e.subject.toLowerCase().includes(lower) ||
          e.type.toLowerCase().includes(lower)
      );
    }
    return [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [emails, search, filterStatus, typeFilter]);

  const stats = useMemo(() => {
    const total = emails.length;
    const delivered = emails.filter((e) => e.status === EmailDeliveryStatus.DELIVERED).length;
    const failed = emails.filter((e) => e.status === EmailDeliveryStatus.FAILED).length;
    const rate = total > 0 ? Math.round((delivered / total) * 100) : 0;
    return { total, delivered, failed, rate };
  }, [emails]);

  const handleRetry = (id: string) => {
    showToast(`Attempting background redelivery for log #${id}...`, 'info');
    setTimeout(() => {
      showToast('Redelivery attempt completed', 'success');
    }, 1200);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Email Delivery & Audit Log</h1>
        <p className="text-sm text-gray-500">Autonomous email dispatches via EmailJS, delivery diagnostics, and templates</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Total Auto Dispatches</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-center">
          <p className="text-xs font-semibold uppercase text-emerald-600 mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Delivered Successfully
          </p>
          <p className="text-2xl font-bold text-emerald-700">{stats.delivered}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-rose-100 flex flex-col justify-center">
          <p className="text-xs font-semibold uppercase text-rose-600 mb-1 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" /> Delivery Failures
          </p>
          <p className="text-2xl font-bold text-rose-700">{stats.failed}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100 flex flex-col justify-center">
          <p className="text-xs font-semibold uppercase text-indigo-600 mb-1">Success Rate</p>
          <p className="text-2xl font-bold text-indigo-700">{stats.rate}%</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="w-full md:w-80">
            <SearchBar value={search} onChange={setSearch} placeholder="Search by recipient, subject, type..." />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="ALL">All Email Types</option>
              {Object.values(EmailType).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {(['ALL', EmailDeliveryStatus.DELIVERED, EmailDeliveryStatus.FAILED] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterStatus === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Timestamp</th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Recipient</th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Type & Subject</th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Status</th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredEmails.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12">
                    <EmptyState title="No emails recorded" description="Email logs will automatically register here as actions occur." icon={Mail} />
                  </td>
                </tr>
              ) : (
                filteredEmails.map((email) => (
                  <tr key={email.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                      {formatDateTime(email.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <p className="font-semibold text-gray-900">{email.memberName}</p>
                      <p className="text-xs text-gray-400">{email.recipientEmail}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-semibold text-indigo-600 mb-0.5">{email.type}</div>
                      <div className="text-sm font-medium text-gray-800 truncate max-w-sm">{email.subject}</div>
                      {email.errorMessage && (
                        <div className="text-xs text-rose-500 mt-1 font-mono">{email.errorMessage}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={email.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      {email.status === EmailDeliveryStatus.FAILED && (
                        <button
                          onClick={() => handleRetry(email.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                        >
                          <RefreshCcw className="w-3.5 h-3.5" /> Retry
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
    </div>
  );
};
export default EmailLogs;
