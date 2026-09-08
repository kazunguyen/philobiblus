import React from 'react';
import { Check, LayoutGrid, List } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSettings } from '../context/SettingsContext';

const bookViews = [
    {
        value: 'grid',
        label: 'Card grid',
        description: 'Show books as cards in a responsive grid.',
        icon: LayoutGrid,
    },
    {
        value: 'list',
        label: 'List',
        description: 'Show books as long horizontal list items.',
        icon: List,
    },
];

const PreferencesSettingsPage = () => {
    const { defaultBookView, setDefaultBookView } = useSettings();

    return (
        <Card>
            <CardHeader>
                <CardTitle>Preferences</CardTitle>
                <CardDescription>
                    Set the default layout for book-related pages.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    <div>
                        <h2 className="font-medium">Default book layout</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            You can still change the layout directly on each page.
                        </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        {bookViews.map(({ value, label, description, icon: Icon }) => {
                            const isSelected = defaultBookView === value;

                            return (
                                <button
                                    key={value}
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => setDefaultBookView(value)}
                                    className={`relative flex min-h-32 flex-col items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                        isSelected
                                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                            : 'hover:bg-muted'
                                    }`}
                                >
                                    <span className="flex size-10 items-center justify-center rounded-lg bg-secondary">
                                        <Icon className="size-5" />
                                    </span>
                                    <span>
                                        <span className="block font-medium">{label}</span>
                                        <span className="mt-1 block text-sm text-muted-foreground">
                                            {description}
                                        </span>
                                    </span>
                                    {isSelected && (
                                        <span className="absolute right-4 top-4 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                            <Check className="size-3" />
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default PreferencesSettingsPage;
