import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

const ConfirmModal = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger' 
}) => {
    const [loading, setLoading] = useState(false);
    const confirmBtnRef = useRef(null);

    // Handle Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !loading) onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        // Focus the confirm button on open
        confirmBtnRef.current?.focus();
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, loading]);

    if (!isOpen) return null;

    const variantStyles = variant === 'danger'
        ? 'bg-red-600 hover:bg-red-700 text-white'
        : 'bg-primary-600 hover:bg-primary-700 text-white';

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await onConfirm();
            onClose();
        } catch (err) {
            console.error('Confirm action failed:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[55] flex items-center justify-center bg-black bg-opacity-50"
            onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
        >
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        {variant === 'danger' ? (
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                                <Info className="w-5 h-5 text-primary-600" />
                            </div>
                        )}
                        <h3 id="confirm-modal-title" className="text-lg font-semibold text-gray-900">{title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <p className="text-gray-600">{message}</p>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 bg-gray-50 rounded-b-lg">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        ref={confirmBtnRef}
                        onClick={handleConfirm}
                        disabled={loading}
                        className={`px-4 py-2 rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2 ${variantStyles}`}
                    >
                        {loading && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        )}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
