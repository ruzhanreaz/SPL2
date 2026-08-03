import React from 'react';

const PageLoadingState = ({ message = 'Loading...' }) => {
    return (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            <p className="text-sm text-gray-600">{message}</p>
        </div>
    );
};

export default PageLoadingState;
