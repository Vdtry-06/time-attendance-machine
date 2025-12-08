import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Search, Fingerprint, Mail, Phone, Loader } from 'lucide-react';
import { Button, Card, Modal, Input, Badge, Table, LoadingSpinner } from '../components/ui';
import { employeeService, deviceService } from '../services';
import toast from 'react-hot-toast';
import { formatDate } from '../utils/dateUtils';
import { getStatusColor, getStatusText } from '../utils/helpers';

const EmployeeModal = ({ isOpen, onClose, employee }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(employee || {
    name: '',
    position: '',
    identificationNum: '',
    email: '',
    phoneNum: '',
    fingerPrint: '',
  });
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollStatus, setEnrollStatus] = useState('');

  const mutation = useMutation({
    mutationFn: (data) => employee
      ? employeeService.update(employee.id, data)
      : employeeService.create(data),
    onSuccess: () => {
      toast.success(employee ? 'Cập nhật nhân viên thành công' : 'Thêm nhân viên thành công');
      queryClient.invalidateQueries(['employees']);
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || 'Có lỗi xảy ra');
    },
  });

  // Polling để lấy fingerprint ID sau khi quét
  useEffect(() => {
    let interval;
    if (isEnrolling) {
      interval = setInterval(async () => {
        try {
          // Gọi API để kiểm tra xem đã có fingerprint ID chưa
          const response = await deviceService.getStatus();
          if (response?.data?.lastEnrolledId) {
            setFormData({ ...formData, fingerPrint: response.data.lastEnrolledId });
            setIsEnrolling(false);
            setEnrollStatus('');
            toast.success(`Đã lấy vân tay thành công! ID: ${response.data.lastEnrolledId}`);
          }
        } catch (error) {
          console.error('Error checking enrollment status:', error);
        }
      }, 2000); // Check mỗi 2 giây
    }
    return () => clearInterval(interval);
  }, [isEnrolling, formData]);

  const handleEnrollFingerprint = async () => {
    try {
      setIsEnrolling(true);
      setEnrollStatus('Đang gửi yêu cầu đến thiết bị...');
      
      // Gọi API để bắt đầu quá trình đăng ký vân tay
      await deviceService.enrollFingerprint();
      
      setEnrollStatus('Vui lòng đặt ngón tay lên cảm biến vân tay...');
      toast.info('Vui lòng đặt ngón tay lên cảm biến vân tay', { duration: 5000 });
      
      // Sau 30 giây tự động dừng nếu không có kết quả
      setTimeout(() => {
        if (isEnrolling) {
          setIsEnrolling(false);
          setEnrollStatus('');
          toast.error('Hết thời gian chờ. Vui lòng thử lại.');
        }
      }, 30000);
      
    } catch (error) {
      setIsEnrolling(false);
      setEnrollStatus('');
      toast.error('Không thể kết nối với thiết bị. Vui lòng kiểm tra lại.');
    }
  };

  const handleCancelEnroll = () => {
    setIsEnrolling(false);
    setEnrollStatus('');
    toast.info('Đã hủy quá trình lấy vân tay');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!employee && !formData.fingerPrint) {
      toast.error('Vui lòng lấy vân tay trước khi thêm nhân viên');
      return;
    }
    
    mutation.mutate(formData);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={employee ? 'Cập nhật nhân viên' : 'Thêm nhân viên mới'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} loading={mutation.isPending}>
            {employee ? 'Cập nhật' : 'Thêm mới'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Họ và tên"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
        
        <Input
          label="CCCD/CMND"
          value={formData.identificationNum}
          onChange={(e) => setFormData({ ...formData, identificationNum: e.target.value })}
          placeholder="Số căn cước công dân"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Email"
            type="email"
            icon={<Mail className="w-5 h-5 text-gray-400" />}
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <Input
            label="Số điện thoại"
            icon={<Phone className="w-5 h-5 text-gray-400" />}
            value={formData.phoneNum}
            onChange={(e) => setFormData({ ...formData, phoneNum: e.target.value })}
          />
        </div>

        <Input
          label="Chức vụ"
          value={formData.position}
          onChange={(e) => setFormData({ ...formData, position: e.target.value })}
        />

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Vân tay {!employee && <span className="text-red-500">*</span>}
          </label>
          
          {!formData.fingerPrint ? (
            <div className="space-y-3">
              {!isEnrolling ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleEnrollFingerprint}
                  icon={<Fingerprint className="w-5 h-5" />}
                  className="w-full"
                >
                  Lấy vân tay từ thiết bị
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-center p-4 bg-blue-50 rounded-lg border-2 border-blue-200 border-dashed">
                    <div className="text-center">
                      <Loader className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                      <p className="text-sm font-medium text-blue-900">{enrollStatus}</p>
                      <p className="text-xs text-blue-600 mt-1">Đang chờ quét vân tay...</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCancelEnroll}
                    className="w-full"
                  >
                    Hủy
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Fingerprint className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">Đã có dữ liệu vân tay</p>
                <p className="text-xs text-green-600">Fingerprint ID: {formData.fingerPrint}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setFormData({ ...formData, fingerPrint: '' })}
              >
                Đổi
              </Button>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
};

