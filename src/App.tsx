import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderOpen, 
  FileAudio, 
  RotateCcw, 
  AlertCircle, 
  ArrowRightLeft,
  Trash2,
  ShieldCheck,
  ChevronLeft,
  Info,
  Layers,
  CheckCircle2,
  HardDrive,
  Home,
  Crown,
  Terminal,
  Edit3
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
  const [isAbsolute, setIsAbsolute] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [platform, setPlatform] = useState<'web' | 'android' | 'ios'>('web');
  const [showPermissionsHelp, setShowPermissionsHelp] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const [manualPath, setManualPath] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  
  // Progress State
  const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0 });
  const totalFilesToProcess = useRef(0);
  const processedCount = useRef(0);

  // Initialization
  useEffect(() => {
    const init = async () => {
      const info = await Device.getInfo();
      setPlatform(info.platform as any);
      
      if (info.platform === 'android') {
        checkPermissions();
        loadDirectory('', false);
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
      return status.publicStorage;
    } catch (err) {
      console.error(err);
      return 'unknown';
    }
  };

  const requestPermissions = async () => {
    try {
      addLog("🛡️ פותח הגדרות הרשאות מערכת...");
      await Filesystem.requestPermissions();
      const status = await checkPermissions();
      if (status === 'granted') {
        addLog("✅ הרשאה התקבלה!");
        setShowPermissionsHelp(false);
        loadDirectory(currentPath, isAbsolute);
      }
    } catch (err) {
      addLog("❌ שגיאה בבקשת הרשאות");
    }
  };

  // File Operations
  const loadDirectory = async (path: string, absolute: boolean) => {
    try {
      const options: any = { path };
      if (!absolute) {
        options.directory = Directory.ExternalStorage;
      }
      
      const result = await Filesystem.readdir(options);
      
      const mappedFiles: FileEntry[] = result.files.map(f => ({
        name: f.name,
        path: absolute ? (path.endsWith('/') ? `${path}${f.name}` : `${path}/${f.name}`) : (path ? `${path}/${f.name}` : f.name),
        isDirectory: f.type === 'directory',
        hasHebrew: containsHebrew(f.name)
      }));

      mappedFiles.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
        return a.isDirectory ? -1 : 1;
      });

      setFiles(mappedFiles);
      setCurrentPath(path);
      setIsAbsolute(absolute);
      addLog(`📂 נכנס ל: ${path || (absolute ? '/' : 'שורש פנימי')}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'נכשל';
      addLog(`❌ שגיאה בטעינת ${path || 'שורש'}: ${errorMsg}`);
      if (errorMsg.includes('Permission') || errorMsg.includes('denied')) {
        setShowPermissionsHelp(true);
      }
    }
  };

  // Recursive Count
  const countHebrewItems = async (path: string, absolute: boolean): Promise<number> => {
    let count = 0;
    try {
      const options: any = { path };
      if (!absolute) options.directory = Directory.ExternalStorage;
      const result = await Filesystem.readdir(options);

      for (const file of result.files) {
        if (containsHebrew(file.name)) count++;
        if (file.type === 'directory') {
          const fullPath = absolute 
            ? (path.endsWith('/') ? `${path}${file.name}` : `${path}/${file.name}`)
            : (path ? `${path}/${file.name}` : file.name);
          count += await countHebrewItems(fullPath, absolute);
        }
      }
    } catch (e) {}
    return count;
  };

  // Recursive Renaming
  const processRecursive = async (path: string, absolute: boolean) => {
    try {
      const options: any = { path };
      if (!absolute) options.directory = Directory.ExternalStorage;
      
      const result = await Filesystem.readdir(options);

      for (const file of result.files) {
        const fullPath = absolute 
          ? (path.endsWith('/') ? `${path}${file.name}` : `${path}/${file.name}`)
          : (path ? `${path}/${file.name}` : file.name);
        
        if (file.type === 'directory') {
          await processRecursive(fullPath, absolute);
        }

        if (containsHebrew(file.name)) {
          const newName = reverseHebrewInString(file.name);
          const newPath = absolute
            ? (path.endsWith('/') ? `${path}${newName}` : `${path}/${newName}`)
            : (path ? `${path}/${newName}` : newName);
          
          try {
            await Filesystem.rename({
              from: fullPath,
              to: newPath,
              directory: absolute ? undefined : Directory.ExternalStorage
            });
            processedCount.current++;
            const pct = Math.round((processedCount.current / totalFilesToProcess.current) * 100);
            setProgress({ current: processedCount.current, total: totalFilesToProcess.current, percentage: pct });
            addLog(`✅ שונה: ${file.name}`);
          } catch (err) {
            addLog(`❌ נכשל בשינוי ${file.name}`);
          }
        }
      }
    } catch (err) {
      addLog(`⚠️ שגיאה בתיקייה ${path}`);
    }
  };

  const handleDeepFix = async () => {
    setIsProcessing(true);
    setProgress({ current: 0, total: 0, percentage: 0 });
    addLog(`🔍 סורק קבצים לתיקון...`);
    
    const total = await countHebrewItems(currentPath, isAbsolute);
    if (total === 0) {
      addLog("ℹ️ לא נמצאו פריטים לתיקון.");
      setIsProcessing(false);
      return;
    }

    totalFilesToProcess.current = total;
    processedCount.current = 0;
    setProgress({ current: 0, total, percentage: 0 });
    
    addLog(`🚀 מתחיל תיקון עמוק ל-${total} פריטים...`);
    await processRecursive(currentPath, isAbsolute);
    
    setIsProcessing(false);
    addLog(`✨ סיימתי תיקון עמוק! שונו ${processedCount.current} פריטים.`);
    loadDirectory(currentPath, isAbsolute);
  };

  const handleRenameCurrentOnly = async () => {
    const itemsToFix = files.filter(f => f.hasHebrew);
    if (itemsToFix.length === 0) {
      addLog("ℹ️ אין פריטים עם עברית בתיקייה זו");
      return;
    }

    setIsProcessing(true);
    totalFilesToProcess.current = itemsToFix.length;
    processedCount.current = 0;
    setProgress({ current: 0, total: itemsToFix.length, percentage: 0 });
    
    addLog(`🚀 מתחיל שינוי שמות ל-${itemsToFix.length} פריטים...`);
    
    for (const file of itemsToFix) {
      const newName = reverseHebrewInString(file.name);
      const newPath = isAbsolute
        ? (currentPath.endsWith('/') ? `${currentPath}${newName}` : `${currentPath}/${newName}`)
        : (currentPath ? `${currentPath}/${newName}` : newName);
      
      try {
        await Filesystem.rename({
          from: file.path,
          to: newPath,
          directory: isAbsolute ? undefined : Directory.ExternalStorage
        });
        processedCount.current++;
        const pct = Math.round((processedCount.current / totalFilesToProcess.current) * 100);
        setProgress({ current: processedCount.current, total: totalFilesToProcess.current, percentage: pct });
        addLog(`✅ שונה: ${file.name}`);
      } catch (err) {
        addLog(`❌ נכשל: ${file.name}`);
      }
    }
    
    setIsProcessing(false);
    addLog(`✨ סיימתי! שונו ${processedCount.current} פריטים.`);
    loadDirectory(currentPath, isAbsolute);
  };

  const navigateUp = () => {
    if (!currentPath || currentPath === '/') {
      if (isAbsolute) {
        const parts = currentPath.split('/').filter(Boolean);
        if (parts.length === 0) return;
        parts.pop();
        loadDirectory('/' + parts.join('/'), true);
      }
      return;
    }
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const newPath = isAbsolute ? '/' + parts.join('/') : parts.join('/');
    loadDirectory(newPath, isAbsolute);
  };

  const handleManualPathSubmit = () => {
    if (!manualPath) return;
    loadDirectory(manualPath, true);
    setShowManualInput(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-[#007AFF] selection:text-white" dir="rtl">
      <div className="max-w-2xl mx-auto p-4 md:p-8">
        
        {/* Dedication Header - KING THEME */}
        <div className="mb-8 text-center">
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="inline-flex flex-col items-center gap-1"
          >
            <div className="flex items-center gap-4 px-8 py-4 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 rounded-3xl shadow-[0_10px_40px_rgba(234,179,8,0.3)] border-4 border-white">
              <Crown className="text-white w-10 h-10 fill-white drop-shadow-md" />
              <h2 className="text-4xl font-black text-white tracking-tighter drop-shadow-md">מוקדש ליאיר המלך</h2>
              <Crown className="text-white w-10 h-10 fill-white drop-shadow-md" />
            </div>
            <div className="mt-2 text-[10px] font-bold text-yellow-600 uppercase tracking-[0.3em]">Ultimate King Edition 5.0</div>
          </motion.div>
        </div>

        {/* App Header */}
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-100">
              <ArrowRightLeft className="text-[#007AFF] w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900">מתקן שמות שירים</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowManualInput(!showManualInput)}
              title="הזנת נתיב ידנית"
              className={`p-2.5 rounded-xl transition-all ${showManualInput ? 'bg-[#007AFF] text-white' : 'bg-white text-gray-400 border border-gray-100'}`}
            >
              <Edit3 size={20} />
            </button>
            <button 
              onClick={() => loadDirectory('/storage', true)}
              title="כוננים חיצוניים (SD/USB)"
              className="p-2.5 bg-white text-gray-400 hover:text-[#007AFF] border border-gray-100 rounded-xl shadow-sm transition-all"
            >
              <HardDrive size={20} />
            </button>
            <button 
              onClick={() => setShowPermissionsHelp(!showPermissionsHelp)}
              className={`p-2.5 rounded-xl transition-all ${showPermissionsHelp ? 'bg-[#007AFF] text-white shadow-md' : 'bg-white text-gray-400 hover:text-gray-600 border border-gray-100 shadow-sm'}`}
            >
              <ShieldCheck size={20} />
            </button>
          </div>
        </header>

        {/* Manual Path Input */}
        <AnimatePresence>
          {showManualInput && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex gap-2">
                <input 
                  type="text" 
                  value={manualPath}
                  onChange={(e) => setManualPath(e.target.value)}
                  placeholder="הקלד נתיב (למשל /storage/emulated/0)"
                  className="flex-1 bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-100 outline-none"
                />
                <button 
                  onClick={handleManualPathSubmit}
                  className="bg-[#007AFF] text-white px-6 rounded-2xl font-bold text-sm"
                >
                  עבור
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Permission Help Panel */}
        <AnimatePresence>
          {showPermissionsHelp && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-8"
            >
              <div className="bg-white border-2 border-red-50 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-red-500 font-bold">
                  <AlertCircle size={20} />
                  <h2>נדרשת הרשאת "גישה לכל הקבצים"</h2>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">
                  אנדרואיד חוסם גישה לכרטיס זיכרון ללא אישור מיוחד. בצע את השלבים הבאים:
                </p>
                
                {/* ADB Section */}
                <div className="bg-gray-900 rounded-2xl p-4 font-mono text-[10px] text-green-400 relative group">
                  <div className="flex items-center gap-2 mb-2 text-gray-400 border-b border-gray-800 pb-2">
                    <Terminal size={12} />
                    <span>פקודת ADB למתקדמים (מחשב)</span>
                  </div>
                  <code className="block break-all">
                    adb shell appops set hebrew.name.fixer.pro MANAGE_EXTERNAL_STORAGE allow
                  </code>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {[
                    "לחץ על הכפתור הכחול למטה",
                    "חפש את Hebrew Name Fixer ברשימה",
                    "סמן 'אפשר גישה לניהול כל הקבצים'"
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                      <div className="bg-[#007AFF] text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">{i+1}</div>
                      <p className="text-xs font-medium text-gray-700">{step}</p>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={requestPermissions}
                  className="w-full py-3.5 bg-[#007AFF] text-white font-bold rounded-2xl hover:bg-[#0066D6] transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  <ShieldCheck size={18} />
                  פתח הגדרות הרשאות
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress Bar */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-6 bg-white p-5 rounded-3xl border border-blue-50 shadow-sm"
            >
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">התקדמות תיקון</p>
                <p className="text-sm font-black text-[#007AFF]">{progress.percentage}%</p>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.percentage}%` }}
                  className="h-full bg-[#007AFF] shadow-[0_0_10px_rgba(0,122,255,0.4)]"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-2 font-medium text-center">
                מעבד פריט {progress.current} מתוך {progress.total}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Interface */}
        <main className="space-y-6">
          
          {/* File Explorer Card */}
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-blue-50 rounded-xl shrink-0">
                  {isAbsolute ? <HardDrive className="text-[#007AFF] w-5 h-5" /> : <Home className="text-[#007AFF] w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {isAbsolute ? 'אחסון חיצוני' : 'אחסון פנימי'}
                  </p>
                  <p className="text-xs font-semibold text-gray-700 truncate max-w-[180px]">
                    {currentPath || (isAbsolute ? '/' : 'שורש')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {isAbsolute && (
                  <button 
                    onClick={() => loadDirectory('', false)}
                    title="חזרה לאחסון פנימי"
                    className="p-2.5 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-[#007AFF] transition-all shadow-sm"
                  >
                    <Home size={18} />
                  </button>
                )}
                {currentPath && currentPath !== '/' && (
                  <button 
                    onClick={navigateUp}
                    className="p-2.5 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-[#007AFF] transition-all shadow-sm"
                  >
                    <ChevronLeft className="w-5 h-5 rotate-180" />
                  </button>
                )}
              </div>
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
                      onClick={() => file.isDirectory && loadDirectory(file.path, isAbsolute)}
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
            <p className="text-[10px] font-medium">מוקדש ליאיר המלך - גרסה 5.0</p>
          </div>
        </footer>

      </div>

      <style>{`
        @import url('                                                       ;600;700;800;900&display=swap');
        
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
