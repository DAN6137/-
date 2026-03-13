import React, { useState, useEffect, useCallback } from 'react';
import { 
  FolderOpen, 
  FileAudio, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  ArrowRightLeft,
  Trash2,
  Settings,
  Crown,
  ChevronLeft,
  ShieldCheck,
  Info
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
    setLogs(prev => [msg, ...prev].slice(0, 30));
  };

  // Permissions
  const checkPermissions = async () => {
    try {
      const status = await Filesystem.checkPermissions();
      setPermissionStatus(status.publicStorage);
      if (status.publicStorage !== 'granted') {
        addLog("⚠️ חסרות הרשאות אחסון בסיסיות");
      }
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

      // Sort: Directories first, then files
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

  const handleRenameAll = async () => {
    const hebrewFiles = files.filter(f => !f.isDirectory && f.hasHebrew);
    if (hebrewFiles.length === 0) {
      addLog("ℹ️ אין קבצים עם עברית בתיקייה זו");
      return;
    }

    setIsProcessing(true);
    addLog(`🚀 מתחיל שינוי שמות ל-${hebrewFiles.length} קבצים...`);
    
    let successCount = 0;
    for (const file of hebrewFiles) {
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
        console.error(err);
      }
    }
    
    setIsProcessing(false);
    addLog(`✨ סיימתי! שונו ${successCount} קבצים.`);
    loadDirectory(currentPath); // Refresh
  };

  const navigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    loadDirectory(parts.join('/'));
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#00ff9d] selection:text-black" dir="rtl">
      <div className="max-w-2xl mx-auto p-4 md:p-8">
        
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#00ff9d] rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(0,255,157,0.4)]">
              <ArrowRightLeft className="text-black w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase italic">Hebrew Fixer <span className="text-[#00ff9d]">PRO</span></h1>
              <div className="flex items-center gap-1 text-[10px] font-bold text-[#00ff9d] opacity-80">
                <Crown size={10} />
                <span>גרסת יאיר המלך 2.0</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setShowPermissionsHelp(!showPermissionsHelp)}
            className={`p-3 rounded-xl transition-all ${showPermissionsHelp ? 'bg-[#00ff9d] text-black' : 'bg-[#111] text-white hover:bg-[#222]'}`}
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
              className="overflow-hidden mb-6"
            >
              <div className="bg-[#111] border border-amber-500/30 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <AlertCircle size={20} />
                  <h2>פתרון בעיית הרשאות (אנדרואיד 11+)</h2>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">
                  אנדרואיד דורש אישור מיוחד כדי לאפשר לאפליקציה לשנות שמות של קבצים. אם האפליקציה לא עובדת, בצע את הצעדים הבאים:
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                    <div className="bg-amber-500 text-black w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">1</div>
                    <p className="text-xs">כנס ל<b>הגדרות הטלפון</b> {'>'} <b>אפליקציות</b></p>
                  </div>
                  <div className="flex items-start gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                    <div className="bg-amber-500 text-black w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">2</div>
                    <p className="text-xs">חפש את <b>Hebrew Name Fixer</b></p>
                  </div>
                  <div className="flex items-start gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                    <div className="bg-amber-500 text-black w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">3</div>
                    <p className="text-xs">כנס ל<b>הרשאות</b> {'>'} <b>קבצים ומדיה</b></p>
                  </div>
                  <div className="flex items-start gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                    <div className="bg-amber-500 text-black w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">4</div>
                    <p className="text-xs font-bold text-white">סמן את האופציה: "אפשר ניהול של כל הקבצים"</p>
                  </div>
                </div>
                <button 
                  onClick={requestBasicPermissions}
                  className="w-full py-3 bg-amber-500 text-black font-bold rounded-xl hover:bg-amber-400 transition-colors flex items-center justify-center gap-2"
                >
                  <ShieldCheck size={18} />
                  בקש הרשאות בסיסיות (נסה קודם)
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Interface */}
        <main className="space-y-6">
          
          {/* File Explorer */}
          <div className="bg-[#111] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-3">
                <FolderOpen className="text-[#00ff9d] w-5 h-5" />
                <span className="text-xs font-mono text-gray-400 truncate max-w-[200px]">
                  {currentPath || 'שורש המכשיר'}
                </span>
              </div>
              {currentPath && (
                <button 
                  onClick={navigateUp}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 rotate-180" />
                </button>
              )}
            </div>

            <div className="h-[350px] overflow-y-auto custom-scrollbar">
              {files.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20">
                  <RotateCcw size={48} className="animate-spin-slow mb-4" />
                  <p className="text-sm">טוען קבצים...</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {files.map((file, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => file.isDirectory && loadDirectory(file.path)}
                      className={`p-4 flex items-center justify-between hover:bg-white/5 transition-colors group ${file.isDirectory ? 'cursor-pointer' : ''}`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`p-2 rounded-xl ${file.isDirectory ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-gray-500'}`}>
                          {file.isDirectory ? <FolderOpen size={18} /> : <FileAudio size={18} />}
                        </div>
                        <div className="truncate">
                          <p className={`text-sm font-medium truncate ${file.isDirectory ? 'text-blue-100' : 'text-gray-300'}`}>
                            {file.name}
                          </p>
                          {file.hasHebrew && !file.isDirectory && (
                            <p className="text-[10px] text-[#00ff9d] font-bold mt-0.5">עברית מזוהה ✨</p>
                          )}
                        </div>
                      </div>
                      {file.isDirectory && <ChevronLeft size={14} className="text-gray-600 group-hover:text-white transition-colors" />}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 bg-white/5">
              <button 
                onClick={handleRenameAll}
                disabled={isProcessing || !files.some(f => !f.isDirectory && f.hasHebrew)}
                className="w-full py-4 bg-[#00ff9d] text-black font-black rounded-2xl flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(0,255,157,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 disabled:grayscale disabled:scale-100"
              >
                {isProcessing ? <RotateCcw className="animate-spin" /> : <Play fill="currentColor" size={20} />}
                תקן את כל השמות בתיקייה זו
              </button>
            </div>
          </div>

          {/* Logs */}
          <div className="bg-[#111] rounded-2xl border border-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-gray-500">יומן פעילות</h3>
              <button onClick={() => setLogs([])} className="text-gray-600 hover:text-red-400 transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
            <div className="h-32 overflow-y-auto font-mono text-[10px] space-y-1.5 custom-scrollbar">
              {logs.length === 0 && <p className="text-gray-700 italic">ממתין לפעולה...</p>}
              {logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 text-gray-400">
                  <span className="text-[#00ff9d] shrink-0">›</span>
                  <span className="text-right">{log}</span>
                </div>
              ))}
            </div>
          </div>

        </main>

        {/* Footer */}
        <footer className="mt-8 text-center space-y-2">
          <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">
            Platform: {platform} | Status: {permissionStatus}
          </p>
          <div className="flex items-center justify-center gap-2 text-gray-700">
            <Info size={12} />
            <p className="text-[9px]">האפליקציה משנה קבצים ישירות בזיכרון המכשיר. השתמש באחריות.</p>
          </div>
        </footer>

      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #222;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #333;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
}
