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
  Edit3,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Device } from '@capacitor/device';

// --- Utils ---
const containsHebrew = (str: string) => /[\u0590-\u05FF]/.test(str);

const reverseHebrewInString = (str: string, reverseWords: boolean, reverseChars: boolean) => {
  if (!reverseWords && !reverseChars) return str;
  
  // Match Hebrew blocks including spaces
  const hebrewRegex = /[\u0590-\u05FF\s]+/g;
  
  return str.replace(hebrewRegex, (match) => {
    // Split into words and spaces
    const parts = match.split(/(\s+)/);
    
    let processedParts = parts.map(part => {
      if (/[\u0590-\u05FF]/.test(part)) {
        return reverseChars ? part.split('').reverse().join('') : part;
      }
      return part;
    });

    if (reverseWords) {
      // Reverse the order of words but keep spaces in place? 
      // Actually, simple reverse() on the parts array is better
      processedParts = processedParts.reverse();
    }

    return processedParts.join('');
  });
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
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const [connectedDrives, setConnectedDrives] = useState<{name: string, path: string}[]>([]);
  const [manualPath, setManualPath] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [showPermissionsHelp, setShowPermissionsHelp] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Options
  const [revChars, setRevChars] = useState(true);
  const [revWords, setRevWords] = useState(false);

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
        refreshAll();
        loadDirectory('', false);
      }
    };
    init();

    // Auto refresh when returning to app
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAll();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    
    document.documentElement.dir = 'rtl';
    return () => window.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const refreshAll = () => {
    checkPermissions();
    scanDrives();
  };

  // Scan for connected drives
  const scanDrives = async () => {
    try {
      const result = await Filesystem.readdir({ path: '/storage' });
      const drives = result.files
        .filter(f => f.name !== 'self' && f.name !== 'emulated' && f.name !== 'container')
        .map(f => ({ name: `כונן חיצוני (${f.name})`, path: `/storage/${f.name}` }));
      
      setConnectedDrives([
        { name: 'אחסון פנימי', path: '/storage/emulated/0' },
        ...drives
      ]);
    } catch (e) {
      setConnectedDrives([{ name: 'אחסון פנימי', path: '/storage/emulated/0' }]);
    }
  };

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
      addLog("🛡️ מבקש הרשאות גישה לקבצים...");
      const status = await Filesystem.requestPermissions();
      setPermissionStatus(status.publicStorage);
      if (status.publicStorage === 'granted') {
        addLog("✅ הרשאה התקבלה! סורק כוננים...");
        scanDrives();
        loadDirectory(currentPath, isAbsolute);
      } else {
        addLog("⚠️ הרשאה נדחתה. לא ניתן לגשת לקבצים.");
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
      setSearchQuery(''); // Clear search on navigation
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
          const newName = reverseHebrewInString(file.name, revWords, revChars);
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
      const newName = reverseHebrewInString(file.name, revWords, revChars);
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

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-[#007AFF] selection:text-white" dir="rtl">
      <div className="max-w-md mx-auto p-4 md:p-6">
        
        {/* Dedication Header - KING THEME */}
        <div className="mb-10 text-center">
          <motion.div 
            initial={{ y: -30, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="inline-flex flex-col items-center gap-2"
          >
            <div className="flex items-center gap-6 px-8 py-4 bg-gradient-to-br from-yellow-300 via-yellow-500 to-orange-500 rounded-[32px] shadow-[0_15px_40px_rgba(234,179,8,0.3)] border-4 border-white relative">
              <div className="absolute -top-6 -right-6 rotate-12">
                <Crown className="text-yellow-200 w-12 h-12 fill-yellow-200 drop-shadow-xl opacity-40" />
              </div>
              <Crown className="text-white w-10 h-10 fill-white drop-shadow-lg" />
              <h2 className="text-3xl font-black text-white tracking-tighter drop-shadow-2xl">יאיר המלך</h2>
              <Crown className="text-white w-10 h-10 fill-white drop-shadow-lg" />
            </div>
            <div className="mt-4 text-xs font-black text-yellow-600 uppercase tracking-[0.4em] bg-yellow-100 px-4 py-1 rounded-full">KING EXPLORER 8.0 - FULL ACCESS</div>
          </motion.div>
        </div>

        {/* App Header */}
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md border border-gray-100">
              <ArrowRightLeft className="text-[#007AFF] w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-gray-900">מתקן שמות שירים</h1>
            </div>
          </div>
          <div className="flex gap-2">
            {permissionStatus !== 'granted' && (
              <button 
                onClick={requestPermissions}
                title="בקש הרשאות גישה"
                className="p-3 bg-red-500 text-white rounded-2xl shadow-lg shadow-red-500/20 animate-pulse"
              >
                <ShieldCheck size={24} />
              </button>
            )}
            <button 
              onClick={() => setShowManualInput(!showManualInput)}
              title="הזנת נתיב ידנית"
              className={`p-3 rounded-2xl transition-all ${showManualInput ? 'bg-[#007AFF] text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100 shadow-sm'}`}
            >
              <Edit3 size={24} />
            </button>
            <button 
              onClick={() => { scanDrives(); setShowManualInput(false); }}
              title="רענן כוננים"
              className="p-3 bg-white text-gray-400 hover:text-[#007AFF] border border-gray-100 rounded-2xl shadow-sm transition-all"
            >
              <RefreshCw size={24} />
            </button>
          </div>
        </header>

        {/* Drives Manager */}
        <div className="mb-6 overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex gap-2 min-w-max">
            {connectedDrives.map((drive, i) => (
              <button
                key={i}
                onClick={() => loadDirectory(drive.path, true)}
                className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-3 shadow-sm ${currentPath.startsWith(drive.path) ? 'bg-[#007AFF] text-white shadow-blue-500/20' : 'bg-white text-gray-500 border border-gray-100 hover:border-blue-200'}`}
              >
                <HardDrive size={16} className={currentPath.startsWith(drive.path) ? 'text-white' : 'text-[#007AFF]'} />
                {drive.name}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Breadcrumbs */}
        <div className="mb-6 space-y-4">
          {/* Options Toggles */}
          <div className="flex gap-2 mb-2">
            <button 
              onClick={() => setRevChars(!revChars)}
              className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all border ${revChars ? 'bg-blue-50 border-blue-200 text-[#007AFF]' : 'bg-white border-gray-100 text-gray-400'}`}
            >
              הפוך תווים: {revChars ? 'כן' : 'לא'}
            </button>
            <button 
              onClick={() => setRevWords(!revWords)}
              className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all border ${revWords ? 'bg-blue-50 border-blue-200 text-[#007AFF]' : 'bg-white border-gray-100 text-gray-400'}`}
            >
              הפוך סדר מילים: {revWords ? 'כן' : 'לא'}
            </button>
          </div>

          <div className="relative">
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חפש קבצים או תיקיות..."
              className="w-full bg-white border border-gray-100 rounded-2xl px-12 py-4 text-sm font-bold shadow-sm focus:border-blue-200 outline-none transition-all"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
              <RotateCcw size={18} className={isProcessing ? 'animate-spin' : ''} />
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-hide text-[10px] font-black uppercase tracking-wider text-gray-400">
            <button 
              onClick={() => loadDirectory('', false)}
              className="hover:text-[#007AFF] transition-colors shrink-0"
            >
              שורש
            </button>
            {currentPath.split('/').filter(Boolean).map((part, i, arr) => (
              <React.Fragment key={i}>
                <span className="opacity-30">/</span>
                <button 
                  onClick={() => {
                    const path = isAbsolute 
                      ? '/' + arr.slice(0, i + 1).join('/')
                      : arr.slice(0, i + 1).join('/');
                    loadDirectory(path, isAbsolute);
                  }}
                  className="hover:text-[#007AFF] transition-colors shrink-0 max-w-[100px] truncate"
                >
                  {part}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Manual Path Input */}
        <AnimatePresence>
          {showManualInput && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-white p-5 rounded-[32px] border border-gray-100 shadow-md flex gap-3">
                <input 
                  type="text" 
                  value={manualPath}
                  onChange={(e) => setManualPath(e.target.value)}
                  placeholder="הקלד נתיב (למשל /storage/A1B2-C3D4)"
                  className="flex-1 bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold focus:border-blue-200 outline-none transition-all"
                />
                <button 
                  onClick={handleManualPathSubmit}
                  className="bg-[#007AFF] text-white px-8 rounded-2xl font-black text-sm shadow-lg shadow-blue-500/20"
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
              <div className="bg-white border-4 border-blue-50 rounded-[40px] p-8 shadow-xl space-y-6">
                <div className="flex items-center gap-3 text-[#007AFF] font-black text-xl">
                  <AlertCircle size={24} />
                  <h2>צריך הרשאות גישה לקבצים</h2>
                </div>
                <p className="text-sm text-gray-500 font-medium leading-relaxed">
                  כדי שנוכל לתקן את שמות השירים, אנחנו צריכים הרשאה לגשת לאחסון של הטלפון.
                </p>
                
                <div className="grid grid-cols-1 gap-2">
                  {[
                    "לחץ על הכפתור למטה",
                    "אפשר גישה לניהול כל הקבצים",
                    "חזור לאפליקציה והמשך בתיקון"
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                      <div className="bg-[#007AFF] text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0">{i+1}</div>
                      <p className="text-xs font-medium text-gray-700">{step}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={requestPermissions}
                    className="flex-1 py-3.5 bg-[#007AFF] text-white font-bold rounded-2xl hover:bg-[#0066D6] transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                  >
                    <ShieldCheck size={18} />
                    בקש הרשאה
                  </button>
                  <button 
                    onClick={() => setShowPermissionsHelp(false)}
                    className="px-6 py-3.5 bg-gray-100 text-gray-500 font-bold rounded-2xl hover:bg-gray-200 transition-all"
                  >
                    סגור
                  </button>
                </div>
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

            <div className="h-[500px] overflow-y-auto custom-scrollbar bg-white">
              {filteredFiles.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-300 p-8 text-center">
                  <FolderOpen size={48} className="mb-4 opacity-10" />
                  <p className="text-sm font-bold text-gray-400">
                    {searchQuery ? 'לא נמצאו קבצים התואמים לחיפוש' : 'התיקייה ריקה'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filteredFiles.map((file, idx) => (
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
