import { Settings as SettingsIcon } from 'lucide-react';

export function Settings() {
  return (
    <main className="container mx-auto p-8">
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <SettingsIcon className="w-8 h-8 text-purple-600" />
          <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-2">
                Video Upload Quality
              </label>
              <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>

            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-2">
                Gesture Detection Sensitivity
              </label>
              <input
                type="range"
                min="0"
                max="100"
                defaultValue="50"
                className="w-full"
              />
            </div>

            <div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-5 h-5 text-purple-600 rounded"
                />
                <span className="text-gray-700">Enable real-time detection</span>
              </label>
            </div>

            <button className="w-full bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors">
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
