import { WebCamMotionTracker } from '../components/WebCamMotionTracker';
import { useSettings } from '../context/SettingsContext';

export default function WebCamMotionTrackerPage() {
  const { wakeUpDelay } = useSettings();
  
  return (
    <main className="container mx-auto p-8 text-slate-100 bg-[#061126] min-h-[calc(100vh-88px)]">
      <h1 className="text-2xl font-bold mb-4">Webcam Motion Tracker</h1>
      <div className="mb-4 flex flex-col items-center gap-2">
        <label className="text-slate-200 font-medium">Wake up delay: {wakeUpDelay} seconds</label>
      </div>

      <WebCamMotionTracker />
    </main>
  );
}
