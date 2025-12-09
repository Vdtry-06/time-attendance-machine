import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Key, Power, Loader } from 'lucide-react';
import { Button, Card, Input } from '../components/ui';
import { authService, deviceService } from '../services';
import toast from 'react-hot-toast';

const Settings = () => {
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [deviceName] = useState('ESP32-AS608-01');
  const [isPowerOn, setIsPowerOn] = useState(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Kiểm tra trạng thái máy khi load trang
  useEffect(() => {
    checkPowerStatus();
  }, []);

  const checkPowerStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const response = await deviceService.getPowerStatus(deviceName);
      console.log('[POWER-STATUS] Response:', response);
      
      // Đợi 2 giây để ESP32 gửi trạng thái về
      setTimeout(() => {
        // Giả sử ESP32 đã gửi trạng thái về (trong thực tế cần MQTT hoặc polling)
        // Tạm thời set mặc định là ON
        setIsPowerOn(true);
        setIsCheckingStatus(false);
      }, 2000);
    } catch (error) {
      console.error('[POWER-STATUS] Error:', error);
      toast.error('Không thể kiểm tra trạng thái máy');
      setIsCheckingStatus(false);
    }
  };

  // Mutation bật máy
  const powerOnMutation = useMutation({
    mutationFn: () => deviceService.powerOn(deviceName),
    onSuccess: (response) => {
      console.log('[POWER-ON] Success:', response);
      toast.success('Đã gửi lệnh bật máy');
      setIsPowerOn(true);
    },
    onError: (error) => {
      console.error('[POWER-ON] Error:', error);
      toast.error(error.message || 'Không thể bật máy');
    },
  });

  // Mutation tắt máy
  const powerOffMutation = useMutation({
    mutationFn: () => deviceService.powerOff(deviceName),
    onSuccess: (response) => {
      console.log('[POWER-OFF] Success:', response);
      toast.success('Đã gửi lệnh tắt máy');
      setIsPowerOn(false);
    },
    onError: (error) => {
      console.error('[POWER-OFF] Error:', error);
      toast.error(error.message || 'Không thể tắt máy');
    },
  });

  const handleTogglePower = () => {
    if (isPowerOn) {
      if (window.confirm('Bạn có chắc chắn muốn tắt máy chấm công?')) {
        powerOffMutation.mutate();
      }
    } else {
      powerOnMutation.mutate();
    }
  };

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

      <div className="max-w-2xl space-y-6">
        {/* Quản lý nguồn máy chấm công */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${isPowerOn ? 'bg-green-100' : 'bg-gray-100'}`}>
                <Power className={`w-6 h-6 ${isPowerOn ? 'text-green-600' : 'text-gray-600'}`} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Máy chấm công</h2>
                <p className="text-sm text-gray-600">
                  {isCheckingStatus ? (
                    <span className="flex items-center gap-2">
                      <Loader className="w-4 h-4 animate-spin" />
                      Đang kiểm tra trạng thái...
                    </span>
                  ) : isPowerOn === null ? (
                    'Chưa xác định trạng thái'
                  ) : isPowerOn ? (
                    <span className="text-green-600 font-medium">● Đang bật</span>
                  ) : (
                    <span className="text-red-600 font-medium">● Đã tắt</span>
                  )}
                </p>
              </div>
            </div>
            
            <Button
              onClick={handleTogglePower}
              variant={isPowerOn ? 'secondary' : 'primary'}
              disabled={isPowerOn === null || isCheckingStatus || powerOnMutation.isPending || powerOffMutation.isPending}
              loading={powerOnMutation.isPending || powerOffMutation.isPending}
            >
              {isPowerOn ? 'Tắt máy' : 'Bật máy'}
            </Button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Thông tin thiết bị</p>
                <p>Tên thiết bị: <span className="font-mono font-semibold">{deviceName}</span></p>
                <p className="mt-2 text-xs text-blue-600">
                  Lưu ý: Tắt máy sẽ ngừng tất cả chức năng chấm công và đăng ký vân tay.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Đổi mật khẩu */}
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