const Employees = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const queryClient = useQueryClient();

  // Fetch employees
  const { data: employeesResponse, isLoading } = useQuery({
    queryKey: ['employees', searchTerm],
    queryFn: () => searchTerm 
      ? employeeService.search(searchTerm)
      : employeeService.getAll(),
  });

  const employees = employeesResponse?.data || [];

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => employeeService.delete(id),
    onSuccess: () => {
      toast.success('Xóa nhân viên thành công');
      queryClient.invalidateQueries(['employees']);
    },
    onError: (error) => {
      toast.error(error.message || 'Có lỗi xảy ra');
    },
  });

  const handleEdit = (employee) => {
    setSelectedEmployee(employee);
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa nhân viên này?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleAddNew = () => {
    setSelectedEmployee(null);
    setIsModalOpen(true);
  };

  const columns = [
    {
      header: 'STT',
      cell: (row, index) => <span className="font-medium">{index + 1}</span>,
    },
    {
      header: 'Họ và tên',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-primary-700 font-semibold">
              {row.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{row.name}</p>
            <p className="text-sm text-gray-500">{row.email || 'Chưa có email'}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'CCCD',
      accessor: 'identificationNum',
    },
    {
      header: 'Chức vụ',
      cell: (row) => row.position || '-',
    },
    {
      header: 'Số điện thoại',
      cell: (row) => row.phoneNum || '-',
    },
    {
      header: 'Fingerprint ID',
      cell: (row) => (
        row.fingerPrint ? (
          <Badge variant="success">#{row.fingerPrint}</Badge>
        ) : (
          <Badge variant="warning">Chưa đăng ký</Badge>
        )
      ),
    },
    {
      header: 'Thao tác',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleEdit(row)}
            icon={<Edit className="w-4 h-4" />}
          >
            Sửa
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDelete(row.id)}
            icon={<Trash2 className="w-4 h-4 text-red-600" />}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quản lý nhân viên</h1>
          <p className="text-gray-600 mt-2">Quản lý thông tin nhân viên và vân tay</p>
        </div>
        <Button onClick={handleAddNew} icon={<Plus className="w-5 h-5" />}>
          Thêm nhân viên
        </Button>
      </div>

      {/* Search and filters */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Input
              placeholder="Tìm kiếm theo tên nhân viên..."
              icon={<Search className="w-5 h-5 text-gray-400" />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Employee list */}
      <Card>
        <Table
          columns={columns}
          data={employees}
          loading={isLoading}
          emptyMessage="Không tìm thấy nhân viên nào"
        />
      </Card>

      {/* Modal */}
      <EmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        employee={selectedEmployee}
      />
    </div>
  );
};

export default Employees;
