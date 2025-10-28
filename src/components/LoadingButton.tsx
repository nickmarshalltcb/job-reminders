import React from 'react';
import { FaSpinner } from 'react-icons/fa';

interface LoadingButtonProps {
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  onClick,
  loading = false,
  disabled = false,
  className = '',
  children,
  type = 'button',
  variant = 'primary'
}) => {
  const baseClasses = 'px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-200',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {loading && <FaSpinner className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};
