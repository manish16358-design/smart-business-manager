import React, { useState } from "react";
import { PROJECT_FILES } from "../data/projectFiles";
import { Check, Copy, Terminal, FolderTree, Database, KeyRound, PlayCircle, FileText } from "lucide-react";

export const ProjectGuide: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState(PROJECT_FILES[0]);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const copyToClipboard = (text: string, path: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  return (
    <div className="space-y-8">
      {/* 5-Step Foundation Run Guide */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              How to Run Smart Business Manager (Flask &amp; SQLite)
            </h2>
            <p className="text-xs text-slate-500">
              Complete beginner-friendly instructions for terminal setup and execution.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Step 1: Create folders */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2 text-sm font-bold text-slate-900">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">1</span>
                <span>Create the Folder Structure</span>
              </div>
              <p className="text-xs text-slate-600 mb-3">
                Open your terminal and run this single command to create all needed directories:
              </p>
              <pre className="bg-slate-900 text-emerald-400 p-3 rounded-lg text-xs font-mono overflow-x-auto">
mkdir -p smart_business_manager/templates smart_business_manager/static/css
              </pre>
            </div>
          </div>

          {/* Step 2: Install dependencies */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2 text-sm font-bold text-slate-900">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">2</span>
                <span>Install Dependencies</span>
              </div>
              <p className="text-xs text-slate-600 mb-3">
                Navigate into the folder, create a virtual environment, and install requirements:
              </p>
              <pre className="bg-slate-900 text-emerald-400 p-3 rounded-lg text-xs font-mono overflow-x-auto">
cd smart_business_manager
python3 -m venv venv
source venv/bin/activate    # (On Windows: venv\Scripts\activate)
pip install -r requirements.txt
              </pre>
            </div>
          </div>

          {/* Step 3: Run Flask */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2 text-sm font-bold text-slate-900">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">3</span>
                <span>Run the Application</span>
              </div>
              <p className="text-xs text-slate-600 mb-3">
                Start the Flask server (this automatically creates <code className="text-blue-600">business.db</code> and seeds <code className="text-blue-600">admin</code>):
              </p>
              <pre className="bg-slate-900 text-emerald-400 p-3 rounded-lg text-xs font-mono overflow-x-auto">
python app.py
              </pre>
              <p className="text-[11px] text-slate-500 mt-2">
                Open your browser at: <strong className="text-slate-800">http://127.0.0.1:5000</strong>
              </p>
            </div>
          </div>

          {/* Step 4 & 5: Credentials and Testing */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2 text-sm font-bold text-slate-900">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">4 &amp; 5</span>
                <span>Default Credentials &amp; Verification</span>
              </div>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="font-semibold text-slate-800 mb-1">Default Login:</div>
                  <div>Username: <strong className="text-blue-600">admin</strong></div>
                  <div>Password: <strong className="text-blue-600">admin123</strong></div>
                </div>
                <div className="text-[11px] text-slate-500 space-y-1">
                  <div>• <strong>Test protected route:</strong> Visit <code className="text-slate-700">/dashboard</code> directly while logged out &rarr; redirects to <code className="text-slate-700">/login</code>.</div>
                  <div>• <strong>Test invalid credentials:</strong> Enter wrong password &rarr; displays error alert.</div>
                  <div>• <strong>Test logout:</strong> Click Logout &rarr; session is purged &rarr; redirects to <code className="text-slate-700">/login</code>.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Code Viewer for Generated Files */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <FolderTree className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-base">Project File Inspector</h3>
              <p className="text-xs text-slate-500">All generated files saved in /smart_business_manager/</p>
            </div>
          </div>

          {/* File Picker Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {PROJECT_FILES.map((file) => (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelectedFile(file)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all cursor-pointer ${
                  selectedFile.path === file.path
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {file.name}
              </button>
            ))}
          </div>
        </div>

        {/* Selected File Details & Code Box */}
        <div className="p-6">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                {selectedFile.path}
              </span>
              <p className="text-xs text-slate-500 mt-1">
                {selectedFile.description}
              </p>
            </div>

            <button
              type="button"
              onClick={() => copyToClipboard(selectedFile.content, selectedFile.path)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              {copiedPath === selectedFile.path ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-[500px] leading-relaxed">
            <code>{selectedFile.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
