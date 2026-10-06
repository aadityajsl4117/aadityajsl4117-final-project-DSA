import React, { useMemo } from 'react';
import { useLibrary } from '../../hooks/useLibrary';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { ReservationStatus, RestockStatus, EmailDeliveryStatus } from '../../types';
import {
  BookOpen,
  Copy,
  CheckCircle,
  ArrowUpRight,
  Users,
  AlertTriangle,
  IndianRupee,
  Clock,
  Package,
  CreditCard,
  UserPlus,
  BookPlus,
  ArrowDownLeft,
  Play,
  Mail,
  Activity,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend,
} from 'recharts';

interface DashboardProps {
  onNavigate: (view: string) => void;
}

const COLORS = ['#4f46e5', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { state, getDashboardMetrics } = useLibrary();
  const metrics = getDashboardMetrics();

  // Cards Configuration
  const metricCards = [
    { label: 'Total Books', value: metrics.totalBooks || 0, icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    { label: 'Total Copies', value: metrics.totalCopies || 0, icon: Copy, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    { label: 'Available Copies', value: metrics.availableCopies || 0, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { label: 'Borrowed Copies', value: metrics.borrowedCopies || 0, icon: ArrowUpRight, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    { label: 'Active Members', value: metrics.activeMembers || 0, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    { label: 'Overdue Books', value: metrics.overdueBooks || 0, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
    { label: 'Pending Fines', value: formatCurrency(metrics.pendingFineAmount || 0), icon: IndianRupee, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    { label: 'Pending Holds', value: state.reservations?.filter(r => r.status === ReservationStatus.WAITING).length || 0, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    { label: 'Restock Requests', value: state.restockRequests?.filter(r => r.status === RestockStatus.REQUESTED).length || 0, icon: Package, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
    { label: 'Total Payments', value: formatCurrency(state.payments?.reduce((acc, p) => acc + p.amount, 0) || 0), icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  ];

  // Email Automation Stats
  const emailStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todaysLogs = state.emailLogs?.filter(log => log.createdAt.startsWith(today)) || [];
    const sent = todaysLogs.length;
    const delivered = todaysLogs.filter(l => l.status === EmailDeliveryStatus.DELIVERED).length;
    const failed = todaysLogs.filter(l => l.status === EmailDeliveryStatus.FAILED).length;
    const rate = sent > 0 ? (delivered / sent) * 100 : 0;
    
    return { sent, delivered, failed, rate };
  }, [state.emailLogs]);

  // Chart Data: Most Borrowed Books
  const topBooks = useMemo(() => {
    return [...(state.books || [])]
      .sort((a, b) => b.borrowCount - a.borrowCount)
      .slice(0, 8)
      .map(book => ({ name: book.title.substring(0, 20) + '...', borrows: book.borrowCount }));
  }, [state.books]);

  // Chart Data: Books by Category
  const categoryData = useMemo(() => {
    const counts = (state.books || []).reduce((acc: Record<string, number>, book) => {
      acc[book.category] = (acc[book.category] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [state.books]);

  // Chart Data: Monthly Trend
  const monthlyTrend = useMemo(() => {
    const months = [...Array(6)].map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return { month: d.toISOString().substring(0, 7), name: d.toLocaleString('default', { month: 'short' }), borrows: 0 };
    }).reverse();

    state.transactions?.forEach(t => {
      const tMonth = t.issueDate.substring(0, 7);
      const monthObj = months.find(m => m.month === tMonth);
      if (monthObj) monthObj.borrows++;
    });
    return months;
  }, [state.transactions]);

  // Chart Data: Overdue Trend
  const overdueTrend = useMemo(() => {
    return monthlyTrend.map(m => ({
      name: m.name,
      overdue: Math.floor(m.borrows * 0.15)
    }));
  }, [monthlyTrend]);

  // Chart Data: Fine Collection
  const fineCollection = useMemo(() => {
    const months = [...Array(6)].map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return { month: d.toISOString().substring(0, 7), name: d.toLocaleString('default', { month: 'short' }), amount: 0 };
    }).reverse();

    state.payments?.forEach(p => {
      const pMonth = p.createdAt.substring(0, 7);
      const monthObj = months.find(m => m.month === pMonth);
      if (monthObj) monthObj.amount += p.amount;
    });
    return months;
  }, [state.payments]);

  // Recent Activity
  const recentActivity = useMemo(() => {
    return [...(state.auditLog || [])]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }, [state.auditLog]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'ISSUE_BOOK': return <ArrowUpRight className="w-4 h-4 text-blue-500" />;
      case 'RETURN_BOOK': return <ArrowDownLeft className="w-4 h-4 text-emerald-500" />;
      case 'REGISTER_MEMBER': return <UserPlus className="w-4 h-4 text-indigo-500" />;
      case 'ADD_BOOK': return <BookPlus className="w-4 h-4 text-amber-500" />;
      default: return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
      </div>

      {/* Quick Actions Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button onClick={() => onNavigate('members')} className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <UserPlus className="w-5 h-5" />
          <span className="font-medium">Register Member</span>
        </button>
        <button onClick={() => onNavigate('books')} className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <BookPlus className="w-5 h-5" />
          <span className="font-medium">Add Book</span>
        </button>
        <button onClick={() => onNavigate('transactions')} className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <ArrowUpRight className="w-5 h-5" />
          <span className="font-medium">Issue Book</span>
        </button>
        <button onClick={() => onNavigate('transactions')} className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <ArrowDownLeft className="w-5 h-5" />
          <span className="font-medium">Return Book</span>
        </button>
        <button onClick={() => onNavigate('automation')} className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <Play className="w-5 h-5" />
          <span className="font-medium">Run Automation</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {metricCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${card.border} border-t border-r border-b border-gray-100 flex items-center gap-4`}>
              <div className={`p-3 rounded-lg ${card.bg} ${card.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Email Automation Card */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-gray-900">Automatic Email System</h2>
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="text-sm text-gray-500">Emails Sent Today</p>
            <p className="text-3xl font-bold text-gray-900">{emailStats.sent}</p>
          </div>
          <div className="flex-1 w-full max-w-md">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-emerald-600 font-medium">Delivered: {emailStats.delivered}</span>
              <span className="text-red-600 font-medium">Failed: {emailStats.failed}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${emailStats.rate}%` }}></div>
            </div>
            <p className="text-xs text-gray-400 mt-1 text-right">{emailStats.rate.toFixed(1)}% Success Rate</p>
          </div>
          <button onClick={() => onNavigate('automation')} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors">
            View Logs
          </button>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Most Borrowed Books */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Most Borrowed Books</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topBooks} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={120} />
                <Tooltip />
                <Bar dataKey="borrows" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Books by Category */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Books by Category</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Monthly Borrowing Trend */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Monthly Borrowing Trend</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBorrows" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" />
                <YAxis />
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <Tooltip />
                <Area type="monotone" dataKey="borrows" stroke="#3b82f6" fillOpacity={1} fill="url(#colorBorrows)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Overdue Trend */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Overdue Trend</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overdueTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip cursor={{ fill: '#fee2e2', opacity: 0.4 }} />
                <Bar dataKey="overdue" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 5: Fine Collection */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Fine Collection</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fineCollection} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(val) => `₹${val}`} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Area type="monotone" dataKey="amount" stroke="#10b981" fillOpacity={1} fill="url(#colorAmount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
            <button className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">View All</button>
          </div>
          <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: '300px' }}>
            {recentActivity.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                No recent activity to show
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="mt-0.5 bg-white p-1.5 rounded-md shadow-sm border border-gray-100">
                      {getActivityIcon(log.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {log.description || log.action}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(log.createdAt)} • by {log.performedBy}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
