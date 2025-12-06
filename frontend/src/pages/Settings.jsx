import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Key } from 'lucide-react';
import { Button, Card, Input } from '../components/ui';
import { authService } from '../services';
import toast from 'react-hot-toast';

const Settings = () => {
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data) => authService.changePassword(data),
    onSuccess: () => {
      toast.success('Đổi mật khẩu thành công');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (error) => {
      toast.error(error.message || 'Có lỗi xảy ra');
    },
  });

  const handleChangePassword = (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Cài đặt</h1>
        <p className="text-gray-600 mt-2">Quản lý cài đặt hệ thống</p>
      </div>

      <div className="max-w-2xl">
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-primary-100 rounded-lg">
              <Key className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Đổi mật khẩu</h2>
              <p className="text-sm text-gray-600">Cập nhật mật khẩu của bạn</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <Input
              type="password"
              label="Mật khẩu hiện tại"
              placeholder="Nhập mật khẩu hiện tại"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              required
            />
            <Input
              type="password"
              label="Mật khẩu mới"
              placeholder="Nhập mật khẩu mới"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              required
            />
            <Input
              type="password"
              label="Xác nhận mật khẩu"
              placeholder="Nhập lại mật khẩu mới"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              required
            />
            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                isLoading={changePasswordMutation.isPending}
              >
                Đổi mật khẩu
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
