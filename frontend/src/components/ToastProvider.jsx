import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const ToastContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const showToast = useCallback((message, type = 'info', duration = 5000) => {
        const id = Date.now() + Math.random();
        const toast = { id, message, type, duration };

        setToasts(prev => [...prev, toast]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, [removeToast]);

    const success = useCallback((message, duration) => {
        showToast(message, 'success', duration);
    }, [showToast]);

    const error = useCallback((message, duration) => {
        showToast(message, 'error', duration);
    }, [showToast]);

    const info = useCallback((message, duration) => {
        showToast(message, 'info', duration);
    }, [showToast]);

    const warning = useCallback((message, duration) => {
        showToast(message, 'warning', duration);
    }, [showToast]);

    const getToastStyles = (type) => {
        switch (type) {
            case 'success':
                return 'bg-green-50 border-green-500 text-green-800';
            case 'error':
                return 'bg-red-50 border-red-500 text-red-800';
            case 'warning':
                return 'bg-yellow-50 border-yellow-500 text-yellow-800';
            case 'info':
            default:
                return 'bg-primary-50 border-primary-500 text-primary-800';
        }
    };

    const getToastIcon = (type) => {
        switch (type) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'error':
                return <AlertCircle className="w-5 h-5 text-red-500" />;
            case 'warning':
                return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
            case 'info':
            default:
                return <Info className="w-5 h-5 text-primary-500" />;
        }
    };

    return (
        <ToastContext.Provider value={{ success, error, info, warning, showToast }}>
            {children}

            {/* Toast Container */}
            <div className="fixed top-16 right-4 z-[60] space-y-2 max-w-md">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        role="alert"
                        aria-live="assertive"
                        className={`${getToastStyles(toast.type)} border-l-4 p-4 rounded-lg shadow-lg flex items-start gap-3 animate-slide-in-right`}
                    >
                        {getToastIcon(toast.type)}
                        <p className="flex-1 text-sm font-medium">{toast.message}</p>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
