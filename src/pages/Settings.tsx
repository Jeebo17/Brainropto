import { Settings as SettingsIcon } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export function Settings() {
    const {
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
    } = useSettings();

    return (
        <main className="w-full max-w-none p-8 px-20 text-slate-100 bg-[#061126] min-h-[calc(100vh-88px)]">
        <div className="w-full">
            <div className="flex items-center gap-3 mb-8">
            <SettingsIcon className="w-8 h-8 text-blue-300" />
            <h1 className="text-3xl font-bold text-slate-100">Settings</h1>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 w-full">
                <div className="flex-1 min-w-0 space-y-6 bg-[#0a1933] border border-[#1a2d4a] rounded-lg shadow-md p-6">
                    {/* <div>
                    <label className="block text-lg font-semibold text-slate-200 mb-2">
                        Video Upload Quality
                    </label>
                    <select className="w-full px-4 py-2 border border-[#1a2d4a] bg-[#061126] text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
                        <option>High</option>
                        <option>Medium</option>
                        <option>Low</option>
                    </select>
                    </div> */}

                    <label className="block text-2xl font-bold text-slate-200 mb-2">
                        Pipe Settings
                    </label>


                    <div>
                        <label className="block text-lg font-semibold text-slate-200 mb-2">
                            Pipe Volume: <span className="text-blue-300">{pipeVolume}%</span>
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="100"
                            value={pipeVolume}
                            onChange={(e) => setPipeVolume(Number(e.target.value))}
                            className="w-full accent-blue-400"
                        />
                    </div>

                    <div>
                        <label className="block text-lg font-semibold text-slate-200 mb-2">
                            Pipe Frequency: <span className="text-blue-300">{100 - Math.round((pipeFrequency / 1000) * 100) + 1}%</span>
                            <span className="block text-xs text-slate-400 font-normal">% chance of pipe</span>
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="100"
                            value={100 - Math.round((pipeFrequency / 1000) * 100) + 1}
                            onChange={(e) => setPipeFrequency(Math.round(((100 - Number(e.target.value) + 1) / 100) * 1000))}
                            className="w-full accent-blue-400"
                        />
                    </div>

                    <label className="flex items-start justify-between gap-4 px-4 py-3 border-b pb-6 border-[#1a2d4a]">
                        <span>
                            <span className="block text-lg font-semibold text-slate-200">Enable pipe sound</span>
                            <span className="block text-xs text-slate-400">If off, random pipe audio will not play.</span>
                        </span>
                        <input
                            type="checkbox"
                            checked={enablePipeSound}
                            onChange={(e) => setEnablePipeSound(e.target.checked)}
                            className="mt-1 h-5 w-5 accent-blue-400"
                        />
                    </label>

                    <label className="flex items-start justify-between gap-4 px-4 py-3 pb-6 border-[#1a2d4a]">
                        <span>
                            <span className="block text-lg font-semibold text-slate-200">Mute webcam sound effects</span>
                            <span className="block text-xs text-slate-400">If on, those alerts are silent but visual effects can still appear.</span>
                        </span>
                        <input
                            type="checkbox"
                            checked={muteAlertSounds}
                            onChange={(e) => setMuteAlertSounds(e.target.checked)}
                            className="mt-1 h-5 w-5 accent-blue-400"
                        />
                    </label>
                </div>

                <div className="flex-1 min-w-0 space-y-6 bg-[#0a1933] border border-[#1a2d4a] rounded-lg shadow-md p-6">

                    <label className="block text-2xl font-bold text-slate-200 mb-2">
                        Gesture Text Effects
                    </label>

                    <div>
                        <label className="block text-lg font-semibold text-slate-200 mb-2">
                            WAKE UP Delay: <span className="text-blue-300">{wakeUpDelay}s</span>
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="30"
                            value={wakeUpDelay}
                            onChange={(e) => setWakeUpDelay(Number(e.target.value))}
                            className="w-full accent-blue-400"
                        />
                        <span className="block text-xs text-slate-400 font-normal">How many seconds your eyes must be closed before WAKE UP triggers</span>
                    </div>

                    <label className="flex items-start justify-between gap-4 px-4 py-3 border-b pb-6 border-[#1a2d4a]">
                        <span>
                            <span className="block text-lg font-semibold text-slate-200">Show 67 giant text</span>
                            <span className="block text-xs text-slate-400">If off, detecting 67 will not flash large text on screen.</span>
                        </span>
                        <input
                            type="checkbox"
                            checked={show67Text}
                            onChange={(e) => setShow67Text(e.target.checked)}
                            className="mt-1 h-5 w-5 accent-blue-400"
                        />
                    </label>

                    <label className="flex items-start justify-between gap-4 rounded px-4 py-3">
                        <span>
                            <span className="block text-lg font-semibold text-slate-200">Show Rickroll giant text</span>
                            <span className="block text-xs text-slate-400">If off, detecting Rickroll will not flash large text on screen.</span>
                        </span>
                        <input
                            type="checkbox"
                            checked={showRickrollText}
                            onChange={(e) => setShowRickrollText(e.target.checked)}
                            className="mt-1 h-5 w-5 accent-blue-400"
                        />
                    </label>

                    <label className="flex items-start justify-between gap-4 rounded px-4 py-3 border-t pt-6 border-[#1a2d4a]">
                        <span>
                            <span className="block text-lg font-semibold text-slate-200">Show giant image popups</span>
                            <span className="block text-xs text-slate-400">If off, image overlays (mouth open, shush, hands-on-head) are hidden.</span>
                        </span>
                        <input
                            type="checkbox"
                            checked={showImagePopups}
                            onChange={(e) => setShowImagePopups(e.target.checked)}
                            className="mt-1 h-5 w-5 accent-blue-400"
                        />
                    </label>
                </div>

            </div>
        </div>
        </main>
    );
}
