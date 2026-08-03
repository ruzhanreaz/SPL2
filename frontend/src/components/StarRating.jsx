import React, { useState } from "react";

/**
 * StarRating component
 *
 * Props:
 *   rating      - current rating value (1–5) or null
 *   onChange    - (value: number) => void  — omit to make read-only
 *   size        - "sm" | "md" | "lg"  (default "md")
 *   showLabel   - boolean (default false)
 */
const SIZES = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

const StarRating = ({
  rating = null,
  onChange,
  size = "md",
  showLabel = false,
}) => {
  const [hovered, setHovered] = useState(null);
  const isReadOnly = typeof onChange !== "function";
  const starClass = SIZES[size] || SIZES.md;

  const displayRating = hovered ?? rating ?? 0;

  const labels = {
    1: "Poor",
    2: "Fair",
    3: "Good",
    4: "Very Good",
    5: "Excellent",
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={isReadOnly}
          onClick={() => !isReadOnly && onChange(star)}
          onMouseEnter={() => !isReadOnly && setHovered(star)}
          onMouseLeave={() => !isReadOnly && setHovered(null)}
          className={[
            "transition-transform focus:outline-none",
            !isReadOnly &&
              "hover:scale-110 cursor-pointer",
            isReadOnly && "cursor-default",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
        >
          <svg
            className={starClass}
            viewBox="0 0 24 24"
            fill={displayRating >= star ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={1.5}
            style={{
              color:
                displayRating >= star
                  ? "#f59e0b"
                  : "#d1d5db",
            }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
            />
          </svg>
        </button>
      ))}
      {showLabel && displayRating > 0 && (
        <span className="ml-1 text-sm font-medium text-amber-600">
          {labels[displayRating]}
        </span>
      )}
    </div>
  );
};

export default StarRating;
