import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Search, Fingerprint, Mail, Phone, Loader } from 'lucide-react';
import { Button, Card, Modal, Input, Badge, Table, LoadingSpinner } from '../components/ui';
import { employeeService, deviceService } from '../services';
import toast from 'react-hot-toast';
import { formatDate } from '../utils/dateUtils';
import { getStatusColor, getStatusText } from '../utils/helpers';

const EmployeeModal = ({ isOpen, onClose, employee, isEnrollMode = false }) => {
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
  const [showEnrollOnly, setShowEnrollOnly] = useState(isEnrollMode);

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

  // Polling để kiểm tra trạng thái enrollment
  useEffect(() => {
    let interval;
    let timeoutId;
    
    if (isEnrolling && employee?.id) {
      // Bắt đầu polling ngay lập tức
      interval = setInterval(async () => {
        try {
          const response = await deviceService.getEnrollmentStatus(employee.id);
          // Response interceptor đã return response.data
          const status = response?.status;
          
          if (status === 'completed') {
            // Hoàn thành - Đã có fingerprint_id trong database
            const fingerprintId = response.employee.fingerprint_id;
            setFormData(prev => ({ ...prev, fingerPrint: fingerprintId }));
            setIsEnrolling(false);
            setEnrollStatus('');
            toast.success(`Đã lấy vân tay thành công! ID: ${fingerprintId}`);
            queryClient.invalidateQueries(['employees']);
            clearInterval(interval);
            if (timeoutId) clearTimeout(timeoutId);
          } else if (status === 'processing') {
            // Đang xử lý - ESP32 đã gửi dữ liệu, backend đang cập nhật
            setEnrollStatus('Đang xử lý dữ liệu vân tay...');
          } else if (status === 'pending') {
            // Đang chờ - ESP32 chưa gửi dữ liệu
            setEnrollStatus('Đang chờ quét vân tay từ thiết bị...');
          }
        } catch (error) {
          console.error('Error checking enrollment status:', error);
        }
      }, 2000); // Polling mỗi 2 giây
      
      // Timeout sau 60 giây nếu không có kết quả
      timeoutId = setTimeout(() => {
        if (isEnrolling) {
          setIsEnrolling(false);
          setEnrollStatus('');
          toast.error('Hết thời gian chờ. Vui lòng thử lại.');
          clearInterval(interval);
        }
      }, 60000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isEnrolling, employee?.id, queryClient]);

  const handleEnrollFingerprint = async () => {
    if (!employee?.id) {
      toast.error('Vui lòng tạo nhân viên trước khi lấy vân tay');
      return;
    }
    
    try {
      console.log('[ENROLL] Sending request for employee:', employee.id);
      
      // Gọi API để gửi lệnh enrollment
      const response = await deviceService.enrollFingerprint(employee.id);
      
      console.log('[ENROLL] Response:', response);
      
      // Nếu gửi thành công, bắt đầu polling
      if (response?.status === 'success') {
        setIsEnrolling(true);
        setEnrollStatus('Đang chờ quét vân tay từ thiết bị...');
        toast.success('Đã gửi yêu cầu đến thiết bị. Vui lòng đặt ngón tay lên cảm biến.');
      } else {
        toast.error('Không thể gửi yêu cầu đến thiết bị');
      }
      
    } catch (error) {
      console.error('[ENROLL] Error:', error);
      
      // Xử lý trường hợp đã có fingerprint
      if (error.status === 'error' && error.current_fingerprint) {
        const currentFP = error.current_fingerprint;
        if (window.confirm(`Nhân viên đã có vân tay (ID: ${currentFP}). Bạn có muốn xóa và đăng ký lại không?`)) {
          try {
            await deviceService.deleteFingerprint(employee.id);
            toast.success('Đã xóa vân tay cũ. Vui lòng thử lại.');
            queryClient.invalidateQueries(['employees']);
          } catch (deleteError) {
            toast.error('Không thể xóa vân tay cũ.');
          }
        }
        return;
      }
      
      const errorMsg = error.message || 'Không thể kết nối với thiết bị';
      toast.error(errorMsg);
    }
  };

  const handleCancelEnroll = () => {
    setIsEnrolling(false);
    setEnrollStatus('');
    toast.info('Đã hủy quá trình lấy vân tay');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Nếu đang ở chế độ enroll-only, chỉ đóng modal
    if (showEnrollOnly) {
      onClose();
      return;
    }
    
    mutation.mutate(formData);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={showEnrollOnly ? 'Thêm vân tay cho nhân viên' : (employee ? 'Cập nhật nhân viên' : 'Thêm nhân viên mới')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {showEnrollOnly ? 'Đóng' : 'Hủy'}
          </Button>
          {!showEnrollOnly && (
            <Button onClick={handleSubmit} loading={mutation.isPending}>
              {employee ? 'Cập nhật' : 'Thêm mới'}
            </Button>
          )}
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {showEnrollOnly ? (
          // Hiển thị thông tin nhân viên chỉ đọc khi ở chế độ enroll
          <>
            <div className="bg-gray-50 p-4 rounded-lg space-y-3 border border-gray-200">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Họ và tên</label>
                <p className="text-sm font-medium text-gray-900">{employee?.name}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">CCCD/CMND</label>
                  <p className="text-sm text-gray-900">{employee?.identificationNum || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Chức vụ</label>
                  <p className="text-sm text-gray-900">{employee?.position || '-'}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                  <p className="text-sm text-gray-900">{employee?.email || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Số điện thoại</label>
                  <p className="text-sm text-gray-900">{employee?.phoneNum || '-'}</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          // Form nhập liệu bình thường khi thêm/sửa
          <>
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
          </>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Vân tay
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
  const [isEnrollMode, setIsEnrollMode] = useState(false);
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
    setIsEnrollMode(false);
    setIsModalOpen(true);
  };

  const handleEnrollFingerprint = (employee) => {
    setSelectedEmployee(employee);
    setIsEnrollMode(true);
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa nhân viên này?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleAddNew = () => {
    setSelectedEmployee(null);
    setIsEnrollMode(false);
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
          {!row.fingerPrint && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleEnrollFingerprint(row)}
              icon={<Fingerprint className="w-4 h-4 text-blue-600" />}
              title="Thêm vân tay"
            />
          )}
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
        onClose={() => {
          setIsModalOpen(false);
          setIsEnrollMode(false);
        }}
        employee={selectedEmployee}
        isEnrollMode={isEnrollMode}
      />
    </div>
  );
};

export default Employees;
