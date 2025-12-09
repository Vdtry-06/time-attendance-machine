import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Download, Search, Plus, Clock } from 'lucide-react';
import { Button, Card, Input, Badge, Table, LoadingSpinner, Modal } from '../components/ui';
import { recordService, employeeService } from '../services';
import { formatDate, formatTime, getDayOfWeek } from '../utils/dateUtils';
import { getStatusColor, getStatusText } from '../utils/helpers';
import toast from 'react-hot-toast';

const ManualCheckinModal = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    employeeId: '',
    fingerprintId: '',
    isCheckIn: '1',
    device: 'Manual',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
  });

  // Fetch employees
  const { data: employeesResponse } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeService.getAll(),
    enabled: isOpen,
  });

  const employees = employeesResponse?.data || [];

  const mutation = useMutation({
    mutationFn: (data) => {
      // Combine date and time to ISO format
      const datetime = `${data.date} ${data.time}:00`;
      
      return recordService.createManual({
        employee_id: parseInt(data.employeeId),
        check_time: datetime,
        isCheckIn: parseInt(data.isCheckIn),
      });
    },
    onSuccess: (response) => {
      toast.success('Chấm công bù thành công');
      queryClient.invalidateQueries(['records']);
      onClose();
      setFormData({
        employeeId: '',
        fingerprintId: '',
        isCheckIn: '1',
        device: 'Manual',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
      });
    },
    onError: (error) => {
      toast.error(error.message || 'Có lỗi xảy ra');
    },
  });

  const handleEmployeeChange = (e) => {
    const employeeId = e.target.value;
    const employee = employees.find(emp => emp.id === parseInt(employeeId));
    setFormData({
      ...formData,
      employeeId,
      fingerprintId: employee?.fingerPrint || '',
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.fingerprintId) {
      toast.error('Vui lòng chọn nhân viên có dữ liệu vân tay');
      return;
    }
    
    mutation.mutate(formData);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Chấm công bù"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} loading={mutation.isPending}>
            Chấm công
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nhân viên <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.employeeId}
            onChange={handleEmployeeChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            required
          >
            <option value="">Chọn nhân viên...</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} - {emp.position || 'Nhân viên'}
                {!emp.fingerPrint && ' (Chưa có vân tay)'}
              </option>
            ))}
          </select>
          {formData.employeeId && !formData.fingerprintId && (
            <p className="text-sm text-red-500 mt-1">
              Nhân viên này chưa đăng ký vân tay
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Loại chấm công <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="isCheckIn"
                value="1"
                checked={formData.isCheckIn === '1'}
                onChange={(e) => setFormData({ ...formData, isCheckIn: e.target.value })}
                className="mr-2"
              />
              <div>
                <p className="font-medium text-gray-900">Check-in</p>
                <p className="text-xs text-gray-500">Vào làm</p>
              </div>
            </label>
            <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="isCheckIn"
                value="0"
                checked={formData.isCheckIn === '0'}
                onChange={(e) => setFormData({ ...formData, isCheckIn: e.target.value })}
                className="mr-2"
              />
              <div>
                <p className="font-medium text-gray-900">Check-out</p>
                <p className="text-xs text-gray-500">Tan làm</p>
              </div>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            type="date"
            label="Ngày chấm công"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />
          <Input
            type="time"
            label="Giờ chấm công"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            required
          />
        </div>

        <Input
          label="Thiết bị"
          value={formData.device}
          onChange={(e) => setFormData({ ...formData, device: e.target.value })}
          placeholder="Tên thiết bị"
        />

        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Thông tin:</strong> Chấm công{' '}
            <strong>{formData.isCheckIn === '1' ? 'vào' : 'ra'}</strong> sẽ được ghi nhận vào{' '}
            <strong>{new Date(formData.date + 'T' + formData.time).toLocaleString('vi-VN')}</strong>
          </p>
        </div>

        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-sm text-yellow-800">
            <strong>Lưu ý:</strong> Chỉ sử dụng chấm công bù khi nhân viên quên chấm công.
          </p>
        </div>
      </form>
    </Modal>
  );
};

const Attendance = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
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
        <div className="flex gap-3">
          <Button 
            onClick={() => setIsModalOpen(true)} 
            icon={<Plus className="w-5 h-5" />}
            variant="secondary"
          >
            Chấm công bù
          </Button>
          <Button onClick={handleExport} icon={<Download className="w-5 h-5" />}>
            Xuất báo cáo
          </Button>
        </div>
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

      {/* Manual Checkin Modal */}
      <ManualCheckinModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
};

export default Attendance;
