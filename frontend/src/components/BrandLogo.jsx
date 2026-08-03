import React from 'react';

/**
 * VitaBridge brand mark matching the favicon waveform direction.
 */
export default function BrandLogo({ className = 'w-5 h-5', strokeClassName = 'text-primary-600' }) {
    return (
        <svg
            viewBox="0 0 64 64"
            className={className}
            aria-hidden="true"
            fill="none"
        >
            <path
                d="M6 32h10l6 14 10-28 6 14h10"
                className={strokeClassName}
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
