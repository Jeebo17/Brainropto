import { Settings as SettingsIcon } from 'lucide-react';

export function Settings() {
  return (
    <main className="container mx-auto p-8 text-slate-100 bg-[#061126] min-h-[calc(100vh-88px)]">
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <SettingsIcon className="w-8 h-8 text-blue-300" />
          <h1 className="text-3xl font-bold text-slate-100">Settings</h1>
        </div>

        <div className="bg-[#0a1933] border border-[#1a2d4a] rounded-lg shadow-md p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-lg font-semibold text-slate-200 mb-2">
                Video Upload Quality
              </label>
              <select className="w-full px-4 py-2 border border-[#1a2d4a] bg-[#061126] text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>

            <div>
              <label className="block text-lg font-semibold text-slate-200 mb-2">
                Gesture Detection Sensitivity
              </label>
              <input
                type="range"
                min="0"
                max="100"
                defaultValue="50"
                className="w-full accent-blue-400"
              />
            </div>

            <div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-5 h-5 text-blue-400 rounded"
                />
                <span className="text-slate-200">Enable real-time detection</span>
              </label>
            </div>

            <button className="w-full bg-[#16325f] text-slate-100 font-semibold py-2 px-4 rounded-lg hover:bg-[#1d3c71] transition-colors">
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
