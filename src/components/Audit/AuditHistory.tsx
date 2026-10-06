import React, { useState, useMemo } from 'react';
import {
  UserPlus, UserCog, UserCheck, ArrowUpRight, ArrowDownLeft,
  AlertTriangle, CreditCard, Clock, Mail, MailX, Zap,
  Activity, Shield, ChevronDown, ChevronUp
} from 'lucide-react';
import { useLibrary } from '../../hooks/useLibrary';
import { AuditAction, AuditEntry } from '../../types';
import { formatDateTime } from '../../utils/helpers';
import { StatusBadge, SearchBar, EmptyState } from '../common';

const getActionIcon = (action: AuditAction) => {
  switch (action) {
    case AuditAction.REGISTER_MEMBER: return <UserPlus className="w-4 h-4 text-indigo-500" />;
    case AuditAction.UPDATE_MEMBER: return <UserCog className="w-4 h-4 text-indigo-500" />;
    case AuditAction.VERIFY_MEMBER: return <UserCheck className="w-4 h-4 text-emerald-500" />;
    case AuditAction.ISSUE_BOOK: return <ArrowUpRight className="w-4 h-4 text-amber-500" />;
    case AuditAction.RETURN_BOOK: return <ArrowDownLeft className="w-4 h-4 text-emerald-500" />;
    case AuditAction.CREATE_FINE: return <AlertTriangle className="w-4 h-4 text-rose-500" />;
    case AuditAction.PAY_FINE:
    case AuditAction.PAYMENT_RECEIVED: return <CreditCard className="w-4 h-4 text-emerald-500" />;
    case AuditAction.CREATE_RESERVATION:
    case AuditAction.PROMOTE_RESERVATION: return <Clock className="w-4 h-4 text-purple-500" />;
    case AuditAction.EMAIL_SENT: return <Mail className="w-4 h-4 text-blue-500" />;
    case AuditAction.EMAIL_FAILED: return <MailX className="w-4 h-4 text-rose-500" />;
    case AuditAction.AUTOMATION_RUN: return <Zap className="w-4 h-4 text-amber-500" />;
    default: return <Activity className="w-4 h-4 text-gray-500" />;
  }
};

export const AuditHistory: React.FC = () => {
  const { state } = useLibrary();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState<AuditAction | 'ALL'>('ALL');
  const [selectedResult, setSelectedResult] = useState<'ALL' | 'SUCCESS' | 'FAILURE'>('ALL');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const logs = state.auditLog || [];

  const filteredLogs = useMemo(() => {
    return logs.filter((log: AuditEntry) => {
      const matchesSearch =
        log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.entityId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.performedBy.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesAction = selectedAction === 'ALL' || log.action === selectedAction;
      const matchesResult = selectedResult === 'ALL' || log.result === selectedResult;

      return matchesSearch && matchesAction && matchesResult;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [logs, searchTerm, selectedAction, selectedResult]);

  const stats = useMemo(() => {
    const total = logs.length;
    const today = new Date().toISOString().split('T')[0];
    const todayCount = logs.filter(l => l.createdAt.startsWith(today)).length;
    const successCount = logs.filter(l => l.result === 'SUCCESS').length;
    const successRate = total > 0 ? Math.round((successCount / total) * 100) : 100;
    return { total, todayCount, successRate };
  }, [logs]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-7 h-7 text-indigo-600" />
          System Audit Trail
        </h1>
        <p className="text-sm text-gray-500">Immutable chronological history of all autonomous and staff actions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Total Audit Entries</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100">
          <p className="text-xs font-semibold uppercase text-indigo-600 mb-1">Actions Executed Today</p>
          <p className="text-2xl font-bold text-indigo-700">{stats.todayCount}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100">
          <p className="text-xs font-semibold uppercase text-emerald-600 mb-1">Success Rate</p>
          <p className="text-2xl font-bold text-emerald-700">{stats.successRate}%</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="w-full md:w-80">
            <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search audit description, entity ID..." />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="ALL">All Actions</option>
              {Object.values(AuditAction).map((act) => (
                <option key={act} value={act}>{act}</option>
              ))}
            </select>
            <select
              value={selectedResult}
              onChange={(e) => setSelectedResult(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="ALL">All Results</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILURE">Failure</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Action Type</th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Description</th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Actor</th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Result</th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Timestamp</th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12">
                    <EmptyState title="No audit entries found" description="Actions performed in the system will appear here." icon={Shield} />
                  </td>
                </tr>
              ) : (
                filteredLogs.map((entry) => {
                  const isExpanded = expandedRow === entry.id;
                  return (
                    <React.Fragment key={entry.id}>
                      <tr className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {getActionIcon(entry.action)}
                            <span className="text-xs font-semibold text-gray-800">{entry.action}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-800 font-medium max-w-sm truncate">
                          {entry.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                          {entry.performedBy}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={entry.result} size="sm" />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                          {formatDateTime(entry.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          {(entry.oldValue || entry.newValue) && (
                            <button
                              onClick={() => setExpandedRow(isExpanded ? null : entry.id)}
                              className="text-indigo-600 hover:text-indigo-800 text-xs font-medium inline-flex items-center gap-1"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Diff
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50/50">
                          <td colSpan={6} className="px-6 py-3 text-xs">
                            <div className="grid grid-cols-2 gap-4 bg-white p-3 rounded-lg border border-gray-200">
                              <div>
                                <span className="font-semibold text-gray-500 block mb-1">Old State:</span>
                                <pre className="p-2 bg-gray-50 rounded text-gray-700 font-mono text-xs overflow-x-auto">
                                  {entry.oldValue || '(None)'}
                                </pre>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-500 block mb-1">New State:</span>
                                <pre className="p-2 bg-gray-50 rounded text-gray-700 font-mono text-xs overflow-x-auto">
                                  {entry.newValue || '(None)'}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default AuditHistory;
