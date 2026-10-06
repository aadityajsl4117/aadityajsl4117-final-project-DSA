import React from 'react';
import { useLibrary } from '../../hooks/useLibrary';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

export const Analytics: React.FC = () => {
  const { state } = useLibrary();

  // Mock data derived for charts
  const borrowingData = [
    { name: 'Jan', borrows: 400 },
    { name: 'Feb', borrows: 300 },
    { name: 'Mar', borrows: 550 },
    { name: 'Apr', borrows: 480 },
    { name: 'May', borrows: 600 },
    { name: 'Jun', borrows: 700 },
  ];

  const popularBooks = state.books.slice(0, 5).map(b => ({
    name: b.title.substring(0, 15) + '...',
    borrows: Math.floor(Math.random() * 50) + 10
  }));

  const categoryData = [
    { name: 'Fiction', value: 400 },
    { name: 'Science', value: 300 },
    { name: 'History', value: 300 },
    { name: 'Technology', value: 200 },
  ];
  const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6 w-full">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Library Analytics</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Borrowing Trends</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={borrowingData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{ stroke: '#f3f4f6', strokeWidth: 2 }} />
                <Line type="monotone" dataKey="borrows" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Most Borrowed Books</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={popularBooks} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} style={{ fontSize: '12px' }} />
                <Tooltip cursor={{ fill: '#f3f4f6' }} />
                <Bar dataKey="borrows" fill="#06b6d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Category Distribution</h3>
          <div className="h-72">
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
      </div>
    </div>
  );
};
