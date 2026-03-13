import React, { useState, useEffect } from 'react';
import { 
  FolderOpen, 
  FileAudio, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  ArrowRightLeft,
  FileText,
  Trash2,
  ExternalLink,
  Download,
  Crown,
  Settings,
  Package,
  Github,
  Share2,
  Save
} from 'lucide-react';
import { motion } from 'motion/react';
import { reverseHebrewInString, containsHebrew } from './utils/hebrew';
import { Filesystem, Directory, PermissionStatus } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Device } from '@capacitor/device';

interface FileItem {
  name: string;
  newName: string;
  handle?: FileSystemFileHandle;
  file?: File;
  status: 'pending' | 'success' | 'error';
  error?: string;
  blob?: Blob;
}

export default function App() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isInIframe, setIsInIframe] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);
  const [appVersion] = useState('1.3.0-pro-mode');
  const [currentPath, setCurrentPath] = useState('');
  const [nativeFiles, setNativeFiles] = useState<{name: string, isDirectory: boolean}[]>([]);
  const [githubToken, setGithubToken] = useState('');
  const [buildStatus, setBuildStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [showBuildSettings, setShowBuildSettings] = useState(false);

  useEffect(() => {
    setIsInIframe(window.self !== window.top);
    
    const checkPlatform = async () => {
      const info = await Device.getInfo();
      setIsMobile(info.platform === 'android' || info.platform === 'ios');
      setIsNativeApp(info.platform !== 'web');
      
      if (info.platform === 'android') {
        // Start at root for Android
        setCurrentPath('');
        checkPermissions();
      }
    };
    checkPlatform();

    // Set document direction to RTL for Hebrew
    document.documentElement.dir = 'rtl';
  }, []);

  const checkPermissions = async () => {
    try {
      const status = await Filesystem.checkPermissions();
      setPermissionStatus(status);
      addLog(`מצב הרשאות: ${status.publicStorage}`);
    } catch (err) {
      console.error('Error checking permissions:', err);
    }
  };

  const requestPermissions = async () => {
    try {
      addLog("מבקש הרשאות אחסון...");
      const status = await Filesystem.requestPermissions();
      setPermissionStatus(status);
      addLog(`תוצאת בקשה: ${status.publicStorage}`);
      
      if (status.publicStorage !== 'granted') {
        addLog("⚠️ הרשאת אחסון לא אושרה. ייתכן שיהיה עליך לאשר ידנית בהגדרות.");
      }
    } catch (err) {
      addLog(`❌ שגיאה בבקשת הרשאות: ${err instanceof Error ? err.message : 'נכשל'}`);
    }
  };

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 50));
  };

  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  const handleSelectFolder = async () => {
    const forceMobile = isMobile || !('showDirectoryPicker' in window);
    
    if (isInIframe || forceMobile) {
      addLog("📱 מצב טלפון: בוחרים את כל הקבצים בבת אחת...");
      handleSelectFiles();
      return;
    }

    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite'
      });
      setDirectoryHandle(handle);
      addLog(`נבחרה תיקייה: ${handle.name}`);

      const fileList: FileItem[] = [];
      // @ts-ignore
      for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
          const name = entry.name;
          if (containsHebrew(name)) {
            fileList.push({
              name,
              newName: reverseHebrewInString(name),
              handle: entry as FileSystemFileHandle,
              status: 'pending'
            });
          }
        }
      }
      setFiles(fileList);
      addLog(`נמצאו ${fileList.length} קבצים עם שמות בעברית.`);
    } catch (err) {
      console.error(err);
      addLog(`שגיאה: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`);
    }
  };

  const handleSelectFiles = async () => {
    if (isInIframe || isMobile || !('showOpenFilePicker' in window)) {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.onchange = (e) => {
        const selectedFiles = (e.target as HTMLInputElement).files;
        if (selectedFiles) {
          const fileList: FileItem[] = Array.from(selectedFiles).map(file => ({
            name: file.name,
            newName: reverseHebrewInString(file.name),
            file: file,
            status: 'pending'
          }));
          setFiles(prev => [...prev, ...fileList]);
          addLog(`נוספו ${selectedFiles.length} קבצים.`);
        }
      };
      input.click();
      return;
    }

    try {
      // @ts-ignore
      const handles = await window.showOpenFilePicker({
        multiple: true,
        mode: 'readwrite'
      });
      
      const fileList: FileItem[] = [];
      for (const handle of handles) {
        const name = handle.name;
        fileList.push({
          name,
          newName: reverseHebrewInString(name),
          handle: handle as FileSystemFileHandle,
          status: 'pending'
        });
      }
      setFiles(prev => [...prev, ...fileList]);
      addLog(`נוספו ${handles.length} קבצים בודדים.`);
    } catch (err) {
      console.error(err);
      addLog(`שגיאה: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`);
    }
  };

  const processFiles = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    addLog(`מתחיל עיבוד...`);

    const updatedFiles = [...files];
    for (let i = 0; i < updatedFiles.length; i++) {
      const file = updatedFiles[i];
      if (file.status === 'success') continue;

      try {
        if (file.handle) {
          // @ts-ignore
          if (typeof file.handle.move === 'function') {
            // @ts-ignore
            await file.handle.move(file.newName);
            updatedFiles[i] = { ...file, status: 'success' };
            addLog(`שונה שם: ${file.name} -> ${file.newName}`);
          } else {
            throw new Error('שינוי שם לא נתמך בדפדפן זה');
          }
        } else if (file.file) {
          const blob = new Blob([file.file], { type: file.file.type });
          updatedFiles[i] = { ...file, status: 'success', blob };
          addLog(`עובד: ${file.name} (מוכן להורדה)`);
        }
      } catch (err) {
        console.error(err);
        updatedFiles[i] = { 
          ...file, 
          status: 'error', 
          error: err instanceof Error ? err.message : 'נכשל' 
        };
        addLog(`נכשל: ${file.name}`);
      }
      setFiles([...updatedFiles]);
    }
    setIsProcessing(false);
    addLog(`העיבוד הושלם.`);
  };

  const downloadFile = async (file: FileItem) => {
    if (!file.blob) return;

    if (isNativeApp) {
      try {
        const reader = new FileReader();
        reader.readAsDataURL(file.blob);
        reader.onloadend = async () => {
          const base64Data = (reader.result as string).split(',')[1];
          
          const savedFile = await Filesystem.writeFile({
            path: `MusicFix/${file.newName}`,
            data: base64Data,
            directory: Directory.Documents,
            recursive: true
          });

          addLog(`✅ נשמר: ${file.newName}`);
          
          await Share.share({
            title: 'שתף שיר מתוקן',
            text: file.newName,
            url: savedFile.uri,
            dialogTitle: 'איפה לשמור/לשתף?',
          });
        };
      } catch (err) {
        addLog(`❌ שגיאה בשמירה: ${err instanceof Error ? err.message : 'נכשל'}`);
      }
      return;
    }

    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.newName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const loadNativeDirectory = async (path: string) => {
    try {
      const result = await Filesystem.readdir({
        path: path,
        directory: Directory.ExternalStorage
      });
      
      setNativeFiles(result.files.map(f => ({
        name: f.name,
        isDirectory: f.type === 'directory'
      })));
      setCurrentPath(path);
      addLog(`📂 נכנס לתיקייה: ${path || 'שורש'}`);
    } catch (err) {
      addLog(`❌ שגיאה בגישה לתיקייה: ${err instanceof Error ? err.message : 'נכשל'}`);
      if (err instanceof Error && (err.message.includes('Permission') || err.message.includes('denied'))) {
        addLog("💡 שים לב: באנדרואיד 11 ומעלה, חובה לאשר 'גישה לכל הקבצים' (All Files Access) בהגדרות האפליקציה.");
        addLog("1. פתח הגדרות מכשיר > אפליקציות > מתקן שמות שירים");
        addLog("2. הרשאות > קבצים ומדיה > סמן 'אפשר ניהול של כל הקבצים'");
      }
    }
  };

  const renameInPlace = async () => {
    setIsProcessing(true);
    addLog(`🚀 מתחיל שינוי שמות במקום בתיקייה: ${currentPath}`);
    
    let count = 0;
    for (const file of nativeFiles) {
      if (!file.isDirectory && containsHebrew(file.name)) {
        const newName = reverseHebrewInString(file.name);
        try {
          await Filesystem.rename({
            from: `${currentPath}/${file.name}`,
            to: `${currentPath}/${newName}`,
            directory: Directory.ExternalStorage
          });
          count++;
          addLog(`✅ שונה: ${file.name} -> ${newName}`);
        } catch (err) {
          addLog(`❌ נכשל בשינוי ${file.name}: ${err instanceof Error ? err.message : 'שגיאה'}`);
        }
      }
    }
    
    setIsProcessing(false);
    addLog(`✨ סיימתי! שונו ${count} קבצים ישירות בתיקייה.`);
    loadNativeDirectory(currentPath);
  };

  const navigateUp = () => {
    const parts = currentPath.split('/');
    parts.pop();
    loadNativeDirectory(parts.join('/'));
  };

  const saveAllFiles = async () => {
    const successFiles = files.filter(f => f.status === 'success' && f.blob);
    if (successFiles.length === 0) {
      addLog('⚠️ אין קבצים מוכנים לשמירה');
      return;
    }

    setIsProcessing(true);
    addLog(`💾 שומר ${successFiles.length} קבצים...`);

    for (const file of successFiles) {
      await downloadFile(file);
    }

    setIsProcessing(false);
    addLog('✨ כל הקבצים נשמרו בתיקיית Documents/MusicFix');
  };

  const clearFiles = () => {
    setFiles([]);
    setDirectoryHandle(null);
    addLog('הרשימה נוקתה.');
  };

  const triggerGithubBuild = async () => {
    if (!githubToken) {
      addLog('❌ חסר קוד גישה (Token) של GitHub');
      setBuildStatus('error');
      return;
    }

    setBuildStatus('loading');
    addLog('🚀 שולח בקשה לבניית APK ב-GitHub...');

    try {
      const response = await fetch('https://api.github.com/repos/DAN6137/YAEIR/actions/workflows/android.yml/dispatches', {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${githubToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
        }),
      });

      if (response.ok) {
        setBuildStatus('success');
        addLog('✅ הבקשה התקבלה! הבנייה התחילה ב-GitHub.');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'נכשל לשלוח בקשה');
      }
    } catch (err) {
      console.error(err);
      setBuildStatus('error');
      addLog(`❌ שגיאה בבנייה: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center font-sans" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl hardware-card overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#333] flex items-center justify-between bg-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#00ff9d22] rounded-lg">
              <ArrowRightLeft className="text-[#00ff9d] w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">מתקן שמות שירים</h1>
              <div className="flex items-center gap-1 text-[#00ff9d] text-[10px] font-bold mt-1">
                <Crown size={10} />
                <span>מוקדש ליאיר המלך</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowBuildSettings(!showBuildSettings)}
              className={`p-2 rounded-lg transition-colors ${showBuildSettings ? 'bg-[#00ff9d] text-black' : 'bg-[#333] text-white hover:bg-[#444]'}`}
            >
              <Settings size={20} />
            </button>
            <span className={`status-dot ${directoryHandle ? 'status-online' : 'status-offline'}`} />
          </div>
        </div>

        {/* Build Settings Panel */}
        {showBuildSettings && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="bg-[#111] border-b border-[#333] p-6"
          >
            <div className="flex items-center gap-2 mb-4 text-[#00ff9d]">
              <Package size={20} />
              <h2 className="font-bold">אריזת אפליקציה (Android APK)</h2>
            </div>
            <div className="space-y-4 max-w-2xl">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-widest opacity-50 text-right">GitHub Access Token</label>
                <div className="flex gap-2">
                  <input 
                    type="password" 
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="הדבק כאן את ה-Token שלך..."
                    className="flex-1 bg-black border border-[#333] rounded px-3 py-2 text-sm font-mono text-[#00ff9d] outline-none text-right"
                  />
                  <button 
                    onClick={triggerGithubBuild}
                    disabled={buildStatus === 'loading'}
                    className="px-6 rounded font-bold bg-[#00ff9d] text-black hover:bg-[#00cc7e] disabled:bg-gray-800"
                  >
                    בנה APK
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Main Controls */}
        <div className="p-6">
          {isNativeApp ? (
            <div className="space-y-4">
              <div className="p-4 bg-[#1a1a1a] border border-[#333] rounded-xl">
                <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
                  <FolderOpen size={18} className="text-blue-400" />
                  סייר קבצים (שינוי שמות במקום)
                </h3>
                <div className="text-[10px] text-gray-400 mb-3 text-right">
                  נתיב נוכחי: <span className="font-mono text-blue-300">{currentPath || 'שורש'}</span>
                </div>
                
                <div className="flex gap-2 mb-4 justify-end">
                  {currentPath && (
                    <button onClick={navigateUp} className="px-3 py-1 bg-[#333] rounded-lg text-xs">תיקייה למעלה</button>
                  )}
                  <button onClick={() => loadNativeDirectory('')} className="px-3 py-1 bg-[#333] rounded-lg text-xs">חזור לשורש</button>
                </div>

                <div className="max-h-[250px] overflow-y-auto border border-[#222] rounded-lg bg-[#0a0a0a] mb-4 custom-scrollbar">
                  {nativeFiles.map((file, idx) => (
                    <div 
                      key={idx}
                      onClick={() => file.isDirectory && loadNativeDirectory(`${currentPath ? currentPath + '/' : ''}${file.name}`)}
                      className={`p-2 border-b border-[#111] flex items-center justify-between gap-2 text-xs ${file.isDirectory ? 'cursor-pointer text-blue-200' : 'text-gray-400'}`}
                    >
                      <div className="flex items-center gap-2">
                        {file.isDirectory ? <FolderOpen size={14} className="text-blue-400" /> : <FileAudio size={14} className="text-gray-500" />}
                        <span className="truncate">{file.name}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={renameInPlace}
                  disabled={isProcessing || !nativeFiles.some(f => !f.isDirectory && containsHebrew(f.name))}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <ArrowRightLeft size={20} />
                  שנה שמות לכל השירים בתיקייה זו
                </button>

                {/* Android Permission Help */}
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] text-amber-200">
                  <div className="font-bold flex items-center gap-2 mb-1">
                    <AlertCircle size={14} />
                    טיפול בהרשאות (אנדרואיד)
                  </div>
                  <p className="mb-2 text-right">אם האפליקציה לא מצליחה לשנות שמות, עליך לאשר "גישה לכל הקבצים":</p>
                  <ol className="list-decimal list-inside space-y-1 opacity-80 text-right">
                    <li>לחץ על "בקש הרשאות" למטה</li>
                    <li>אם זה לא עוזר, פתח את הגדרות האפליקציה בטלפון</li>
                    <li>כנס ל"הרשאות" -{'>'} "קבצים ומדיה"</li>
                    <li>בחר ב-"אפשר ניהול של כל הקבצים"</li>
                  </ol>
                  <button 
                    onClick={requestPermissions}
                    className="mt-3 w-full py-2 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded-lg transition-colors"
                  >
                    בקש הרשאות בסיסיות
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <div className="flex flex-wrap gap-3">
                  <button onClick={handleSelectFolder} className="btn-primary flex items-center gap-2">בחר תיקייה</button>
                  <button onClick={handleSelectFiles} className="btn-secondary flex items-center gap-2">בחר קבצים</button>
                </div>
                <div className="lcd-display h-[400px] overflow-y-auto custom-scrollbar">
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 border-b border-[#00ff9d11]">
                      <div className="flex-1 min-w-0 pl-4 text-right">
                        <div className="text-[10px] opacity-40 truncate">{file.name}</div>
                        <div className="text-sm font-bold truncate text-[#00ff9d]">{file.newName}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-6">
                <div className="hardware-card p-4 bg-[#0a0a0a]">
                  <h3 className="text-[10px] font-mono uppercase tracking-widest mb-3 opacity-50">יומן מערכת</h3>
                  <div className="h-[200px] overflow-y-auto font-mono text-[10px] space-y-1 text-[#00ff9d88] text-right">
                    {logs.map((log, i) => (
                      <div key={i} className="border-r border-[#00ff9d33] pr-2">{`${log} <`}</div>
                    ))}
                  </div>
                </div>
                <button 
                  onClick={processFiles}
                  disabled={isProcessing || files.length === 0}
                  className="w-full py-4 rounded-lg bg-[#00ff9d] text-black font-bold text-lg"
                >
                  התחל שינוי שם
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#0a0a0a] border-t border-[#333] flex justify-between items-center text-[10px] font-mono opacity-50">
          <div>מצב: {isNativeApp ? 'אנדרואיד' : 'גישה_מלאה'} | גרסה: {appVersion}</div>
        </div>
      </motion.div>
    </div>
  );
}
