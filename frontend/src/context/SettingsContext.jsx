import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useAuth } from './AuthContext';
import { settingsService } from '../services/settingsService';

const SETTINGS_STORAGE_KEY = 'philobiblus-settings';
const DEFAULT_SETTINGS = {
    theme: 'light',
    defaultBookView: 'grid',
};

const SettingsContext = createContext(null);

const normalizeSettings = (settings = {}) => ({
    theme: settings.theme === 'dark' ? 'dark' : DEFAULT_SETTINGS.theme,
    defaultBookView:
        settings.default_book_view === 'list' || settings.defaultBookView === 'list'
            ? 'list'
            : DEFAULT_SETTINGS.defaultBookView,
});

const getCachedSettings = (userId) => {
    if (!userId) {
        return DEFAULT_SETTINGS;
    }

    try {
        const cached = JSON.parse(
            localStorage.getItem(`${SETTINGS_STORAGE_KEY}:${userId}`),
        );
        return normalizeSettings(cached);
    } catch {
        return DEFAULT_SETTINGS;
    }
};

export const SettingsProvider = ({ children }) => {
    const { token, currentUser } = useAuth();
    const userId = currentUser?.id;
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [isLoading, setIsLoading] = useState(Boolean(token));
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [isHydrated, setIsHydrated] = useState(false);
    const saveTimeoutRef = useRef(null);
    const settingsRef = useRef(settings);
    const hasPendingChangeRef = useRef(false);

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    useEffect(() => {
        let isMounted = true;
        hasPendingChangeRef.current = false;

        if (!token || !userId) {
            setSettings(DEFAULT_SETTINGS);
            setIsLoading(false);
            setIsHydrated(false);
            setIsSaving(false);
            setSaveError(null);
            return undefined;
        }

        setSettings(getCachedSettings(userId));
        setIsLoading(true);
        setIsHydrated(false);
        setSaveError(null);

        settingsService
            .getSettings(token)
            .then((storedSettings) => {
                if (!isMounted) {
                    return;
                }

                const normalized = normalizeSettings(storedSettings);
                settingsRef.current = normalized;
                setSettings(normalized);
                setIsHydrated(true);
                localStorage.setItem(
                    `${SETTINGS_STORAGE_KEY}:${userId}`,
                    JSON.stringify(normalized),
                );
            })
            .catch((error) => {
                if (isMounted) {
                    setSaveError(error.message);
                }
            })
            .finally(() => {
                if (isMounted) {
                    setIsLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [token, userId]);

    useEffect(() => {
        document.documentElement.classList.toggle(
            'dark',
            settings.theme === 'dark',
        );
        document.documentElement.style.colorScheme = settings.theme;
    }, [settings.theme]);

    const persistSettings = useCallback(() => {
        if (!token || !userId || !hasPendingChangeRef.current) {
            return undefined;
        }

        setIsSaving(true);
        setSaveError(null);

        return settingsService
            .updateSettings(token, {
                theme: settingsRef.current.theme,
                default_book_view: settingsRef.current.defaultBookView,
            })
            .then((storedSettings) => {
                const normalized = normalizeSettings(storedSettings);
                settingsRef.current = normalized;
                setSettings(normalized);
                hasPendingChangeRef.current = false;
                localStorage.setItem(
                    `${SETTINGS_STORAGE_KEY}:${userId}`,
                    JSON.stringify(normalized),
                );
            })
            .catch((error) => {
                setSaveError(error.message);
            })
            .finally(() => {
                setIsSaving(false);
            });
    }, [token, userId]);

    useEffect(() => {
        if (
            !token ||
            !userId ||
            isLoading ||
            !isHydrated ||
            !hasPendingChangeRef.current
        ) {
            return undefined;
        }

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            persistSettings();
        }, 250);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [
        settings.theme,
        settings.defaultBookView,
        token,
        userId,
        isLoading,
        isHydrated,
        persistSettings,
    ]);

    const setTheme = useCallback((theme) => {
        hasPendingChangeRef.current = true;
        setSettings((current) => ({ ...current, theme }));
    }, []);

    const setDefaultBookView = useCallback((defaultBookView) => {
        hasPendingChangeRef.current = true;
        setSettings((current) => ({ ...current, defaultBookView }));
    }, []);

    const value = useMemo(
        () => ({
            theme: settings.theme,
            setTheme,
            defaultBookView: settings.defaultBookView,
            setDefaultBookView,
            isLoading,
            isSaving,
            saveError,
        }),
        [
            isLoading,
            isSaving,
            saveError,
            setDefaultBookView,
            setTheme,
            settings.defaultBookView,
            settings.theme,
        ],
    );

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);

    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }

    return context;
};
