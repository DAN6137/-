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
  Crown
} from 'lucide-react';
import { motion } from 'motion/react';
import { reverseHebrewInString, containsHebrew } from './utils/hebrew';

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

  useEffect(() => {
    setIsInIframe(window.self !== window.top);
    // Set document direction to RTL for Hebrew
    document.documentElement.dir = 'rtl';
  }, []);

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 50));
  };

  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  const handleSelectFolder = async () => {
    if (isInIframe) {
      addLog("⚠️ גישה ישירה לתיקיות חסומה בתצוגה המקדימה. נא לפתוח בלשונית חדשה.");
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
      if (err instanceof Error && err.name === 'SecurityError') {
        addLog("💡 מגבלת אבטחה: נא לפתוח את האפליקציה בלשונית חדשה כדי להשתמש בתכונה זו.");
      }
    }
  };

  const handleSelectFiles = async () => {
    if (isInIframe) {
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
          addLog(`נוספו ${selectedFiles.length} קבצים (מצב העלאה/הורדה).`);
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

  const downloadFile = (file: FileItem) => {
    if (!file.blob) return;
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.newName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearFiles = () => {
    setFiles([]);
    setDirectoryHandle(null);
    addLog('הרשימה נוקתה.');
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center font-sans" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl hardware-card overflow-hidden"
      >
        {/* Iframe Warning */}
        {isInIframe && (
          <div className="bg-amber-500/20 border-b border-amber-500/30 p-3 flex items-center justify-between text-amber-200 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} />
              <span>מצב תצוגה מקדימה: שינוי שמות ישיר חסום מטעמי אבטחה.</span>
            </div>
            <button 
              onClick={handleOpenInNewTab}
              className="flex items-center gap-1 bg-amber-500 text-black px-2 py-1 rounded font-bold hover:bg-amber-400 transition-colors"
            >
              <ExternalLink size={12} />
              פתח בלשונית חדשה
            </button>
          </div>
        )}

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
            <span className={`status-dot ${directoryHandle ? 'status-online' : 'status-offline'}`} />
            <span className="text-[10px] font-mono uppercase tracking-widest opacity-50">
              {directoryHandle ? 'גישה_ישירה' : isInIframe ? 'מצב_מוגבל' : 'מוכן'}
            </span>
          </div>
        </div>

        {/* Main Controls */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={handleSelectFolder}
                className={`btn-primary flex items-center gap-2 cursor-pointer ${isInIframe ? 'opacity-50 grayscale' : ''}`}
                disabled={isProcessing}
              >
                <FolderOpen size={18} />
                בחר תיקייה
              </button>
              <button 
                onClick={handleSelectFiles}
                className="btn-secondary flex items-center gap-2 cursor-pointer"
                disabled={isProcessing}
              >
                <FileText size={18} />
                {isInIframe ? 'הוסף קבצים' : 'בחר קבצים'}
              </button>
              <button 
                onClick={clearFiles}
                className="btn-secondary flex items-center gap-2 text-red-400 border-red-900/30 cursor-pointer"
                disabled={isProcessing}
              >
                <Trash2 size={18} />
                נקה רשימה
              </button>
            </div>

            {/* File List */}
            <div className="lcd-display h-[400px] overflow-y-auto custom-scrollbar">
              {files.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
                  <FileAudio size={48} className="mb-4" />
                  <p className="text-lg font-bold">אין קבצים טעונים</p>
                  <p className="text-xs mt-2">
                    {isInIframe 
                      ? "השתמש ב'הוסף קבצים' או פתח בלשונית חדשה לגישה לתיקיות" 
                      : "בחר תיקייה או קבצים כדי להתחיל"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 border-b border-[#00ff9d11] hover:bg-[#00ff9d05] transition-colors">
                      <div className="flex-1 min-w-0 pl-4 text-right">
                        <div className="text-[10px] opacity-40 truncate">{file.name}</div>
                        <div className="text-sm font-bold truncate text-[#00ff9d]">{file.newName}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {file.status === 'pending' && <div className="text-[10px] opacity-50">ממתין</div>}
                        {file.status === 'success' && (
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-[#00ff9d]" />
                            {file.blob && (
                              <button 
                                onClick={() => downloadFile(file)}
                                className="p-1 bg-[#00ff9d22] rounded hover:bg-[#00ff9d44] text-[#00ff9d]"
                                title="הורד קובץ מתוקן"
                              >
                                <Download size={14} />
                              </button>
                            )}
                          </div>
                        )}
                        {file.status === 'error' && (
                          <div className="flex items-center gap-1 text-red-400">
                            <AlertCircle size={16} />
                            <span className="text-[10px]">{file.error}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar / Logs */}
          <div className="space-y-6">
            <div className="hardware-card p-4 bg-[#0a0a0a]">
              <h3 className="text-[10px] font-mono uppercase tracking-widest mb-3 opacity-50">יומן מערכת</h3>
              <div className="h-[200px] overflow-y-auto font-mono text-[10px] space-y-1 text-[#00ff9d88] text-right">
                {logs.length === 0 && <div className="opacity-30 italic">ממתין לפעולה...</div>}
                {logs.map((log, i) => (
                  <div key={i} className="border-r border-[#00ff9d33] pr-2">{`${log} <`}</div>
                ))}
              </div>
            </div>

            <button 
              onClick={processFiles}
              disabled={isProcessing || files.length === 0}
              className={`w-full py-4 rounded-lg flex items-center justify-center gap-3 font-bold text-lg transition-all
                ${isProcessing || files.length === 0 
                  ? 'bg-gray-800 text-gray-600 cursor-not-allowed' 
                  : 'bg-[#00ff9d] text-black hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(0,255,157,0.3)]'
                }`}
            >
              {isProcessing ? (
                <>
                  <RotateCcw className="animate-spin" />
                  מעבד...
                </>
              ) : (
                <>
                  <Play fill="currentColor" />
                  {isInIframe ? 'עבד קבצים' : 'התחל שינוי שם'}
                </>
              )}
            </button>

            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 leading-relaxed text-right">
              <p className="font-bold mb-1">⚠️ חשוב לדעת</p>
              בתצוגה המקדימה של AI Studio, חובה להשתמש בכפתור <b>"פתח בלשונית חדשה"</b> כדי לאפשר שינוי שמות ישיר בתיקיות. 
              בתוך חלון זה, ניתן רק לעבד קבצים בודדים אותם תצטרכו להוריד מחדש.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#0a0a0a] border-t border-[#333] flex justify-between items-center text-[10px] font-mono opacity-50">
          <div>מצב: {isInIframe ? 'חלון_מוגבל' : 'גישה_מלאה'}</div>
          <div>קידוד: UTF-8</div>
        </div>
      </motion.div>
    </div>
  );
}
