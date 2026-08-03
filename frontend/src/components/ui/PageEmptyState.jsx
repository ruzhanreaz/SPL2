import React from 'react';

const PageEmptyState = ({ icon: Icon, title, description = null, action = null }) => {
    return (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
            {Icon ? <Icon className="mx-auto mb-3 h-12 w-12 text-gray-300" /> : null}
            <p className="text-base font-medium text-gray-600">{title}</p>
            {description ? <p className="mt-1 text-sm text-gray-400">{description}</p> : null}
            {action ? <div className="mt-4">{action}</div> : null}
        </div>
    );
};

export default PageEmptyState;
