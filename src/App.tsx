import React, { useState, useEffect } from 'react';
import { 
  FolderOpen, 
  FileAudio, 
  RotateCcw, 
  AlertCircle, 
  Play, 
  ArrowRightLeft,
  Trash2,
  ShieldCheck,
  ChevronLeft,
  Info,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Device } from '@capacitor/device';

// --- Utils ---
const containsHebrew = (str: string) => /[\u0590-\u05FF]/.test(str);

const reverseHebrewInString = (str: string) => {
  const hebrewRegex = /[\u0590-\u05FF]+/g;
  return str.replace(hebrewRegex, (match) => match.split('').reverse().join(''));
};

// --- Types ---
interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  hasHebrew: boolean;
}

export default function App() {
  // State
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [platform, setPlatform] = useState<'web' | 'android' | 'ios'>('web');
  const [showPermissionsHelp, setShowPermissionsHelp] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');

  // Initialization
  useEffect(() => {
    const init = async () => {
      const info = await Device.getInfo();
      setPlatform(info.platform as any);
      
      if (info.platform === 'android') {
        checkPermissions();
        loadDirectory('');
      }
    };
    init();
    document.documentElement.dir = 'rtl';
  }, []);

  // Logging
  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 50));
  };

  // Permissions
  const checkPermissions = async () => {
    try {
      const status = await Filesystem.checkPermissions();
      setPermissionStatus(status.publicStorage);
    } catch (err) {
      console.error(err);
    }
  };

  const requestBasicPermissions = async () => {
    try {
      const status = await Filesystem.requestPermissions();
      setPermissionStatus(status.publicStorage);
      addLog(`הרשאות: ${status.publicStorage}`);
    } catch (err) {
      addLog("❌ שגיאה בבקשת הרשאות");
    }
  };

  // File Operations
  const loadDirectory = async (path: string) => {
    try {
      const result = await Filesystem.readdir({
        path: path,
        directory: Directory.ExternalStorage
      });
      
      const mappedFiles: FileEntry[] = result.files.map(f => ({
        name: f.name,
        path: path ? `${path}/${f.name}` : f.name,
        isDirectory: f.type === 'directory',
        hasHebrew: containsHebrew(f.name)
      }));

      mappedFiles.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
        return a.isDirectory ? -1 : 1;
      });

      setFiles(mappedFiles);
      setCurrentPath(path);
      addLog(`📂 נכנס ל: ${path || 'שורש'}`);
    } catch (err) {
      addLog(`❌ שגיאה בטעינה: ${err instanceof Error ? err.message : 'נכשל'}`);
      if (err instanceof Error && (err.message.includes('Permission') || err.message.includes('denied'))) {
        setShowPermissionsHelp(true);
      }
    }
  };

  // Recursive Renaming Logic
  const processRecursive = async (path: string) => {
    let count = 0;
    try {
      const result = await Filesystem.readdir({
        path: path,
        directory: Directory.ExternalStorage
      });

      for (const file of result.files) {
        const fullPath = path ? `${path}/${file.name}` : file.name;
        
        // 1. If it's a directory, go deeper first (bottom-up renaming)
        if (file.type === 'directory') {
          count += await processRecursive(fullPath);
        }

        // 2. Rename the current item if it has Hebrew
        if (containsHebrew(file.name)) {
          const newName = reverseHebrewInString(file.name);
          const newPath = path ? `${path}/${newName}` : newName;
          
          try {
            await Filesystem.rename({
              from: fullPath,
              to: newPath,
              directory: Directory.ExternalStorage
            });
            count++;
            addLog(`✅ שונה: ${file.name} -> ${newName}`);
          } catch (err) {
            addLog(`❌ נכשל בשינוי ${file.name}`);
          }
        }
      }
    } catch (err) {
      addLog(`⚠️ שגיאה בתיקייה ${path}`);
    }
    return count;
  };

  const handleDeepFix = async () => {
    setIsProcessing(true);
    addLog(`🚀 מתחיל תיקון עמוק (רקורסיבי) מתיקייה: ${currentPath || 'שורש'}`);
    
    const totalRenamed = await processRecursive(currentPath);
    
    setIsProcessing(false);
    addLog(`✨ סיימתי תיקון עמוק! שונו ${totalRenamed} פריטים (קבצים ותיקיות).`);
    loadDirectory(currentPath);
  };

  const handleRenameCurrentOnly = async () => {
    const itemsToFix = files.filter(f => f.hasHebrew);
    if (itemsToFix.length === 0) {
      addLog("ℹ️ אין פריטים עם עברית בתיקייה זו");
      return;
    }

    setIsProcessing(true);
    addLog(`🚀 מתחיל שינוי שמות ל-${itemsToFix.length} פריטים בתיקייה הנוכחית...`);
    
    let successCount = 0;
    for (const file of itemsToFix) {
      const newName = reverseHebrewInString(file.name);
      const newPath = currentPath ? `${currentPath}/${newName}` : newName;
      
      try {
        await Filesystem.rename({
          from: file.path,
          to: newPath,
          directory: Directory.ExternalStorage
        });
        successCount++;
        addLog(`✅ שונה: ${file.name}`);
      } catch (err) {
        addLog(`❌ נכשל: ${file.name}`);
      }
    }
    
    setIsProcessing(false);
    addLog(`✨ סיימתי! שונו ${successCount} פריטים.`);
    loadDirectory(currentPath);
  };

  const navigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    loadDirectory(parts.join('/'));
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-[#007AFF] selection:text-white" dir="rtl">
      <div className="max-w-2xl mx-auto p-4 md:p-8">
        
        {/* Header - Clean & Minimal */}
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-100">
              <ArrowRightLeft className="text-[#007AFF] w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">מתקן שמות שירים</h1>
              <div className="flex items-center gap-1 text-[#007AFF] text-[11px] font-semibold">
                <span>גרסת PRO 2.5</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setShowPermissionsHelp(!showPermissionsHelp)}
            className={`p-2.5 rounded-xl transition-all ${showPermissionsHelp ? 'bg-[#007AFF] text-white shadow-md' : 'bg-white text-gray-400 hover:text-gray-600 border border-gray-100 shadow-sm'}`}
          >
            <ShieldCheck size={20} />
          </button>
        </header>

        {/* Permission Help Panel */}
        <AnimatePresence>
          {showPermissionsHelp && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-8"
            >
              <div className="bg-white border border-blue-50 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-[#007AFF] font-bold">
                  <AlertCircle size={20} />
                  <h2>אישור הרשאות ניהול קבצים</h2>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">
                  כדי לשנות שמות של קבצים ותיקיות, אנדרואיד דורש אישור מיוחד. אם האפליקציה לא מצליחה לבצע שינויים, בצע את השלבים הבאים:
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    "כנס להגדרות המכשיר > אפליקציות",
                    "חפש את Hebrew Name Fixer",
                    "כנס להרשאות > קבצים ומדיה",
                    "בחר ב-'אפשר ניהול של כל הקבצים'"
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                      <div className="bg-[#007AFF] text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">{i+1}</div>
                      <p className="text-xs font-medium text-gray-700">{step}</p>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={requestBasicPermissions}
                  className="w-full py-3.5 bg-[#007AFF] text-white font-bold rounded-2xl hover:bg-[#0066D6] transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  <ShieldCheck size={18} />
                  בקש הרשאות בסיסיות
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Interface */}
        <main className="space-y-6">
          
          {/* File Explorer Card */}
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-xl">
                  <FolderOpen className="text-[#007AFF] w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">נתיב נוכחי</p>
                  <p className="text-xs font-semibold text-gray-700 truncate max-w-[180px]">
                    {currentPath || 'שורש המכשיר'}
                  </p>
                </div>
              </div>
              {currentPath && (
                <button 
                  onClick={navigateUp}
                  className="p-2.5 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-[#007AFF] hover:border-blue-100 transition-all shadow-sm"
                >
                  <ChevronLeft className="w-5 h-5 rotate-180" />
                </button>
              )}
            </div>

            <div className="h-[380px] overflow-y-auto custom-scrollbar bg-white">
              {files.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-300">
                  <RotateCcw size={40} className="animate-spin-slow mb-4 opacity-20" />
                  <p className="text-sm font-medium">טוען קבצים...</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {files.map((file, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => file.isDirectory && loadDirectory(file.path)}
                      className={`p-4 flex items-center justify-between hover:bg-gray-50/80 transition-colors group ${file.isDirectory ? 'cursor-pointer' : ''}`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`p-2.5 rounded-2xl transition-colors ${file.isDirectory ? 'bg-blue-50 text-[#007AFF]' : 'bg-gray-50 text-gray-400'}`}>
                          {file.isDirectory ? <FolderOpen size={18} /> : <FileAudio size={18} />}
                        </div>
                        <div className="truncate">
                          <p className={`text-sm font-semibold truncate ${file.isDirectory ? 'text-gray-900' : 'text-gray-600'}`}>
                            {file.name}
                          </p>
                          {file.hasHebrew && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <CheckCircle2 size={10} className="text-[#007AFF]" />
                              <p className="text-[10px] text-[#007AFF] font-bold">עברית מזוהה</p>
                            </div>
                          )}
                        </div>
                      </div>
                      {file.isDirectory && <ChevronLeft size={14} className="text-gray-300 group-hover:text-[#007AFF] transition-colors" />}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-6 bg-gray-50/50 border-t border-gray-50 space-y-3">
              <button 
                onClick={handleRenameCurrentOnly}
                disabled={isProcessing || !files.some(f => f.hasHebrew)}
                className="w-full py-4 bg-white border border-gray-100 text-gray-700 font-bold rounded-2xl flex items-center justify-center gap-3 shadow-sm hover:border-blue-100 hover:text-[#007AFF] transition-all disabled:opacity-50 disabled:grayscale"
              >
                <ArrowRightLeft size={18} />
                תקן רק בתיקייה זו
              </button>
              
              <button 
                onClick={handleDeepFix}
                disabled={isProcessing}
                className="w-full py-4 bg-[#007AFF] text-white font-bold rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20 hover:bg-[#0066D6] transition-all disabled:opacity-50 disabled:grayscale"
              >
                {isProcessing ? <RotateCcw className="animate-spin" size={18} /> : <Layers size={18} />}
                תיקון עמוק (כל עץ התיקיות)
              </button>
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">יומן פעילות</h3>
              <button onClick={() => setLogs([])} className="p-1.5 text-gray-300 hover:text-red-400 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
            <div className="h-36 overflow-y-auto font-mono text-[11px] space-y-2 custom-scrollbar">
              {logs.length === 0 && <p className="text-gray-300 italic">ממתין לפעולה...</p>}
              {logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 text-gray-500 border-r-2 border-blue-50 pr-3">
                  <span className="text-right leading-relaxed">{log}</span>
                </div>
              ))}
            </div>
          </div>

        </main>

        {/* Footer */}
        <footer className="mt-10 text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-100 shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              {platform} | {permissionStatus === 'granted' ? 'מורשה' : 'ממתין'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <Info size={12} />
            <p className="text-[10px] font-medium">האפליקציה משנה קבצים ישירות. מומלץ לגבות מידע חשוב.</p>
          </div>
        </footer>

      </div>

      <style>{`
        @import url('                                                       ;600;700;800&display=swap');
        
        body {
          font-family: 'Inter', sans-serif;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E5E7EB;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #D1D5DB;
        }
        
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
      `}</style>
    </div>
  );
}
