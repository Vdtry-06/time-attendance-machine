import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Download, Search } from 'lucide-react';
import { Button, Card, Input, Badge, Table, LoadingSpinner } from '../components/ui';
import { recordService } from '../services';
import { formatDate, formatTime, getDayOfWeek } from '../utils/dateUtils';
import { getStatusColor, getStatusText } from '../utils/helpers';
import toast from 'react-hot-toast';

const Attendance = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });

  // Fetch attendance records
  const { data: response, isLoading } = useQuery({
    queryKey: ['records', dateRange, searchTerm],
    queryFn: () => recordService.getAll({
      start_date: dateRange.start_date,
      end_date: dateRange.end_date,
    }),
  });

  const records = response?.data || [];

  const handleExport = () => {
    toast.success('Tính năng xuất báo cáo đang được phát triển');
  };

  const columns = [
    {
      header: 'Ngày',
      cell: (row) => (
        <div>
          <p className="font-medium text-gray-900">{formatDate(new Date(row.time))}</p>
          <p className="text-sm text-gray-500">{getDayOfWeek(new Date(row.time))}</p>
        </div>
      ),
    },
    {
      header: 'Nhân viên',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-primary-700 font-semibold">
              {row.employee_name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{row.employee_name}</p>
            <p className="text-sm text-gray-500">{row.position || 'Nhân viên'}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Thời gian',
      cell: (row) => (
        <div>
          <p className="font-medium text-gray-900">{formatTime(new Date(row.time))}</p>
          {row.device && <p className="text-xs text-gray-500">{row.device}</p>}
        </div>
      ),
    },
    {
      header: 'Loại',
      cell: (row) => (
        <Badge variant={row.isCheckIn === 1 ? 'success' : 'info'}>
          {row.isCheckIn === 1 ? 'Vào' : 'Ra'}
        </Badge>
      ),
    },
    {
      header: 'Ghi chú',
      cell: (row) => (
        <p className="text-sm text-gray-600">{row.note || '-'}</p>
      ),
    },
    {
      header: 'Hình ảnh',
      cell: (row) => (
        row.imagePath ? (
          <img 
            src={row.imagePath} 
            alt="Check-in" 
            className="w-12 h-12 rounded object-cover cursor-pointer hover:scale-110 transition-transform"
            onClick={() => window.open(row.imagePath, '_blank')}
          />
        ) : (
          <span className="text-gray-400 text-sm">Không có</span>
        )
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Chấm công</h1>
          <p className="text-gray-600 mt-2">Theo dõi thời gian làm việc của nhân viên</p>
        </div>
        <Button onClick={handleExport} icon={<Download className="w-5 h-5" />}>
          Xuất báo cáo
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            type="date"
            label="Từ ngày"
            value={dateRange.start_date}
            onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
          />
          
          <Input
            type="date"
            label="Đến ngày"
            value={dateRange.end_date}
            onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
          />
          
          <Button 
            variant="outline" 
            onClick={() => setDateRange({
              start_date: new Date().toISOString().split('T')[0],
              end_date: new Date().toISOString().split('T')[0],
            })}
            className="mt-7"
          >
            Hôm nay
          </Button>
        </div>
      </Card>

      {/* Attendance table */}
      <Card>
        <Table
          columns={columns}
          data={records}
          loading={isLoading}
          emptyMessage="Không có dữ liệu chấm công"
        />
        {response?.pagination && (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span>
              Hiển thị {records.length} / {response.pagination.total} bản ghi
            </span>
            <span>
              Trang {response.pagination.page} / {response.pagination.totalPages}
            </span>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Attendance;
