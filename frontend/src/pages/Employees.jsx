import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Search, Fingerprint, Mail, Phone } from 'lucide-react';
import { Button, Card, Modal, Input, Badge, Table, LoadingSpinner } from '../components/ui';
import { employeeService } from '../services';
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

  const handleSubmit = (e) => {
    e.preventDefault();
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

        <Input
          label="Fingerprint ID (tùy chọn)"
          type="number"
          value={formData.fingerPrint}
          onChange={(e) => setFormData({ ...formData, fingerPrint: e.target.value })}
          placeholder="ID vân tay từ thiết bị"
        />
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
