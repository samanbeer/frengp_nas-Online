import React from 'react';
import {
  Folder,
  FileImage,
  FileVideo,
  FileAudio,
  FileText,
  FileCode,
  FileArchive,
  File,
} from 'lucide-react';
import { getFileCategory } from './formatters';

export function getFileIcon(item, className = 'w-6 h-6') {
  if (item.isDirectory) {
    return <Folder className={`${className} text-amber-400 fill-amber-400/20`} />;
  }

  const category = getFileCategory(item.name);

  switch (category) {
    case 'image':
      return <FileImage className={`${className} text-rose-400 fill-rose-400/10`} />;
    case 'video':
      return <FileVideo className={`${className} text-purple-400 fill-purple-400/10`} />;
    case 'audio':
      return <FileAudio className={`${className} text-indigo-400 fill-indigo-400/10`} />;
    case 'pdf':
      return <FileText className={`${className} text-red-500 fill-red-500/10`} />;
    case 'code':
      return <FileCode className={`${className} text-emerald-400 fill-emerald-400/10`} />;
    case 'archive':
      return <FileArchive className={`${className} text-orange-400 fill-orange-400/10`} />;
    default:
      return <File className={`${className} text-slate-400 fill-slate-400/10`} />;
  }
}
