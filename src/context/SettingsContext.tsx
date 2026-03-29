import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const PIPE_VOLUME_KEY = 'brainropto.pipeVolume';
const PIPE_FREQUENCY_KEY = 'brainropto.pipeFrequency';
const WAKEUP_DELAY_KEY = 'brainropto.wakeUpDelay';
const SHOW_67_TEXT_KEY = 'brainropto.show67Text';
const SHOW_RICKROLL_TEXT_KEY = 'brainropto.showRickrollText';
const SHOW_IMAGE_POPUPS_KEY = 'brainropto.showImagePopups';
const MUTE_ALERT_SOUNDS_KEY = 'brainropto.muteAlertSounds';
const ENABLE_PIPE_SOUND_KEY = 'brainropto.enablePipeSound';

const DEFAULT_PIPE_VOLUME = 100;
const DEFAULT_PIPE_FREQUENCY = 1000;
const DEFAULT_WAKEUP_DELAY = 5;
const DEFAULT_SHOW_67_TEXT = true;
const DEFAULT_SHOW_RICKROLL_TEXT = true;
const DEFAULT_SHOW_IMAGE_POPUPS = true;
const DEFAULT_MUTE_ALERT_SOUNDS = false;
const DEFAULT_ENABLE_PIPE_SOUND = true;

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

const safeSetStoredBoolean = (key: string, value: boolean): void => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(key, value ? 'true' : 'false');
    } catch {
        // Ignore storage failures (private mode/quota) and keep in-memory state working.
    }
};

const readStoredBoolean = (key: string, fallback: boolean): boolean => {
    if (typeof window === 'undefined') {
        return fallback;
    }

    let rawValue: string | null = null;
    try {
        rawValue = window.localStorage.getItem(key);
    } catch {
        return fallback;
    }

    if (rawValue === 'true') return true;
    if (rawValue === 'false') return false;
    return fallback;
};

type SettingsContextValue = {
    pipeVolume: number;
    setPipeVolume: (value: number) => void;
    pipeFrequency: number;
    setPipeFrequency: (value: number) => void;
    wakeUpDelay: number;
    setWakeUpDelay: (value: number) => void;
    show67Text: boolean;
    setShow67Text: (value: boolean) => void;
    showRickrollText: boolean;
    setShowRickrollText: (value: boolean) => void;
    showImagePopups: boolean;
    setShowImagePopups: (value: boolean) => void;
    muteAlertSounds: boolean;
    setMuteAlertSounds: (value: boolean) => void;
    enablePipeSound: boolean;
    setEnablePipeSound: (value: boolean) => void;
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
    const [show67Text, setShow67TextState] = useState<boolean>(() =>
        readStoredBoolean(SHOW_67_TEXT_KEY, DEFAULT_SHOW_67_TEXT)
    );
    const [showRickrollText, setShowRickrollTextState] = useState<boolean>(() =>
        readStoredBoolean(SHOW_RICKROLL_TEXT_KEY, DEFAULT_SHOW_RICKROLL_TEXT)
    );
    const [showImagePopups, setShowImagePopupsState] = useState<boolean>(() =>
        readStoredBoolean(SHOW_IMAGE_POPUPS_KEY, DEFAULT_SHOW_IMAGE_POPUPS)
    );
    const [muteAlertSounds, setMuteAlertSoundsState] = useState<boolean>(() =>
        readStoredBoolean(MUTE_ALERT_SOUNDS_KEY, DEFAULT_MUTE_ALERT_SOUNDS)
    );
    const [enablePipeSound, setEnablePipeSoundState] = useState<boolean>(() =>
        readStoredBoolean(ENABLE_PIPE_SOUND_KEY, DEFAULT_ENABLE_PIPE_SOUND)
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

    const setShow67Text = (value: boolean) => {
        setShow67TextState(value);
        safeSetStoredBoolean(SHOW_67_TEXT_KEY, value);
    };

    const setShowRickrollText = (value: boolean) => {
        setShowRickrollTextState(value);
        safeSetStoredBoolean(SHOW_RICKROLL_TEXT_KEY, value);
    };

    const setShowImagePopups = (value: boolean) => {
        setShowImagePopupsState(value);
        safeSetStoredBoolean(SHOW_IMAGE_POPUPS_KEY, value);
    };

    const setMuteAlertSounds = (value: boolean) => {
        setMuteAlertSoundsState(value);
        safeSetStoredBoolean(MUTE_ALERT_SOUNDS_KEY, value);
    };

    const setEnablePipeSound = (value: boolean) => {
        setEnablePipeSoundState(value);
        safeSetStoredBoolean(ENABLE_PIPE_SOUND_KEY, value);
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

    useEffect(() => {
        safeSetStoredBoolean(SHOW_67_TEXT_KEY, show67Text);
    }, [show67Text]);

    useEffect(() => {
        safeSetStoredBoolean(SHOW_RICKROLL_TEXT_KEY, showRickrollText);
    }, [showRickrollText]);

    useEffect(() => {
        safeSetStoredBoolean(SHOW_IMAGE_POPUPS_KEY, showImagePopups);
    }, [showImagePopups]);

    useEffect(() => {
        safeSetStoredBoolean(MUTE_ALERT_SOUNDS_KEY, muteAlertSounds);
    }, [muteAlertSounds]);

    useEffect(() => {
        safeSetStoredBoolean(ENABLE_PIPE_SOUND_KEY, enablePipeSound);
    }, [enablePipeSound]);

    const value = useMemo(
        () => ({
        pipeVolume,
        setPipeVolume,
        pipeFrequency,
        setPipeFrequency,
        wakeUpDelay,
        setWakeUpDelay,
        show67Text,
        setShow67Text,
        showRickrollText,
        setShowRickrollText,
        showImagePopups,
        setShowImagePopups,
        muteAlertSounds,
        setMuteAlertSounds,
        enablePipeSound,
        setEnablePipeSound,
        }),
        [
            pipeVolume,
            pipeFrequency,
            wakeUpDelay,
            show67Text,
            showRickrollText,
            showImagePopups,
            muteAlertSounds,
            enablePipeSound,
        ]
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
