import { Bell } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';

const Header = () => {
  const currentDate = new Date();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="px-6 py-4">
        <div className="flex items-center justify-end">
          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Current date */}
            <div className="hidden sm:block text-sm text-gray-600">
              {formatDate(currentDate, 'dd/MM/yyyy')}
            </div>

            {/* Notifications */}
            <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
              <Bell className="w-6 h-6" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
