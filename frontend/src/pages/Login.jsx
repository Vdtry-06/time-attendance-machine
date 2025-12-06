import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Lock, Mail, Fingerprint } from 'lucide-react';
import { Button, Input } from '../components/ui';
import { authService } from '../services';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const Login = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const loginMutation = useMutation({
    mutationFn: (credentials) => authService.login(credentials),
    onSuccess: (response) => {
      const { data } = response;
      setAuth(data.user, data.token);
      localStorage.setItem('token', data.token);
      toast.success('Đăng nhập thành công!');
      navigate('/');
    },
    onError: (error) => {
      toast.error(error.message || 'Username hoặc mật khẩu không đúng');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    loginMutation.mutate({
      username: formData.email,
      password: formData.password,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl mb-4 shadow-lg">
            <Fingerprint className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Hệ Thống Chấm Công
          </h1>
          <p className="text-gray-600">
            Đăng nhập để quản lý chấm công vân tay
          </p>
        </div>

        {/* Login form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              type="text"
              label="Tên đăng nhập"
              placeholder="username"
              icon={<Mail className="w-5 h-5 text-gray-400" />}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <Input
              type="password"
              label="Mật khẩu"
              placeholder="••••••••"
              icon={<Lock className="w-5 h-5 text-gray-400" />}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-600">Ghi nhớ đăng nhập</span>
              </label>
              <a href="#" className="text-sm text-primary-600 hover:text-primary-700">
                Quên mật khẩu?
              </a>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={loginMutation.isPending}
            >
              Đăng nhập
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 text-center">
              Demo: <strong>admin</strong> / <strong>password</strong>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-8">
          © 2024 Time Attendance System. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
