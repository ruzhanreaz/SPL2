import React from 'react';
import { AlertCircle } from 'lucide-react';

const PageErrorState = ({ message, onRetry, retryLabel = 'Retry' }) => {
    return (
        <div className="flex h-64 flex-col items-center justify-center">
            <AlertCircle className="mb-3 h-10 w-10 text-error-500" />
            <p className="mb-4 text-sm text-error-600">{message}</p>
            {onRetry ? (
                <button
                    onClick={onRetry}
                    className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
                >
                    {retryLabel}
                </button>
            ) : null}
        </div>
    );
};

export default PageErrorState;
