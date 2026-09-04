import React from 'react';
import { Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

export const TAG_OPTIONS = [
    'Action',
    'Adventure',
    'Comedy',
    'Drama',
    'Fantasy',
    'Horror',
    'Mystery',
    'Romance',
    'Science Fiction',
    'Slice of Life',
    'Sports',
    'Supernatural',
    'Thriller',
    'Self Improvement',
    'Productivity',
    'Technology',
    'DevOps',
    'Security',
    'Database',
    'Other',
];

/** Render a multi-select book tag card grid. */
const TagSelector = ({
    value = [],
    onChange,
    label = 'Tags',
}) => {
    const [searchTerm, setSearchTerm] = React.useState('');
    const selectedTags = Array.isArray(value) ? value : [];
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    const visibleTags = TAG_OPTIONS.filter((tag) =>
        tag.toLowerCase().includes(normalizedSearchTerm),
    );

    const toggleTag = (tag) => {
        if (selectedTags.includes(tag)) {
            onChange(selectedTags.filter((item) => item !== tag));
            return;
        }

        onChange([...selectedTags, tag]);
    };

    return (
        <div className="space-y-3">
            <span className="text-sm font-medium">{label}</span>

            <div className="flex min-h-9 items-center gap-2 overflow-x-auto whitespace-nowrap">
                {selectedTags.length > 0 ? (
                    selectedTags.map((tag) => (
                        <div
                            key={tag}
                            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary"
                        >
                            <span>{tag}</span>
                            <button
                                type="button"
                                aria-label={`Remove ${tag}`}
                                onClick={() => toggleTag(tag)}
                                className="rounded-full p-0.5 hover:bg-primary/15"
                            >
                                <X className="size-3" />
                            </button>
                        </div>
                    ))
                ) : (
                    <span className="text-sm text-muted-foreground">
                        No tags selected
                    </span>
                )}
            </div>

            <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search tags..."
                aria-label="Search tags"
            />

            <div className="max-h-48 overflow-y-auto rounded-lg border p-2">
                <div className="grid gap-2 sm:grid-cols-2">
                    {visibleTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag);

                    return (
                        <button
                            key={tag}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => toggleTag(tag)}
                            className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${isSelected
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-background hover:bg-muted'
                                }`}
                        >
                            <span>{tag}</span>
                            {isSelected && <Check className="size-4" />}
                        </button>
                    );
                    })}
                </div>
            </div>
        </div>
    );
};

export default TagSelector;
