import { useQuery } from '@tanstack/react-query';
import { Users, UserCheck, UserX, Clock } from 'lucide-react';
import { Card, Badge, LoadingSpinner } from '../components/ui';
import { employeeService, recordService } from '../services';
import { formatNumber } from '../utils/helpers';
import { formatDate, formatTime } from '../utils/dateUtils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const StatCard = ({ title, value, icon: Icon, color = 'primary' }) => {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };

  return (
    <Card hover>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-4 rounded-xl ${colorClasses[color]}`}>
          <Icon className="w-8 h-8" />
        </div>
      </div>
    </Card>
  );
};

const Dashboard = () => {
  // Fetch employees
  const { data: employeesResponse, isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeService.getAll(),
  });

  // Fetch today's records
  const { data: todayResponse, isLoading: loadingToday } = useQuery({
    queryKey: ['today-records'],
    queryFn: () => recordService.getTodayRecords(),
  });

  // Fetch statistics
  const { data: statsResponse, isLoading: loadingStats } = useQuery({
    queryKey: ['records-statistics'],
    queryFn: () => recordService.getStatistics(),
  });

  if (loadingEmployees || loadingToday || loadingStats) {
    return <LoadingSpinner size="lg" text="Đang tải dữ liệu..." />;
  }

  const employees = employeesResponse?.data || [];
  const todayRecords = todayResponse?.data || [];
  const stats = statsResponse?.summary || {};

  // Calculate today statistics
  const checkIns = todayRecords.filter(r => r.isCheckIn === 1).length;
  const checkOuts = todayRecords.filter(r => r.isCheckIn === 0).length;
  const uniqueEmployees = new Set(todayRecords.map(r => r.employee_id)).size;

  // Chart data from statistics
  const weeklyData = stats.by_day?.slice(0, 7).map(day => ({
    day: new Date(day.date).toLocaleDateString('vi-VN', { weekday: 'short' }),
    checkins: day.check_ins || 0,
    checkouts: day.check_outs || 0,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tổng quan</h1>
        <p className="text-gray-600 mt-2">Thống kê và báo cáo chấm công hôm nay</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Tổng nhân viên"
          value={formatNumber(employees.length)}
          icon={Users}
          color="primary"
        />
        <StatCard
          title="Đã chấm công hôm nay"
          value={formatNumber(uniqueEmployees)}
          icon={UserCheck}
          color="green"
        />
        <StatCard
          title="Check-in hôm nay"
          value={formatNumber(checkIns)}
          icon={Clock}
          color="yellow"
        />
        <StatCard
          title="Check-out hôm nay"
          value={formatNumber(checkOuts)}
          icon={UserX}
          color="red"
        />
      </div>

      {/* Charts */}
      {weeklyData.length > 0 && (
        <Card title="Chấm công tuần này">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="checkins" fill="#10b981" name="Check-in" />
              <Bar dataKey="checkouts" fill="#ef4444" name="Check-out" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Recent attendance */}
      <Card 
        title="Chấm công gần đây" 
        subtitle="Cập nhật realtime"
      >
        <div className="space-y-4">
          {todayRecords.slice(0, 10).map((record, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-700 font-semibold text-lg">
                    {record.employee_name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{record.employee_name}</p>
                  <p className="text-sm text-gray-500">{record.position || 'Nhân viên'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Thời gian</p>
                  <p className="font-medium text-gray-900">{formatTime(new Date(record.time))}</p>
                </div>
                <Badge variant={record.isCheckIn === 1 ? 'success' : 'info'}>
                  {record.isCheckIn === 1 ? 'Vào' : 'Ra'}
                </Badge>
                {record.device && (
                  <span className="text-xs text-gray-500">{record.device}</span>
                )}
              </div>
            </div>
          ))}
          {todayRecords.length === 0 && (
            <p className="text-center text-gray-500 py-8">Chưa có dữ liệu chấm công hôm nay</p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
