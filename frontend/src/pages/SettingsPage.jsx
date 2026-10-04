import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Palette, SlidersHorizontal } from 'lucide-react';

const settingsItems = [
    {
        to: 'appearance',
        label: 'Appearance',
        icon: Palette,
    },
    {
        to: 'preferences',
        label: 'Preferences',
        icon: SlidersHorizontal,
    },
];

const SettingsPage = () => (
    <div className="min-h-screen bg-muted/30">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-8">
                <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
            </div>

            <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
                <aside className="h-fit rounded-xl border bg-card p-2">
                    <nav aria-label="Settings sections" className="space-y-1">
                        {settingsItems.map(({ to, label, icon: Icon }) => (
                            <NavLink
                                key={to}
                                to={to}
                                className={({ isActive }) =>
                                    `flex items-start gap-3 rounded-lg px-3 py-3 transition-colors ${
                                        isActive
                                            ? 'bg-secondary text-secondary-foreground'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                    }`
                                }
                            >
                                <Icon className="mt-0.5 size-4 shrink-0" />
                                <span className="block text-sm font-medium">{label}</span>
                            </NavLink>
                        ))}
                    </nav>
                </aside>

                <section className="min-w-0">
                    <Outlet />
                </section>
            </div>
        </main>
    </div>
);

export default SettingsPage;
