import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const PIPE_VOLUME_KEY = 'brainropto.pipeVolume';
const PIPE_FREQUENCY_KEY = 'brainropto.pipeFrequency';
const WAKEUP_DELAY_KEY = 'brainropto.wakeUpDelay';

const DEFAULT_PIPE_VOLUME = 100;
const DEFAULT_PIPE_FREQUENCY = 1000;
const DEFAULT_WAKEUP_DELAY = 5;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const safeSetStoredNumber = (key: string, value: number): void => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(key, String(value));
    } catch {
        // Ignore storage failures (private mode/quota) and keep in-memory state working.
    }
};

const readStoredNumber = (key: string, fallback: number, min: number, max: number): number => {
    if (typeof window === 'undefined') {
        return fallback;
    }

    let rawValue: string | null = null;
    try {
        rawValue = window.localStorage.getItem(key);
    } catch {
        return fallback;
    }

    const parsedValue = Number(rawValue);

    if (!rawValue || Number.isNaN(parsedValue)) {
        return fallback;
    }

    return clamp(parsedValue, min, max);
};

type SettingsContextValue = {
    pipeVolume: number;
    setPipeVolume: (value: number) => void;
    pipeFrequency: number;
    setPipeFrequency: (value: number) => void;
    wakeUpDelay: number;
    setWakeUpDelay: (value: number) => void;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

type SettingsProviderProps = {
    children: ReactNode;
};


export function SettingsProvider({ children }: SettingsProviderProps) {
    const [pipeVolume, setPipeVolumeState] = useState<number>(() =>
        readStoredNumber(PIPE_VOLUME_KEY, DEFAULT_PIPE_VOLUME, 0, 100)
    );
    const [pipeFrequency, setPipeFrequencyState] = useState<number>(() =>
        readStoredNumber(PIPE_FREQUENCY_KEY, DEFAULT_PIPE_FREQUENCY, 1, 1000)
    );
    const [wakeUpDelay, setWakeUpDelayState] = useState<number>(() =>
        readStoredNumber(WAKEUP_DELAY_KEY, DEFAULT_WAKEUP_DELAY, 1, 30)
    );

    const setPipeVolume = (value: number) => {
        const nextValue = clamp(value, 0, 100);
        setPipeVolumeState(nextValue);
        safeSetStoredNumber(PIPE_VOLUME_KEY, nextValue);
    };

    const setPipeFrequency = (value: number) => {
        const nextValue = clamp(value, 1, 1000);
        setPipeFrequencyState(nextValue);
        safeSetStoredNumber(PIPE_FREQUENCY_KEY, nextValue);
    };

    const setWakeUpDelay = (value: number) => {
        const nextValue = clamp(value, 1, 30);
        setWakeUpDelayState(nextValue);
        safeSetStoredNumber(WAKEUP_DELAY_KEY, nextValue);
    };

    useEffect(() => {
        safeSetStoredNumber(PIPE_VOLUME_KEY, pipeVolume);
    }, [pipeVolume]);

    useEffect(() => {
        safeSetStoredNumber(PIPE_FREQUENCY_KEY, pipeFrequency);
    }, [pipeFrequency]);

    useEffect(() => {
        safeSetStoredNumber(WAKEUP_DELAY_KEY, wakeUpDelay);
    }, [wakeUpDelay]);

    const value = useMemo(
        () => ({
        pipeVolume,
        setPipeVolume,
        pipeFrequency,
        setPipeFrequency,
        wakeUpDelay,
        setWakeUpDelay,
        }),
        [pipeVolume, pipeFrequency, wakeUpDelay]
    );

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }

    return context;
}
