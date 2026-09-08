import React from 'react';
import { Check, Moon, Sun } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSettings } from '../context/SettingsContext';

const themes = [
    {
        value: 'light',
        label: 'Light',
        description: 'Use a bright interface for daytime reading.',
        icon: Sun,
    },
    {
        value: 'dark',
        label: 'Dark',
        description: 'Use a darker interface for low-light reading.',
        icon: Moon,
    },
];

const AppearanceSettingsPage = () => {
    const { theme, setTheme } = useSettings();

    return (
        <Card>
            <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                    Choose the color theme used throughout the application.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
                {themes.map(({ value, label, description, icon: Icon }) => {
                    const isSelected = theme === value;

                    return (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => setTheme(value)}
                            className={`relative flex min-h-36 flex-col items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
            </CardContent>
        </Card>
    );
};

export default AppearanceSettingsPage;
