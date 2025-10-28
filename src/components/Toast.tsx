import React, { useEffect } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimes } from 'react-icons/fa';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type,
  onClose,
  duration = 3000
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const config = {
    success: {
      icon: FaCheckCircle,
      bgColor: 'bg-green-500/90',
      borderColor: 'border-green-400',
      textColor: 'text-white'
    },
    error: {
      icon: FaExclamationCircle,
      bgColor: 'bg-red-500/90',
      borderColor: 'border-red-400',
      textColor: 'text-white'
    },
    warning: {
      icon: FaExclamationCircle,
      bgColor: 'bg-yellow-500/90',
      borderColor: 'border-yellow-400',
      textColor: 'text-white'
    },
    info: {
      icon: FaInfoCircle,
      bgColor: 'bg-blue-500/90',
      borderColor: 'border-blue-400',
      textColor: 'text-white'
    }
  };

  const { icon: Icon, bgColor, borderColor, textColor } = config[type];

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 ${bgColor} ${textColor} px-4 py-3 rounded-lg shadow-2xl border ${borderColor} backdrop-blur-sm animate-slide-in min-w-[300px] max-w-md`}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        onClick={onClose}
        className="flex-shrink-0 hover:opacity-70 transition-opacity"
        aria-label="Close notification"
      >
        <FaTimes className="w-4 h-4" />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Array<{ id: string; message: string; type: 'success' | 'error' | 'info' | 'warning' }>;
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{ transform: `translateY(${index * 10}px)` }}
          className="transition-transform duration-200"
        >
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </div>
  );
};
