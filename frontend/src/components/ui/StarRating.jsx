import React from 'react';
import { Star } from 'lucide-react';

const StarRating = ({
    value = 0,
    onChange,
    label = 'Rating',
    disabled = false,
}) => {
    const selectedRating = Number(value) || 0;

    return (
        <div className="space-y-2">
            <span className="text-sm font-medium">{label}</span>

            <div
                className="flex items-center gap-1"
                role="radiogroup"
                aria-label={label}
            >
                {Array.from({ length: 5 }, (_, index) => {
                    const starValue = index + 1;
                    const isFilled = starValue <= selectedRating;

                    return (
                        <button
                            key={starValue}
                            type="button"
                            role="radio"
                            aria-checked={selectedRating === starValue}
                            aria-label={`${starValue} star${starValue > 1 ? 's' : ''
                                }`}
                            disabled={disabled}
                            onClick={() => onChange(starValue)}
                            className="rounded-md p-1 text-yellow-500 transition-colors hover:bg-yellow-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                        >
                            <Star
                                className="h-7 w-7"
                                fill={isFilled ? 'currentColor' : 'none'}
                            />
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default StarRating;