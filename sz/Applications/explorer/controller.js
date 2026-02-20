;(function() {
  'use strict';

  const { User32, Kernel32, Shell32, Advapi32 } = SZ.Dlls;

  // =========================================================================
  // SVG icons for object-browser types (16x16 viewBox)
  // =========================================================================
  const ICONS = {
    root:       '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="10" rx="1" fill="#6baed6" stroke="#2171b5" stroke-width=".8"/><rect x="2" y="2" width="12" height="8" fill="#deebf7"/><rect x="5" y="12" width="6" height="1" fill="#999"/><rect x="4" y="13" width="8" height="1.5" rx=".5" fill="#bbb"/></svg>',
    object:     '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="14" height="10" rx="1" fill="#f5d66b" stroke="#c5a028" stroke-width=".5"/><path d="M1 4V3Q1 2 2 2H6L8 4" fill="#e8c44a" stroke="#c5a028" stroke-width=".5"/></svg>',
    objectOpen: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="14" height="10" rx="1" fill="#f5d66b" stroke="#c5a028" stroke-width=".5"/><path d="M1 4V3Q1 2 2 2H6L8 4" fill="#e8c44a" stroke="#c5a028" stroke-width=".5"/><path d="M2 6H14L13 14H1Z" fill="#fde68a" stroke="#c5a028" stroke-width=".3"/></svg>',
    array:      '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="1" width="12" height="14" rx="1" fill="#dbeafe" stroke="#3b82f6" stroke-width=".6"/><rect x="4" y="4" width="8" height="1.5" rx=".5" fill="#3b82f6" opacity=".5"/><rect x="4" y="7" width="8" height="1.5" rx=".5" fill="#3b82f6" opacity=".5"/><rect x="4" y="10" width="8" height="1.5" rx=".5" fill="#3b82f6" opacity=".5"/></svg>',
    map:        '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="2" width="14" height="12" rx="1" fill="#fef3c7" stroke="#d97706" stroke-width=".6"/><line x1="8" y1="2" x2="8" y2="14" stroke="#d97706" stroke-width=".4"/><line x1="1" y1="8" x2="15" y2="8" stroke="#d97706" stroke-width=".4"/></svg>',
    set:        '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="8" r="5" fill="none" stroke="#7c3aed" stroke-width=".7"/><circle cx="10" cy="8" r="5" fill="none" stroke="#7c3aed" stroke-width=".7"/></svg>',
    class:      '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#c084fc" stroke="#7c3aed" stroke-width=".6"/><rect x="3" y="3" width="10" height="3" rx=".5" fill="#7c3aed" opacity=".3"/><rect x="3" y="7" width="7" height="1" fill="#7c3aed" opacity=".4"/><rect x="3" y="9.5" width="9" height="1" fill="#7c3aed" opacity=".4"/><rect x="3" y="12" width="5" height="1" fill="#7c3aed" opacity=".4"/></svg>',
    function:   '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#86efac" stroke="#16a34a" stroke-width=".6"/><path d="M6 4Q6 3 7.5 3Q9 3 9 4.5V7H6.5M9 7H11M9 7V11Q9 13 7.5 13Q6 13 6 12" fill="none" stroke="#166534" stroke-width="1.2" stroke-linecap="round"/></svg>',
    instance:   '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M8 1L15 5V11L8 15L1 11V5Z" fill="#93c5fd" stroke="#2563eb" stroke-width=".6"/><circle cx="8" cy="8" r="2" fill="#2563eb"/></svg>',
    string:     '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#fed7aa" stroke="#ea580c" stroke-width=".6"/><path d="M5 4V6Q5 7 6 7M5 5Q5 4 6 4M9 4V6Q9 7 10 7M9 5Q9 4 10 4" stroke="#c2410c" stroke-width="1" fill="none" stroke-linecap="round"/></svg>',
    number:     '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#bfdbfe" stroke="#2563eb" stroke-width=".6"/><path d="M5 4L7 12M9 4L11 12M4 7H12M4 9.5H12" stroke="#1d4ed8" stroke-width=".8" fill="none" stroke-linecap="round"/></svg>',
    boolean:    '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#bbf7d0" stroke="#16a34a" stroke-width=".6"/><path d="M4 8L7 11L12 5" fill="none" stroke="#166534" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    null:       '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6" fill="#f1f5f9" stroke="#94a3b8" stroke-width=".6"/><line x1="4" y1="4" x2="12" y2="12" stroke="#94a3b8" stroke-width=".8"/></svg>',
    undefined:  '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6" fill="#f1f5f9" stroke="#cbd5e1" stroke-width=".6" stroke-dasharray="2 2"/></svg>',
    symbol:     '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#fecdd3" stroke="#e11d48" stroke-width=".6"/><circle cx="8" cy="7" r="3" fill="none" stroke="#be123c" stroke-width="1"/><line x1="8" y1="10" x2="8" y2="13" stroke="#be123c" stroke-width="1"/></svg>',
    bigint:     '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#c7d2fe" stroke="#4f46e5" stroke-width=".6"/><path d="M5 4L7 12M9 4L11 12M4 7H12M4 9.5H12" stroke="#4338ca" stroke-width=".8" fill="none" stroke-linecap="round"/></svg>',
    regexp:     '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#fecdd3" stroke="#dc2626" stroke-width=".6"/><path d="M4 12L7 4M9 4L12 12" stroke="#dc2626" stroke-width=".8" fill="none" stroke-linecap="round"/><circle cx="8" cy="9" r="1.5" fill="#dc2626"/></svg>',
    date:       '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="3" width="14" height="12" rx="1" fill="#fff" stroke="#4b5563" stroke-width=".6"/><rect x="1" y="3" width="14" height="3.5" rx="1" fill="#ef4444"/><circle cx="4.5" cy="9" r=".8" fill="#4b5563"/><circle cx="8" cy="9" r=".8" fill="#4b5563"/><circle cx="11.5" cy="9" r=".8" fill="#4b5563"/><circle cx="4.5" cy="12" r=".8" fill="#4b5563"/><circle cx="8" cy="12" r=".8" fill="#4b5563"/></svg>',
    element:    '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#e0f2fe" stroke="#0284c7" stroke-width=".6"/><path d="M5 5L2 8L5 11M11 5L14 8L11 11" fill="none" stroke="#0369a1" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error:      '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6" fill="#fca5a5" stroke="#dc2626" stroke-width=".6"/><line x1="5.5" y1="5.5" x2="10.5" y2="10.5" stroke="#dc2626" stroke-width="1.2"/><line x1="10.5" y1="5.5" x2="5.5" y2="10.5" stroke="#dc2626" stroke-width="1.2"/></svg>',
    unknown:    '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#f1f5f9" stroke="#94a3b8" stroke-width=".6"/><circle cx="8" cy="7.5" r="3" fill="none" stroke="#64748b" stroke-width="1"/><line x1="8" y1="10.5" x2="8" y2="10.6" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/></svg>',
    vfsFolder:  '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="14" height="10" rx="1" fill="#fbbf24" stroke="#b45309" stroke-width=".6"/><path d="M1 4V3Q1 2 2 2H6L8 4" fill="#f59e0b" stroke="#b45309" stroke-width=".6"/></svg>',
    vfsFolderOpen: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="14" height="10" rx="1" fill="#fbbf24" stroke="#b45309" stroke-width=".6"/><path d="M1 4V3Q1 2 2 2H6L8 4" fill="#f59e0b" stroke="#b45309" stroke-width=".6"/><path d="M2 6H14L13 14H1Z" fill="#fde68a" stroke="#b45309" stroke-width=".3"/></svg>',
    vfsFile:    '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M3 1H10L13 4V14Q13 15 12 15H4Q3 15 3 14Z" fill="#fff" stroke="#6b7280" stroke-width=".6"/><path d="M10 1V4H13" fill="#e5e7eb" stroke="#6b7280" stroke-width=".4"/><line x1="5" y1="7" x2="11" y2="7" stroke="#9ca3af" stroke-width=".6"/><line x1="5" y1="9" x2="11" y2="9" stroke="#9ca3af" stroke-width=".6"/><line x1="5" y1="11" x2="9" y2="11" stroke="#9ca3af" stroke-width=".6"/></svg>',
    vfsDrive:   '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="14" height="9" rx="1" fill="#e5e7eb" stroke="#4b5563" stroke-width=".6"/><rect x="3" y="6" width="5" height="3" rx=".5" fill="#bfdbfe" stroke="#3b82f6" stroke-width=".4"/><circle cx="12" cy="10" r="1" fill="#22c55e"/></svg>',
    pin:        '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M8 1L10 5H13L10 8V12L8 15L6 12V8L3 5H6Z" fill="#ef4444" stroke="#b91c1c" stroke-width=".6"/></svg>',
    bookmark:   '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M4 1H12V15L8 11L4 15Z" fill="#3b82f6" stroke="#1d4ed8" stroke-width=".5"/></svg>',
    storage:    '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="3" width="12" height="10" rx="1" fill="#e5e7eb" stroke="#6b7280" stroke-width=".6"/><rect x="3" y="5" width="10" height="2" rx=".5" fill="#3b82f6"/></svg>',
    clock:      '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6" fill="#fef3c7" stroke="#d97706" stroke-width=".6"/><line x1="8" y1="4" x2="8" y2="8" stroke="#d97706" stroke-width="1"/><line x1="8" y1="8" x2="11" y2="10" stroke="#d97706" stroke-width="1"/></svg>',
    places:     '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M8 1L10 6H15L11 9L13 14L8 11L3 14L5 9L1 6H6Z" fill="#f59e0b" stroke="#b45309" stroke-width=".5"/></svg>',
    // Context menu icons
    ctxOpen:    '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="14" height="10" rx="1" fill="#fbbf24" stroke="#b45309" stroke-width=".6"/><path d="M1 4V3Q1 2 2 2H6L8 4" fill="#f59e0b" stroke="#b45309" stroke-width=".6"/><path d="M2 6H14L13 14H1Z" fill="#fde68a" stroke="#b45309" stroke-width=".3"/></svg>',
    ctxOpenTab: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="3" width="14" height="12" rx="1" fill="#e5e7eb" stroke="#6b7280" stroke-width=".6"/><rect x="1" y="1" width="6" height="3" rx=".5" fill="#3b82f6"/><line x1="12" y1="8" x2="12" y2="12" stroke="#22c55e" stroke-width="1.2"/><line x1="10" y1="10" x2="14" y2="10" stroke="#22c55e" stroke-width="1.2"/></svg>',
    ctxCut:     '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="12" r="2.5" fill="none" stroke="#dc2626" stroke-width="1"/><circle cx="11" cy="12" r="2.5" fill="none" stroke="#dc2626" stroke-width="1"/><line x1="5" y1="10" x2="11" y2="2" stroke="#dc2626" stroke-width="1.2"/><line x1="11" y1="10" x2="5" y2="2" stroke="#dc2626" stroke-width="1.2"/></svg>',
    ctxCopy:    '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="10" height="11" rx="1" fill="#fff" stroke="#3b82f6" stroke-width=".8"/><rect x="2" y="1" width="10" height="11" rx="1" fill="#dbeafe" stroke="#3b82f6" stroke-width=".8"/></svg>',
    ctxPaste:   '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="11" height="12" rx="1" fill="#fef3c7" stroke="#d97706" stroke-width=".6"/><rect x="5" y="1" width="6" height="3" rx=".5" fill="#d97706"/><line x1="5" y1="8" x2="12" y2="8" stroke="#d97706" stroke-width=".6"/><line x1="5" y1="10" x2="10" y2="10" stroke="#d97706" stroke-width=".6"/></svg>',
    ctxDelete:  '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="8" height="10" rx="1" fill="#fecaca" stroke="#dc2626" stroke-width=".6"/><rect x="3" y="2" width="10" height="2" rx=".5" fill="#dc2626"/><line x1="6" y1="6" x2="6" y2="12" stroke="#dc2626" stroke-width=".7"/><line x1="8" y1="6" x2="8" y2="12" stroke="#dc2626" stroke-width=".7"/><line x1="10" y1="6" x2="10" y2="12" stroke="#dc2626" stroke-width=".7"/></svg>',
    ctxRename:  '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M2 13L11 4L13 6L4 15H2Z" fill="#93c5fd" stroke="#2563eb" stroke-width=".6"/><path d="M11 4L12 3L14 5L13 6" fill="#2563eb"/><line x1="2" y1="15" x2="5" y2="15" stroke="#2563eb" stroke-width=".8"/></svg>',
    ctxNewFolder: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="14" height="10" rx="1" fill="#fbbf24" stroke="#b45309" stroke-width=".6"/><path d="M1 4V3Q1 2 2 2H6L8 4" fill="#f59e0b" stroke="#b45309" stroke-width=".6"/><line x1="8" y1="7" x2="8" y2="12" stroke="#fff" stroke-width="1.5"/><line x1="5.5" y1="9.5" x2="10.5" y2="9.5" stroke="#fff" stroke-width="1.5"/></svg>',
    ctxNewFile: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M3 1H10L13 4V14Q13 15 12 15H4Q3 15 3 14Z" fill="#fff" stroke="#6b7280" stroke-width=".6"/><path d="M10 1V4H13" fill="#e5e7eb" stroke="#6b7280" stroke-width=".4"/><line x1="8" y1="7" x2="8" y2="12" stroke="#22c55e" stroke-width="1.2"/><line x1="5.5" y1="9.5" x2="10.5" y2="9.5" stroke="#22c55e" stroke-width="1.2"/></svg>',
    ctxProperties: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6" fill="#e0f2fe" stroke="#0284c7" stroke-width=".8"/><line x1="8" y1="7" x2="8" y2="12" stroke="#0284c7" stroke-width="1.2"/><circle cx="8" cy="5" r="1" fill="#0284c7"/></svg>',
    ctxRefresh: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M13 8A5 5 0 1 1 8 3" fill="none" stroke="#16a34a" stroke-width="1.2"/><path d="M8 1L11 3L8 5" fill="none" stroke="#16a34a" stroke-width="1.2" stroke-linejoin="round"/></svg>',
    ctxDownload: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M8 2V10" stroke="#3b82f6" stroke-width="1.2"/><path d="M5 8L8 11L11 8" fill="none" stroke="#3b82f6" stroke-width="1.2" stroke-linejoin="round"/><line x1="3" y1="13" x2="13" y2="13" stroke="#3b82f6" stroke-width="1.2"/></svg>',
    ctxCopyPath: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="10" height="11" rx="1" fill="#dbeafe" stroke="#3b82f6" stroke-width=".6"/><line x1="5" y1="7" x2="11" y2="7" stroke="#3b82f6" stroke-width=".8"/><line x1="5" y1="9.5" x2="9" y2="9.5" stroke="#3b82f6" stroke-width=".8"/></svg>',
    ctxFolderSel: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="14" height="10" rx="1" fill="#fbbf24" stroke="#b45309" stroke-width=".6"/><path d="M1 4V3Q1 2 2 2H6L8 4" fill="#f59e0b" stroke="#b45309" stroke-width=".6"/><path d="M6 8L8 10L11 7" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    ctxMount:   '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="14" height="9" rx="1" fill="#e5e7eb" stroke="#4b5563" stroke-width=".6"/><rect x="3" y="6" width="5" height="3" rx=".5" fill="#bfdbfe" stroke="#3b82f6" stroke-width=".4"/><circle cx="12" cy="10" r="1" fill="#22c55e"/><path d="M8 1V4" stroke="#4b5563" stroke-width="1"/></svg>',
    ctxUnmount: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M5 2L8 5L11 2" fill="none" stroke="#dc2626" stroke-width="1.2" stroke-linejoin="round"/><rect x="1" y="6" width="14" height="9" rx="1" fill="#e5e7eb" stroke="#4b5563" stroke-width=".6"/><rect x="3" y="8" width="5" height="3" rx=".5" fill="#fecaca" stroke="#dc2626" stroke-width=".4"/></svg>',
    ctxNewTab:  '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="3" width="14" height="12" rx="1" fill="#e5e7eb" stroke="#6b7280" stroke-width=".6"/><rect x="1" y="1" width="6" height="3" rx=".5" fill="#3b82f6"/><line x1="8" y1="7" x2="8" y2="13" stroke="#22c55e" stroke-width="1.2"/><line x1="5" y1="10" x2="11" y2="10" stroke="#22c55e" stroke-width="1.2"/></svg>',
    ctxDupTab:  '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="3" width="14" height="12" rx="1" fill="#e5e7eb" stroke="#6b7280" stroke-width=".6"/><rect x="1" y="1" width="5" height="3" rx=".5" fill="#3b82f6"/><rect x="7" y="1" width="5" height="3" rx=".5" fill="#60a5fa"/></svg>',
    ctxSplitR:  '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="1" fill="#e5e7eb" stroke="#6b7280" stroke-width=".8"/><line x1="8" y1="1" x2="8" y2="15" stroke="#3b82f6" stroke-width="1"/></svg>',
    ctxSplitB:  '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="1" fill="#e5e7eb" stroke="#6b7280" stroke-width=".8"/><line x1="1" y1="8" x2="15" y2="8" stroke="#3b82f6" stroke-width="1"/></svg>',
    ctxClose:   '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><line x1="4" y1="4" x2="12" y2="12" stroke="#dc2626" stroke-width="1.5"/><line x1="12" y1="4" x2="4" y2="12" stroke="#dc2626" stroke-width="1.5"/></svg>',
    ctxExpand:  '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="14" height="10" rx="1" fill="#fbbf24" stroke="#b45309" stroke-width=".6"/><path d="M1 4V3Q1 2 2 2H6L8 4" fill="#f59e0b" stroke="#b45309" stroke-width=".6"/><path d="M5 8L8 11L11 8" fill="none" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg>',
    ctxCollapse:'<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="14" height="10" rx="1" fill="#fbbf24" stroke="#b45309" stroke-width=".6"/><path d="M1 4V3Q1 2 2 2H6L8 4" fill="#f59e0b" stroke="#b45309" stroke-width=".6"/><path d="M5 11L8 8L11 11" fill="none" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg>',
    ctxPreview: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M1 8Q4 3 8 3Q12 3 15 8Q12 13 8 13Q4 13 1 8Z" fill="#dbeafe" stroke="#2563eb" stroke-width=".6"/><circle cx="8" cy="8" r="2.5" fill="#2563eb"/><circle cx="8" cy="8" r="1" fill="#fff"/></svg>',
    ctxNew:     '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6" fill="#dcfce7" stroke="#22c55e" stroke-width=".8"/><line x1="8" y1="5" x2="8" y2="11" stroke="#22c55e" stroke-width="1.5"/><line x1="5" y1="8" x2="11" y2="8" stroke="#22c55e" stroke-width="1.5"/></svg>',
    ctxOpenWith:'<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#e0f2fe" stroke="#0284c7" stroke-width=".6"/><rect x="3" y="3" width="4" height="4" rx=".5" fill="#60a5fa"/><rect x="9" y="3" width="4" height="4" rx=".5" fill="#34d399"/><rect x="3" y="9" width="4" height="4" rx=".5" fill="#fbbf24"/><rect x="9" y="9" width="4" height="4" rx=".5" fill="#f87171"/></svg>',
    ctxRemove:  '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6" fill="#fecaca" stroke="#dc2626" stroke-width=".8"/><line x1="5" y1="8" x2="11" y2="8" stroke="#dc2626" stroke-width="1.5"/></svg>',
    ctxUnpin:   '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M8 1L10 5H13L10 8V12L8 15L6 12V8L3 5H6Z" fill="#f87171" stroke="#b91c1c" stroke-width=".6" opacity=".5"/><line x1="3" y1="3" x2="13" y2="13" stroke="#dc2626" stroke-width="1.2"/></svg>',
  };

  const CONTAINER_TYPES = new Set(['object', 'array', 'map', 'set', 'instance', 'class', 'element']);

  function iconFor(type) { return ICONS[type] || ICONS.unknown; }

  function _parseAppSvg(svgText) {
    const vbMatch = svgText.match(/viewBox="([^"]+)"/);
    const viewBox = vbMatch ? vbMatch[1] : '0 0 16 16';
    const inner = svgText.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    return { viewBox, inner };
  }

  const _VFSFILE_PARSED = _parseAppSvg(ICONS.vfsFile);

  function iconForVfsFile(name) {
    const dot = name.lastIndexOf('.');
    if (dot <= 0) return ICONS.vfsFile;
    const ext = name.slice(dot + 1).toLowerCase();
    const assoc = _fileAssocMap[ext];
    if (!assoc) return ICONS.vfsFile;
    const cached = _iconSvgCache.get(assoc.iconPath);
    if (!cached) return ICONS.vfsFile;
    return '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">'
      + '<svg viewBox="' + _VFSFILE_PARSED.viewBox + '" width="32" height="32">' + _VFSFILE_PARSED.inner + '</svg>'
      + '<rect x="17" y="17" width="15" height="15" rx="2" fill="#fff" stroke="#ccc" stroke-width=".5"/>'
      + '<svg viewBox="' + cached.viewBox + '" x="18" y="18" width="13" height="13">' + cached.inner + '</svg>'
      + '</svg>';
  }

  function iconForVfs(entry) { return entry.type === 'dir' ? ICONS.vfsFolder : iconForVfsFile(entry.name); }

  function treeIcon(type, open) {
    if (type === 'root') return ICONS.root;
    if (type === 'vfsDrive') return ICONS.vfsDrive;
    if (type === 'vfsFolder') return open ? ICONS.vfsFolderOpen : ICONS.vfsFolder;
    if (type === 'array') return ICONS.array;
    if (type === 'map') return ICONS.map;
    if (type === 'set') return ICONS.set;
    if (type === 'class') return ICONS.class;
    if (type === 'instance') return ICONS.instance;
    if (type === 'element') return ICONS.element;
    return open ? ICONS.objectOpen : ICONS.object;
  }

  // =========================================================================
  // Shared state (global across all panes)
  // =========================================================================
  let clipboard = null;
  let _fileAssocMap = {};
  const _iconSvgCache = new Map();
  let activeContextMenu = null;

  // Navigation pane
  let navPaneVisible = true;

  // Quick access + bookmarks + recents
  let quickAccessPaths = ['/vfs', '/vfs/user/documents'];
  let bookmarkPaths = [];
  let recentPaths = [];
  const MAX_RECENTS = 20;

  // Options
  let optFontSize = 12;
  let optRowSpacing = 'normal';
  let optIconZoom = 'medium';
  let optDefaultView = 'icons';

  // Folder size cache
  const _folderSizeCache = new Map();

  // File type operation constants
  const FO_RENAME = 'rename';

  // =========================================================================
  // DOM references (shared / top-level)
  // =========================================================================
  const uploadInput = document.getElementById('upload-input');
  const statusCount = document.getElementById('status-count');
  const statusInfo = document.getElementById('status-info');
  const statusViewMode = document.getElementById('status-view-mode');
  const statusLoadTime = document.getElementById('status-load-time');
  const statusScrollPct = document.getElementById('status-scroll-pct');
  const sidebar = document.getElementById('sidebar');
  const sidebarSections = document.getElementById('sidebar-sections');
  const sidebarFilter = document.getElementById('sidebar-filter');
  const paneRoot = document.getElementById('pane-root');

  // =========================================================================
  // VFS wrappers (via DLL APIs)
  // =========================================================================
  async function vfsList(path) {
    try {
      const names = await Kernel32.FindFirstFile(path);
      const entries = [];
      for (const name of names) {
        const fullPath = path === '/' ? '/' + name : path + '/' + name;
        try {
          const attrs = await Kernel32.GetFileAttributes(fullPath);
          entries.push({ name, type: attrs.kind === 'dir' ? 'dir' : 'file', size: attrs.size || 0, mtime: attrs.mtime || null });
        } catch {
          entries.push({ name, type: 'file', size: 0, mtime: null });
        }
      }
      return { entries };
    } catch (e) {
      return { error: e.message, entries: [] };
    }
  }

  async function vfsDelete(path) {
    try { await Kernel32.DeleteFile(path); return {}; }
    catch (e) { return { error: e.message }; }
  }

  async function vfsMkdir(path) {
    try { await Kernel32.CreateDirectory(path); return {}; }
    catch (e) { return { error: e.message }; }
  }

  async function vfsRename(oldPath, newPath) {
    try { await Shell32.SHFileOperation(FO_RENAME, oldPath, newPath); return {}; }
    catch (e) { return { error: e.message }; }
  }

  async function vfsCopy(src, dest) {
    try { await Kernel32.CopyFile(src, dest); return {}; }
    catch (e) { return { error: e.message }; }
  }

  async function vfsMove(src, dest) {
    try { await Kernel32.MoveFile(src, dest); return {}; }
    catch (e) { return { error: e.message }; }
  }

  async function vfsRead(path) {
    try { const content = await Kernel32.ReadAllBytes(path); return { data: content }; }
    catch (e) { return { error: e.message }; }
  }

  async function vfsWrite(path, data) {
    try {
      const tag = data != null && typeof data === 'object' ? Object.prototype.toString.call(data) : '';
      const isBinary = tag === '[object ArrayBuffer]' || ArrayBuffer.isView(data);
      if (isBinary)
        await Kernel32.WriteAllBytes(path, data);
      else
        await Kernel32.WriteFile(path, data);
      return {};
    } catch (e) {
      return { error: e.message };
    }
  }

  // =========================================================================
  // Object tree browsing (client-side)
  // =========================================================================
  const _OBJ_ROOTS = {};

  function _initObjectRoots() {
    try { const sz = window.parent.SZ; if (sz) { void sz.constructor; _OBJ_ROOTS['SZ'] = sz; } } catch {}
    try { const sys = window.parent.SZ?.system; if (sys) { void sys.constructor; _OBJ_ROOTS['system'] = sys; } } catch {}
    try { if (window.parent !== window) { void window.parent.constructor; _OBJ_ROOTS['parent'] = window.parent; } } catch {}
    _OBJ_ROOTS['self'] = window;
    try { const doc = window.parent.document; if (doc) { void doc.constructor; _OBJ_ROOTS['document'] = doc; } } catch {}
  }

  function _classifyObject(obj) {
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    const t = typeof obj;
    if (t === 'string') return 'string';
    if (t === 'number') return 'number';
    if (t === 'boolean') return 'boolean';
    if (t === 'symbol') return 'symbol';
    if (t === 'bigint') return 'bigint';
    if (t === 'function') {
      try { if (Function.prototype.toString.call(obj).startsWith('class ')) return 'class'; } catch {}
      return 'function';
    }
    if (t !== 'object') return 'unknown';
    if (Array.isArray(obj)) return 'array';
    if (obj instanceof RegExp) return 'regexp';
    if (obj instanceof Date) return 'date';
    if (obj instanceof Map) return 'map';
    if (obj instanceof Set) return 'set';
    if (obj instanceof Error) return 'error';
    if (typeof HTMLElement !== 'undefined' && obj instanceof HTMLElement) return 'element';
    try {
      const ctor = obj.constructor?.name;
      if (ctor && ctor !== 'Object') return 'instance';
    } catch {}
    return 'object';
  }

  function _browsePreview(obj, type) {
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    if (type === 'string') return JSON.stringify(obj.length > 100 ? obj.substring(0, 100) + '\u2026' : obj);
    if (type === 'number' || type === 'boolean' || type === 'bigint') return String(obj);
    if (type === 'symbol') return String(obj);
    if (type === 'function' || type === 'class') return (obj.name || '(anonymous)') + '()';
    if (type === 'array') return 'Array(' + obj.length + ')';
    if (type === 'regexp') return String(obj);
    if (type === 'date') return obj.toISOString();
    if (type === 'map') return 'Map(' + obj.size + ')';
    if (type === 'set') return 'Set(' + obj.size + ')';
    if (type === 'error') return obj.message || String(obj);
    if (type === 'element') return '<' + (obj.tagName || '?').toLowerCase() + (obj.id ? '#' + obj.id : '') + '>';
    if (type === 'instance') return obj.constructor?.name || 'Object';
    return 'Object';
  }

  function _browseDetail(obj, type) {
    if (type === 'function' || type === 'class') {
      try { return Function.prototype.toString.call(obj); } catch { return '[native code]'; }
    }
    if (type === 'string') return obj;
    if (type === 'regexp') return String(obj);
    return _browsePreview(obj, type);
  }

  function _countProps(obj) {
    if (obj == null) return 0;
    try { return Object.getOwnPropertyNames(obj).length; } catch { return 0; }
  }

  async function browse(path) {
    if (path === '/') {
      const entries = [];
      entries.push({
        name: 'vfs', type: 'vfsDrive', isContainer: true,
        childCount: 1, preview: 'Virtual File System',
      });
      for (const [name, obj] of Object.entries(_OBJ_ROOTS)) {
        try {
          const type = _classifyObject(obj);
          entries.push({
            name, type, isContainer: CONTAINER_TYPES.has(type),
            childCount: _countProps(obj),
            preview: _browsePreview(obj, type),
            detail: _browseDetail(obj, type),
          });
        } catch (e) {
          entries.push({ name, type: 'error', isContainer: false, childCount: 0, preview: e.message || 'Access denied' });
        }
      }
      return { entries, nodeType: 'root', preview: '\u00BBSynthelicZ\u00AB Root' };
    }

    const parts = path.split('/').filter(Boolean);
    if (!parts.length)
      return { error: 'Invalid path', entries: [] };

    let obj = _OBJ_ROOTS[parts[0]];
    if (obj === undefined && !_OBJ_ROOTS.hasOwnProperty(parts[0]))
      return { error: 'Root "' + parts[0] + '" not found', entries: [] };

    for (let i = 1; i < parts.length; ++i) {
      if (obj == null)
        return { error: 'Cannot navigate through null/undefined', entries: [] };
      try { obj = obj[parts[i]]; } catch (e) { return { error: e.message, entries: [] }; }
    }

    let nodeType, preview, detail;
    try {
      nodeType = _classifyObject(obj);
      preview = _browsePreview(obj, nodeType);
      detail = _browseDetail(obj, nodeType);
    } catch (e) {
      return { entries: [], nodeType: 'error', preview: e.message || 'Access denied', detail: '' };
    }

    if (!CONTAINER_TYPES.has(nodeType) && typeof obj !== 'function')
      return { entries: [], nodeType, preview, detail };

    let names;
    try { names = Object.getOwnPropertyNames(obj); } catch { return { entries: [], nodeType, preview, detail }; }

    const MAX = 2000;
    const entries = [];
    for (let i = 0; i < names.length && entries.length < MAX; ++i) {
      const name = names[i];
      try {
        const desc = Object.getOwnPropertyDescriptor(obj, name);
        let value, type;
        if (desc?.get && !('value' in desc)) {
          try { value = obj[name]; type = _classifyObject(value); }
          catch { type = 'error'; value = undefined; }
        } else if (desc) {
          value = desc.value;
          type = _classifyObject(value);
        } else {
          try { value = obj[name]; type = _classifyObject(value); }
          catch { type = 'error'; value = undefined; }
        }
        const isContainer = CONTAINER_TYPES.has(type);
        entries.push({
          name, type, isContainer,
          childCount: isContainer ? _countProps(value) : 0,
          preview: _browsePreview(value, type),
          detail: _browseDetail(value, type),
        });
      } catch (e) {
        entries.push({ name, type: 'error', isContainer: false, childCount: 0, preview: e.message });
      }
    }

    if (names.length > MAX)
      entries.push({ name: '\u2026 (' + (names.length - MAX) + ' more)', type: 'unknown', isContainer: false, childCount: 0, preview: 'truncated' });

    return { entries, nodeType, preview, detail };
  }

  // Resolve an object browser path to file content for pasting into VFS
  function _resolveObjectAsFile(path, name) {
    const parts = path.split('/').filter(Boolean);
    if (!parts.length) return null;
    let obj = _OBJ_ROOTS[parts[0]];
    if (obj === undefined && !_OBJ_ROOTS.hasOwnProperty(parts[0])) return null;
    for (let i = 1; i < parts.length; ++i) {
      if (obj == null) return null;
      try { obj = obj[parts[i]]; } catch { return null; }
    }
    const type = _classifyObject(obj);
    if (type === 'function' || type === 'class') {
      const src = Function.prototype.toString.call(obj);
      const fileName = (name || 'untitled') + '.js';
      return { name: fileName, data: src };
    }
    if (type === 'string')
      return { name: (name || 'untitled') + '.txt', data: obj };
    if (type === 'number' || type === 'boolean' || type === 'bigint')
      return { name: (name || 'untitled') + '.txt', data: String(obj) };
    if (type === 'object' || type === 'array' || type === 'instance') {
      try {
        const json = JSON.stringify(obj, null, 2);
        return { name: (name || 'untitled') + '.json', data: json };
      } catch { return null; }
    }
    if (type === 'regexp')
      return { name: (name || 'untitled') + '.txt', data: String(obj) };
    if (type === 'date')
      return { name: (name || 'untitled') + '.txt', data: obj.toISOString() };
    return null;
  }

  // =========================================================================
  // Path helpers
  // =========================================================================
  function formatPath(path) {
    if (path === '/') return 'SZ:\\';
    return 'SZ:\\' + path.slice(1).replace(/\//g, '\\');
  }

  function parsePath(input) {
    let path = input.trim().replace(/\\/g, '/');
    path = path.replace(/^SZ:\/?/i, '/');
    if (!path.startsWith('/')) path = '/' + path;
    if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);
    return path;
  }

  function parentPath(path) {
    if (path === '/') return '/';
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    return parts.length > 0 ? '/' + parts.join('/') : '/';
  }

  function childPath(base, name) {
    return base === '/' ? '/' + name : base + '/' + name;
  }

  function baseName(path) {
    if (path === '/') return '';
    const parts = path.split('/');
    return parts[parts.length - 1];
  }

  function isVfsPath(path) {
    return path === '/vfs' || path.startsWith('/vfs/');
  }

  function toVfsRelative(path) {
    if (path === '/vfs') return '/';
    return path.slice(4);
  }

  function isMountPath(path) {
    return path.startsWith('/vfs/mount/');
  }

  function isMountRoot(path) {
    const rel = toVfsRelative(path);
    const parts = rel.split('/').filter(Boolean);
    return parts.length === 2 && parts[0] === 'mount';
  }

  function getMountPrefix(path) {
    const rel = toVfsRelative(path);
    const parts = rel.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[0] === 'mount')
      return '/mount/' + parts[1];
    return null;
  }

  function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function formatDate(mtime) {
    if (!mtime) return '';
    try {
      const d = new Date(mtime);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  function getFileTypeLabel(entry) {
    if (entry.type === 'dir') return 'Folder';
    const dot = entry.name.lastIndexOf('.');
    if (dot > 0) return entry.name.slice(dot + 1).toUpperCase() + ' File';
    return 'File';
  }

  function getFileExtension(name) {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot).toLowerCase() : '';
  }

  function openFile(path, name) {
    const vfsPath = toVfsRelative(path);
    const ext = getFileExtension(name);
    User32.PostMessage('sz:shellExecute', { path: vfsPath, extension: ext });
  }

  // =========================================================================
  // Recents management
  // =========================================================================
  function addRecentPath(path) {
    if (!isVfsPath(path)) return;
    recentPaths = recentPaths.filter(p => p !== path);
    recentPaths.unshift(path);
    if (recentPaths.length > MAX_RECENTS) recentPaths.length = MAX_RECENTS;
    try { Advapi32.RegSetValue('explorer.recentPaths', JSON.stringify(recentPaths)); } catch {}
  }

  function loadRecentPaths() {
    try {
      const val = Advapi32.RegGetValue('explorer.recentPaths');
      if (val) recentPaths = JSON.parse(val);
    } catch {}
  }

  // =========================================================================
  // Bookmark management
  // =========================================================================
  function loadBookmarks() {
    try {
      const val = Advapi32.RegGetValue('explorer.bookmarks');
      if (val) bookmarkPaths = JSON.parse(val);
    } catch {}
  }

  function saveBookmarks() {
    try { Advapi32.RegSetValue('explorer.bookmarks', JSON.stringify(bookmarkPaths)); } catch {}
  }

  // =========================================================================
  // Quick access
  // =========================================================================
  function loadQuickAccess() {
    try {
      const val = Advapi32.RegGetValue('explorer.quickAccess');
      if (val) quickAccessPaths = JSON.parse(val);
    } catch {}
  }

  function saveQuickAccess() {
    try { Advapi32.RegSetValue('explorer.quickAccess', JSON.stringify(quickAccessPaths)); } catch {}
  }

  // =========================================================================
  // JS syntax highlighting
  // =========================================================================
  const _JS_KEYWORDS = new Set([
    'async','await','break','case','catch','class','const','continue',
    'debugger','default','delete','do','else','enum','export','extends',
    'false','finally','for','function','if','import','in','instanceof',
    'let','new','null','of','return','static','super','switch','this',
    'throw','true','try','typeof','undefined','var','void','while',
    'with','yield','get','set',
  ]);

  function highlightJS(code) {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const out = [];
    let i = 0;
    const len = code.length;

    while (i < len) {
      const ch = code[i];

      if (ch === '/' && code[i + 1] === '/') {
        const end = code.indexOf('\n', i);
        const slice = end === -1 ? code.slice(i) : code.slice(i, end);
        out.push('<span class="hl-comment">' + esc(slice) + '</span>');
        i += slice.length;
        continue;
      }
      if (ch === '/' && code[i + 1] === '*') {
        const end = code.indexOf('*/', i + 2);
        const slice = end === -1 ? code.slice(i) : code.slice(i, end + 2);
        out.push('<span class="hl-comment">' + esc(slice) + '</span>');
        i += slice.length;
        continue;
      }

      if (ch === '"' || ch === "'" || ch === '`') {
        let j = i + 1;
        while (j < len && code[j] !== ch) {
          if (code[j] === '\\') ++j;
          ++j;
        }
        if (j < len) ++j;
        out.push('<span class="hl-string">' + esc(code.slice(i, j)) + '</span>');
        i = j;
        continue;
      }

      if (/\d/.test(ch) || (ch === '.' && i + 1 < len && /\d/.test(code[i + 1]))) {
        let j = i;
        if (ch === '0' && (code[j + 1] === 'x' || code[j + 1] === 'X')) {
          j += 2;
          while (j < len && /[0-9a-fA-F_]/.test(code[j])) ++j;
        } else if (ch === '0' && (code[j + 1] === 'b' || code[j + 1] === 'B')) {
          j += 2;
          while (j < len && /[01_]/.test(code[j])) ++j;
        } else {
          while (j < len && /[\d._eE+\-]/.test(code[j])) ++j;
        }
        if (j < len && code[j] === 'n') ++j;
        out.push('<span class="hl-number">' + esc(code.slice(i, j)) + '</span>');
        i = j;
        continue;
      }

      if (/[a-zA-Z_$]/.test(ch)) {
        let j = i + 1;
        while (j < len && /[\w$]/.test(code[j])) ++j;
        const word = code.slice(i, j);
        if (_JS_KEYWORDS.has(word))
          out.push('<span class="hl-keyword">' + esc(word) + '</span>');
        else if (j < len && code[j] === '(')
          out.push('<span class="hl-func">' + esc(word) + '</span>');
        else
          out.push(esc(word));
        i = j;
        continue;
      }

      if (ch === '/' && i > 0) {
        const prev = code.slice(0, i).replace(/\s+$/, '');
        const last = prev[prev.length - 1];
        if (last && '=(!&|?:;,[{~+-*%^'.includes(last)) {
          let j = i + 1;
          while (j < len && code[j] !== '/' && code[j] !== '\n') {
            if (code[j] === '\\') ++j;
            ++j;
          }
          if (j < len && code[j] === '/') {
            ++j;
            while (j < len && /[gimsuy]/.test(code[j])) ++j;
            out.push('<span class="hl-regex">' + esc(code.slice(i, j)) + '</span>');
            i = j;
            continue;
          }
        }
      }

      out.push(esc(ch));
      ++i;
    }

    return out.join('');
  }

  // =========================================================================
  // Preview helpers
  // =========================================================================
  const _TEXT_EXTS = new Set(['txt','js','css','html','htm','json','xml','md','py','rb','pl','sh','bat','cmd','ini','cfg','conf','log','csv','tsv','yaml','yml','toml','rs','go','java','c','cpp','h','hpp','cs','ts','tsx','jsx','vue','svelte','php','sql','r','m','swift','kt','lua','ps1']);
  const _IMAGE_EXTS = new Set(['png','jpg','jpeg','gif','bmp','svg','webp','ico','avif']);
  const _AUDIO_EXTS = new Set(['mp3','wav','ogg','flac','aac','m4a','wma']);
  const _VIDEO_EXTS = new Set(['mp4','webm','ogv','avi','mkv','mov']);

  async function _toDataUri(data, name) {
    const ext = getFileExtension(name).replace('.', '');
    const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp', ico: 'image/x-icon', avif: 'image/avif', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg' };
    const mime = mimeMap[ext] || 'application/octet-stream';
    if (typeof data === 'string') {
      if (data.startsWith('data:')) return data;
      return 'data:' + mime + ';base64,' + btoa(data);
    }
    const bytes = _toBytes(data);
    if (!bytes) return null;
    let binary = '';
    for (let i = 0; i < bytes.length; ++i) binary += String.fromCharCode(bytes[i]);
    return 'data:' + mime + ';base64,' + btoa(binary);
  }

  function _toBytes(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    if (typeof data === 'string') {
      const enc = new TextEncoder();
      return enc.encode(data);
    }
    return null;
  }

  function _decodeText(data) {
    if (typeof data === 'string') {
      if (data.startsWith('data:')) {
        const m = data.match(/^data:[^,]*;base64,(.*)$/);
        if (m) {
          try { return atob(m[1]); } catch { return data; }
        }
        return data;
      }
      return data;
    }
    const bytes = _toBytes(data);
    if (!bytes) return '';
    try { return new TextDecoder().decode(bytes); } catch { return ''; }
  }

  function contentToDownloadBlob(content) {
    if (content instanceof Blob) return content;
    if (content instanceof ArrayBuffer) return new Blob([content], { type: 'application/octet-stream' });
    if (ArrayBuffer.isView(content)) return new Blob([content], { type: 'application/octet-stream' });
    if (typeof content === 'string') {
      const m = content.match(/^data:([^,]*),(.*)$/i);
      if (m) {
        const meta = m[1] || '';
        const payload = m[2] || '';
        const mime = (meta.split(';')[0] || 'application/octet-stream').trim();
        if (/;\s*base64/i.test(meta)) {
          try {
            const binary = atob(payload.replace(/\s+/g, ''));
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; ++i) bytes[i] = binary.charCodeAt(i) & 0xff;
            return new Blob([bytes], { type: mime });
          } catch {}
        } else {
          try {
            const decoded = decodeURIComponent(payload);
            const bytes = new Uint8Array(decoded.length);
            for (let i = 0; i < decoded.length; ++i) bytes[i] = decoded.charCodeAt(i) & 0xff;
            return new Blob([bytes], { type: mime });
          } catch {}
        }
      }
      if (content.startsWith('{') && content.includes('"type"')) {
        try {
          const obj = JSON.parse(content);
          if (obj && obj.type === 'base64' && typeof obj.data === 'string') {
            const binary = atob(obj.data.replace(/\s+/g, ''));
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; ++i) bytes[i] = binary.charCodeAt(i) & 0xff;
            return new Blob([bytes], { type: obj.mime || 'application/octet-stream' });
          }
          if (obj && obj.type === 'text' && typeof obj.data === 'string')
            return new Blob([obj.data], { type: 'text/plain;charset=utf-8' });
        } catch {}
      }
    }
    return new Blob([content ?? ''], { type: 'application/octet-stream' });
  }

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  // =========================================================================
  // Context menu helpers
  // =========================================================================
  function dismissContextMenu() {
    if (activeContextMenu) {
      activeContextMenu.remove();
      activeContextMenu = null;
    }
  }

  function createContextMenuEl(x, y) {
    dismissContextMenu();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    document.body.appendChild(menu);
    activeContextMenu = menu;

    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) menu.style.left = Math.max(0, x - rect.width) + 'px';
      if (rect.bottom > window.innerHeight) menu.style.top = Math.max(0, y - rect.height) + 'px';
    });

    return menu;
  }

  function addCtxItem(menu, label, callback, disabled, icon) {
    const el = document.createElement('div');
    el.className = 'ctx-item' + (disabled ? ' disabled' : '');
    const iconSpan = document.createElement('span');
    iconSpan.className = 'ctx-icon';
    if (icon) iconSpan.innerHTML = icon;
    el.appendChild(iconSpan);
    const textSpan = document.createElement('span');
    textSpan.textContent = label;
    el.appendChild(textSpan);
    if (!disabled)
      el.addEventListener('click', (e) => { e.stopPropagation(); dismissContextMenu(); callback(); });
    menu.appendChild(el);
    return el;
  }

  function addCtxSep(menu) {
    const sep = document.createElement('div');
    sep.className = 'ctx-sep';
    menu.appendChild(sep);
  }

  function addCtxSubmenu(menu, label, icon) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ctx-item ctx-submenu';
    const iconSpan = document.createElement('span');
    iconSpan.className = 'ctx-icon';
    if (icon) iconSpan.innerHTML = icon;
    wrapper.appendChild(iconSpan);
    const textSpan = document.createElement('span');
    textSpan.textContent = label;
    wrapper.appendChild(textSpan);
    const panel = document.createElement('div');
    panel.className = 'ctx-submenu-panel';
    wrapper.appendChild(panel);
    menu.appendChild(wrapper);
    return panel;
  }

  // =========================================================================
  // Confirm / Alert dialogs
  // =========================================================================
  function showConfirm(message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      const dialog = document.createElement('div');
      dialog.className = 'confirm-dialog';
      const textEl = document.createElement('div');
      textEl.className = 'dlg-text';
      textEl.textContent = message;
      dialog.appendChild(textEl);
      const buttons = document.createElement('div');
      buttons.className = 'dlg-buttons';
      const yesBtn = document.createElement('button');
      yesBtn.textContent = 'Yes';
      yesBtn.addEventListener('click', () => { overlay.remove(); resolve(true); });
      buttons.appendChild(yesBtn);
      const noBtn = document.createElement('button');
      noBtn.textContent = 'No';
      noBtn.addEventListener('click', () => { overlay.remove(); resolve(false); });
      buttons.appendChild(noBtn);
      dialog.appendChild(buttons);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      yesBtn.focus();
      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { overlay.remove(); resolve(false); }
        if (e.key === 'Enter') { overlay.remove(); resolve(true); }
      });
    });
  }

  function showAlert(message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      const dialog = document.createElement('div');
      dialog.className = 'confirm-dialog';
      const textEl = document.createElement('div');
      textEl.className = 'dlg-text';
      textEl.style.whiteSpace = 'pre-wrap';
      textEl.textContent = message;
      dialog.appendChild(textEl);
      const buttons = document.createElement('div');
      buttons.className = 'dlg-buttons';
      const okBtn = document.createElement('button');
      okBtn.textContent = 'OK';
      okBtn.addEventListener('click', () => { overlay.remove(); resolve(); });
      buttons.appendChild(okBtn);
      dialog.appendChild(buttons);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      okBtn.focus();
      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') { overlay.remove(); resolve(); }
      });
    });
  }

  // =========================================================================
  // Pane class
  // =========================================================================
  class Pane {
    constructor(id, path) {
      this.id = id;
      this.currentPath = path || '/';
      this.backStack = [];
      this.forwardStack = [];
      this.selectedItems = [];
      this.lastClickedIndex = -1;
      this.currentEntries = [];
      this.isVfsMode = isVfsPath(this.currentPath);
      this.searchFilter = '';
      this.isSearchResultsView = false;
      this.activeRename = null;

      // Per-pane settings
      this.viewMode = optDefaultView;
      this.sortField = 'name';
      this.sortAscending = true;
      this.previewPaneVisible = false;
      this.expandedMode = false;
      this.iconZoom = optIconZoom;

      // Display toggles
      this.showExtensions = true;
      this.showHiddenFiles = false;
      this.highlightRecents = false;
      this.sortRecentsFirst = false;

      // View filter
      this.filterMode = 'all';
      this.foldersFirst = true;

      // Tab state
      this.tabs = [];
      this.activeTabId = null;
      this._nextTabId = 1;

      // Preview
      this._lastPreviewPath = null;
      this._previewDebounce = null;
      this._previewZoom = 100;

      // Autocomplete
      this._acItems = [];
      this._acActiveIndex = -1;
      this._acDebounce = null;

      // Type-ahead
      this._typeAheadBuffer = '';
      this._typeAheadTimer = null;

      // DOM elements (created by createDOM)
      this.el = null;
      this.mainView = null;
      this.breadcrumbEl = null;
      this.addressInput = null;
      this.previewPane = null;
      this.tabBar = null;
      this.searchInput = null;
      this.searchScope = null;
      this.searchClear = null;
      this.autocompleteDropdown = null;
      this.breadcrumbContainer = null;

      this.createDOM();

      // Create initial tab
      const initialTab = this._createTabState(this.currentPath);
      this.tabs.push(initialTab);
      this.activeTabId = initialTab.id;
    }

    // -----------------------------------------------------------------------
    // DOM construction
    // -----------------------------------------------------------------------
    createDOM() {
      const pane = document.createElement('div');
      pane.className = 'pane';
      pane.dataset.paneId = String(this.id);
      pane.addEventListener('pointerdown', () => paneManager.focusPane(this.id));

      // Chrome: tab bar + address bar
      const chrome = document.createElement('div');
      chrome.className = 'pane-chrome';

      // Tab bar
      const tabBar = document.createElement('div');
      tabBar.className = 'pane-tab-bar';
      chrome.appendChild(tabBar);
      this.tabBar = tabBar;

      // Address bar
      const addressBar = document.createElement('div');
      addressBar.className = 'pane-address-bar';

      // Breadcrumb wrapper
      const bcWrapper = document.createElement('div');
      bcWrapper.className = 'breadcrumb-wrapper';

      const bcContainer = document.createElement('div');
      bcContainer.className = 'breadcrumb-container';

      const breadcrumb = document.createElement('div');
      breadcrumb.className = 'breadcrumb';
      bcContainer.appendChild(breadcrumb);

      const addressInput = document.createElement('input');
      addressInput.className = 'address-input';
      addressInput.type = 'text';
      addressInput.spellcheck = false;
      addressInput.autocomplete = 'off';
      bcContainer.appendChild(addressInput);

      bcWrapper.appendChild(bcContainer);

      const acDropdown = document.createElement('div');
      acDropdown.className = 'autocomplete-dropdown';
      bcWrapper.appendChild(acDropdown);

      addressBar.appendChild(bcWrapper);

      // Search box
      const searchBox = document.createElement('div');
      searchBox.className = 'search-box';

      const searchIcon = document.createElement('span');
      searchIcon.className = 'search-icon';
      searchIcon.textContent = '\uD83D\uDD0D';
      searchBox.appendChild(searchIcon);

      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = 'search-input';
      searchInput.placeholder = 'Search...';
      searchInput.spellcheck = false;
      searchBox.appendChild(searchInput);

      const searchScope = document.createElement('select');
      searchScope.className = 'search-scope';
      searchScope.title = 'Search scope';
      searchScope.innerHTML = '<option value="current">Current folder</option><option value="all">All VFS</option>';
      searchBox.appendChild(searchScope);

      const searchClear = document.createElement('span');
      searchClear.className = 'search-clear';
      searchClear.textContent = '\u00D7';
      searchBox.appendChild(searchClear);

      addressBar.appendChild(searchBox);

      // Kebab button
      const kebab = document.createElement('button');
      kebab.className = 'pane-kebab-btn';
      kebab.title = 'Pane menu';
      kebab.textContent = '\u22EE';
      kebab.addEventListener('click', (e) => {
        e.stopPropagation();
        this._showPaneMenu(e.clientX, e.clientY);
      });
      addressBar.appendChild(kebab);

      chrome.appendChild(addressBar);
      pane.appendChild(chrome);

      // Body: main view + preview
      const body = document.createElement('div');
      body.className = 'pane-body';

      const mainView = document.createElement('div');
      mainView.className = 'pane-main-view';
      body.appendChild(mainView);

      const previewPane = document.createElement('div');
      previewPane.className = 'pane-preview-pane';
      previewPane.style.display = 'none';
      body.appendChild(previewPane);

      pane.appendChild(body);

      // Store refs
      this.el = pane;
      this.mainView = mainView;
      this.breadcrumbEl = breadcrumb;
      this.addressInput = addressInput;
      this.previewPane = previewPane;
      this.searchInput = searchInput;
      this.searchScope = searchScope;
      this.searchClear = searchClear;
      this.autocompleteDropdown = acDropdown;
      this.breadcrumbContainer = bcContainer;

      // Wire events
      this._wireEvents();
    }

    _wireEvents() {
      const self = this;

      // Breadcrumb click -> edit mode
      this.breadcrumbContainer.addEventListener('click', (e) => {
        if (e.target === self.breadcrumbContainer || e.target === self.breadcrumbEl)
          self.enterEditMode();
      });

      // Address input
      this.addressInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (self._acActiveIndex < 0) {
            e.preventDefault();
            self.hideAutocomplete();
            self.exitEditMode(true);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (self.autocompleteDropdown.classList.contains('visible'))
            self.hideAutocomplete();
          else
            self.exitEditMode(false);
        }
      });

      this.addressInput.addEventListener('blur', () => {
        setTimeout(() => {
          if (document.activeElement !== self.addressInput) {
            self.hideAutocomplete();
            self.exitEditMode(false);
          }
        }, 150);
      });

      this.addressInput.addEventListener('input', () => {
        clearTimeout(self._acDebounce);
        self._acDebounce = setTimeout(() => self.updateAutocomplete(), 150);
      });

      this.addressInput.addEventListener('keydown', (e) => {
        if (!self.autocompleteDropdown.classList.contains('visible'))
          return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          self._acActiveIndex = Math.min(self._acActiveIndex + 1, self._acItems.length - 1);
          self.highlightAcItem();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          self._acActiveIndex = Math.max(self._acActiveIndex - 1, -1);
          self.highlightAcItem();
        } else if ((e.key === 'Tab' || e.key === 'Enter') && self._acActiveIndex >= 0) {
          e.preventDefault();
          self.selectAcItem(self._acActiveIndex);
        }
      });

      // Search
      let searchDebounce = null;
      this.searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        self.searchFilter = self.searchInput.value.trim().toLowerCase();
        self.searchClear.classList.toggle('visible', self.searchFilter.length > 0);
        if (!self.searchFilter) {
          if (self.isSearchResultsView) {
            self.isSearchResultsView = false;
            self.render();
          } else
            self.applySearchFilterFlat();
          return;
        }
        searchDebounce = setTimeout(() => {
          if (self.isVfsMode)
            self.performRecursiveSearch(self.searchFilter);
          else
            self.applySearchFilterFlat();
        }, 300);
      });

      this.searchClear.addEventListener('click', () => {
        self.searchInput.value = '';
        self.searchFilter = '';
        self.searchClear.classList.remove('visible');
        if (self.isSearchResultsView) {
          self.isSearchResultsView = false;
          self.render();
        } else
          self.applySearchFilterFlat();
      });

      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          self.searchInput.value = '';
          self.searchFilter = '';
          self.searchClear.classList.remove('visible');
          if (self.isSearchResultsView) {
            self.isSearchResultsView = false;
            self.render();
          } else
            self.applySearchFilterFlat();
          self.searchInput.blur();
        }
      });

      // Main view interactions
      this.mainView.addEventListener('auxclick', (e) => {
        if (e.button !== 1) return;
        const item = e.target.closest('.file-item') || e.target.closest('tr[data-index]');
        if (!item) return;
        const idx = parseInt(item.dataset.index, 10);
        if (isNaN(idx) || idx >= self.currentEntries.length) return;
        const entry = self.currentEntries[idx];
        if (entry.isContainer || entry.type === 'dir') {
          e.preventDefault();
          self.createTab(childPath(self.currentPath, entry.name));
        }
      });

      // Drag-and-drop (OS files + inter-pane VFS moves/copies)
      this.mainView.addEventListener('dragover', (e) => {
        if (e.dataTransfer.types.includes('application/x-sz-tab')) return;
        if (!self.isVfsMode) return;
        e.preventDefault();
        const hasVfsData = e.dataTransfer.types.includes('application/x-sz-vfs');
        e.dataTransfer.dropEffect = hasVfsData ? (e.ctrlKey ? 'copy' : 'move') : 'copy';
        self.mainView.classList.add('drop-target');
      });
      this.mainView.addEventListener('dragenter', (e) => {
        if (!self.isVfsMode) return;
        e.preventDefault();
        self.mainView.classList.add('drop-target');
      });
      this.mainView.addEventListener('dragleave', (e) => {
        if (e.relatedTarget && self.mainView.contains(e.relatedTarget)) return;
        self.mainView.classList.remove('drop-target');
      });
      this.mainView.addEventListener('drop', async (e) => {
        if (e.dataTransfer.types.includes('application/x-sz-tab')) return;
        e.preventDefault();
        self.mainView.classList.remove('drop-target');
        if (!self.isVfsMode) return;

        // Inter-pane VFS drag
        const vfsJson = e.dataTransfer.getData('application/x-sz-vfs');
        if (vfsJson) {
          try {
            const data = JSON.parse(vfsJson);
            const destDir = toVfsRelative(self.currentPath);
            const isCopy = e.ctrlKey;
            for (const srcPath of data.paths) {
              const name = baseName(srcPath);
              const dest = (destDir === '/' ? '/' : destDir + '/') + name;
              if (srcPath === dest) continue;
              if (isCopy)
                await vfsCopy(srcPath, dest);
              else
                await vfsMove(srcPath, dest);
            }
            self.clearSelection();
            await self.doRefresh();
            // Refresh source pane too if it's different
            if (data.sourcePaneId != null && data.sourcePaneId !== self.id) {
              const srcPane = paneManager.panes.get(data.sourcePaneId);
              if (srcPane) { srcPane.clearSelection(); await srcPane.doRefresh(); }
            }
          } catch (err) {
            showAlert('Drop failed: ' + err.message);
          }
          return;
        }

        // OS file upload
        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;
        const vfsDir = toVfsRelative(self.currentPath);
        for (let i = 0; i < files.length; ++i) {
          const file = files[i];
          try {
            const content = await readFileAsArrayBuffer(file);
            const filePath = (vfsDir === '/' ? '/' : vfsDir + '/') + file.name;
            const result = await vfsWrite(filePath, content);
            if (result.error) showAlert('Could not upload "' + file.name + '": ' + result.error);
          } catch (err) {
            showAlert('Failed to read "' + file.name + '": ' + err.message);
          }
        }
        self.clearSelection();
        await self.doRefresh();
      });

      // Tab drag-and-drop between panes
      this.el.addEventListener('dragover', (e) => {
        if (!e.dataTransfer.types.includes('application/x-sz-tab')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        self.el.classList.add('tab-drop-target');
        self.tabBar.classList.add('visible', 'tab-drop-target');
      });

      this.el.addEventListener('dragleave', (e) => {
        if (e.relatedTarget && self.el.contains(e.relatedTarget)) return;
        self.el.classList.remove('tab-drop-target');
        self.tabBar.classList.remove('tab-drop-target');
        if (self.tabs.length <= 1) self.tabBar.classList.remove('visible');
      });

      this.el.addEventListener('drop', (e) => {
        self.el.classList.remove('tab-drop-target');
        self.tabBar.classList.remove('tab-drop-target');
        if (!e.dataTransfer.types.includes('application/x-sz-tab')) return;
        e.preventDefault();
        const data = JSON.parse(e.dataTransfer.getData('application/x-sz-tab'));
        self._acceptTabDrop(data);
      });

      // Rubber-band / lasso selection
      let _rbActive = false, _rbStartX = 0, _rbStartY = 0, _rbRect = null;
      this.mainView.addEventListener('pointerdown', (e) => {
        // Only start rubber-band on background clicks (not on items)
        if (e.target !== self.mainView && e.target.closest('.file-item, tr[data-index], .file-list, .file-table'))
          if (e.target !== self.mainView.querySelector('.file-list') && e.target !== self.mainView.querySelector('.file-table tbody'))
            return;
        if (e.button !== 0) return;
        const rect = self.mainView.getBoundingClientRect();
        _rbStartX = e.clientX - rect.left + self.mainView.scrollLeft;
        _rbStartY = e.clientY - rect.top + self.mainView.scrollTop;
        _rbActive = true;
        _rbRect = document.createElement('div');
        _rbRect.className = 'rubber-band';
        _rbRect.style.cssText = 'position:absolute;border:1px solid var(--sz-color-highlight);background:rgba(51,153,255,0.15);pointer-events:none;z-index:10;';
        self.mainView.style.position = 'relative';
        self.mainView.appendChild(_rbRect);
        self.mainView.setPointerCapture(e.pointerId);
      });
      this.mainView.addEventListener('pointermove', (e) => {
        if (!_rbActive || !_rbRect) return;
        const rect = self.mainView.getBoundingClientRect();
        const curX = e.clientX - rect.left + self.mainView.scrollLeft;
        const curY = e.clientY - rect.top + self.mainView.scrollTop;
        const x = Math.min(_rbStartX, curX), y = Math.min(_rbStartY, curY);
        const w = Math.abs(curX - _rbStartX), h = Math.abs(curY - _rbStartY);
        _rbRect.style.left = x + 'px';
        _rbRect.style.top = y + 'px';
        _rbRect.style.width = w + 'px';
        _rbRect.style.height = h + 'px';

        // Only start visual selection after a small threshold
        if (w < 5 && h < 5) return;

        // Hit-test items against rubber-band rect
        const bandRect = { left: x, top: y, right: x + w, bottom: y + h };
        const items = self.mainView.querySelectorAll('.file-item, tr[data-index]');
        const newSelection = [];
        items.forEach((item) => {
          const ir = item.getBoundingClientRect();
          const itemRect = {
            left: ir.left - rect.left + self.mainView.scrollLeft,
            top: ir.top - rect.top + self.mainView.scrollTop,
            right: ir.right - rect.left + self.mainView.scrollLeft,
            bottom: ir.bottom - rect.top + self.mainView.scrollTop,
          };
          const intersects = !(itemRect.right < bandRect.left || itemRect.left > bandRect.right ||
            itemRect.bottom < bandRect.top || itemRect.top > bandRect.bottom);
          item.classList.toggle('selected', intersects);
          if (intersects) {
            const idx = parseInt(item.dataset.index, 10);
            const entries = self.getFilteredEntries();
            if (entries[idx]) newSelection.push(entries[idx]);
          }
        });
        self.selectedItems = newSelection;
      });
      this.mainView.addEventListener('pointerup', (e) => {
        if (!_rbActive) return;
        _rbActive = false;
        if (_rbRect) { _rbRect.remove(); _rbRect = null; }
        self.updateStatusBar();
        self.updatePreview();
      });

      // Scroll position tracking
      this.mainView.addEventListener('scroll', () => {
        if (paneManager.activePaneId !== self.id) return;
        const el = self.mainView;
        const maxScroll = el.scrollHeight - el.clientHeight;
        if (maxScroll > 0) {
          const pct = Math.round((el.scrollTop / maxScroll) * 100);
          if (statusScrollPct) statusScrollPct.textContent = pct + '%';
        } else if (statusScrollPct)
          statusScrollPct.textContent = '';
      });
    }

    // -----------------------------------------------------------------------
    // Pane kebab menu
    // -----------------------------------------------------------------------
    _showPaneMenu(x, y) {
      const menu = createContextMenuEl(x, y);
      addCtxItem(menu, 'New Tab', () => this.createTab(this.currentPath), false, ICONS.ctxNewTab);
      addCtxItem(menu, 'Duplicate Tab', () => this.createTab(this.currentPath), false, ICONS.ctxDupTab);
      addCtxSep(menu);
      addCtxItem(menu, 'Split Right', () => paneManager.splitRight(this.id), false, ICONS.ctxSplitR);
      addCtxItem(menu, 'Split Bottom', () => paneManager.splitBottom(this.id), false, ICONS.ctxSplitB);
      if (paneManager.panes.size > 1)
        addCtxItem(menu, 'Close Pane', () => paneManager.closePane(this.id), false, ICONS.ctxClose);
      addCtxSep(menu);
      addCtxItem(menu, this.expandedMode ? 'Collapse Folder' : 'Expand Folder', () => this.toggleExpandedMode(), false, this.expandedMode ? ICONS.ctxCollapse : ICONS.ctxExpand);
      addCtxItem(menu, this.previewPaneVisible ? 'Hide Preview' : 'Show Preview', () => this.togglePreviewPane(), false, ICONS.ctxPreview);
    }

    // -----------------------------------------------------------------------
    // Navigation
    // -----------------------------------------------------------------------
    async navigate(path, skipHistory) {
      if (path === this.currentPath && !skipHistory) return;
      if (!skipHistory) {
        this.backStack.push(this.currentPath);
        this.forwardStack.length = 0;
      }
      this.currentPath = path;
      this.isVfsMode = isVfsPath(path);
      this.clearSelection();
      this.searchFilter = '';
      this.searchInput.value = '';
      this.searchClear.classList.remove('visible');
      this.isSearchResultsView = false;
      addRecentPath(path);
      await this.render();
      this._updateTabLabel();
    }

    async goBack() {
      if (this.backStack.length === 0) return;
      this.forwardStack.push(this.currentPath);
      this.currentPath = this.backStack.pop();
      this.isVfsMode = isVfsPath(this.currentPath);
      this.clearSelection();
      await this.render();
      this._updateTabLabel();
    }

    async goForward() {
      if (this.forwardStack.length === 0) return;
      this.backStack.push(this.currentPath);
      this.currentPath = this.forwardStack.pop();
      this.isVfsMode = isVfsPath(this.currentPath);
      this.clearSelection();
      await this.render();
      this._updateTabLabel();
    }

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    async render() {
      const startTime = performance.now();
      this.updateBreadcrumb();

      let result;
      if (this.isVfsMode) {
        const vfsPath = toVfsRelative(this.currentPath);
        result = await vfsList(vfsPath);
        if (result.error) {
          this._renderError(result.error);
          return;
        }
        this.currentEntries = (result.entries || []).map(e => ({
          name: e.name,
          type: e.type === 'dir' ? 'dir' : 'file',
          isContainer: e.type === 'dir',
          size: e.size || 0,
          mtime: e.mtime || null,
          preview: e.type === 'dir' ? 'Folder' : formatSize(e.size || 0),
          entryType: e.type === 'dir' ? 'vfsFolder' : 'vfsFile',
        }));

        // Apply hidden files filter
        if (!this.showHiddenFiles)
          this.currentEntries = this.currentEntries.filter(e => !e.name.startsWith('.'));

        this.sortEntries();

        if (this.expandedMode)
          await this.renderExpandedView();
        else
          this.renderVfsView();
      } else {
        try {
          result = await browse(this.currentPath);
        } catch (e) {
          this._renderError(e.message || 'Failed to browse path');
          return;
        }
        if (result.error) {
          this._renderError(result.error || result.preview || 'Unknown error');
          return;
        }
        this.currentEntries = result.entries || [];
        this.renderObjectView(result);
      }

      highlightSidebar(this.currentPath);

      if (paneManager.activePaneId === this.id) {
        updateRibbonState();
        this.updateStatusBar();
      }

      this.updatePreview();

      const elapsed = performance.now() - startTime;
      if (paneManager.activePaneId === this.id && statusLoadTime)
        statusLoadTime.textContent = (elapsed / 1000).toFixed(2) + 's';
    }

    // -----------------------------------------------------------------------
    // Sorting
    // -----------------------------------------------------------------------
    sortEntries() {
      this.currentEntries.sort((a, b) => {
        // Recents first
        if (this.sortRecentsFirst) {
          const now = Date.now();
          const aRecent = a.mtime && (now - a.mtime) < 86400000 ? 0 : 1;
          const bRecent = b.mtime && (now - b.mtime) < 86400000 ? 0 : 1;
          if (aRecent !== bRecent) return aRecent - bRecent;
        }

        // Folders first (if enabled)
        if (this.foldersFirst) {
          const aDir = a.type === 'dir' ? 0 : 1;
          const bDir = b.type === 'dir' ? 0 : 1;
          if (aDir !== bDir) return aDir - bDir;
        }

        let cmp = 0;
        switch (this.sortField) {
          case 'name':
            cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
            break;
          case 'size':
            cmp = (a.size || 0) - (b.size || 0);
            break;
          case 'type':
            cmp = getFileTypeLabel(a).localeCompare(getFileTypeLabel(b));
            break;
          case 'date':
            cmp = (a.mtime || 0) - (b.mtime || 0);
            break;
          default:
            cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        }
        return this.sortAscending ? cmp : -cmp;
      });
    }

    setSortField(field) {
      if (this.sortField === field)
        this.sortAscending = !this.sortAscending;
      else {
        this.sortField = field;
        this.sortAscending = true;
      }
      if (paneManager.activePaneId === this.id) updateSortButtons();
      if (this.isVfsMode) {
        this.sortEntries();
        this.renderVfsView();
      }
    }

    // -----------------------------------------------------------------------
    // Display name (respects showExtensions)
    // -----------------------------------------------------------------------
    displayName(entry) {
      if (this.showExtensions || entry.type === 'dir') return entry.name;
      const dot = entry.name.lastIndexOf('.');
      if (dot > 0) return entry.name.slice(0, dot);
      return entry.name;
    }

    // -----------------------------------------------------------------------
    // View filter
    // -----------------------------------------------------------------------
    getFilteredEntries() {
      let entries = this.currentEntries;
      if (this.filterMode === 'files')
        entries = entries.filter(e => e.type !== 'dir');
      else if (this.filterMode === 'folders')
        entries = entries.filter(e => e.type === 'dir');
      return entries;
    }

    // -----------------------------------------------------------------------
    // Breadcrumb
    // -----------------------------------------------------------------------
    updateBreadcrumb() {
      this.breadcrumbEl.innerHTML = '';
      const parts = this.currentPath === '/' ? [''] : this.currentPath.split('/');

      for (let i = 0; i < parts.length; ++i) {
        if (i > 0) {
          const sep = document.createElement('span');
          sep.className = 'crumb-sep';
          sep.textContent = '\u25B8';
          this.breadcrumbEl.appendChild(sep);
        }

        const crumb = document.createElement('span');
        crumb.className = 'crumb';
        crumb.textContent = i === 0 ? 'SZ:\\' : parts[i];
        const targetPath = i === 0 ? '/' : '/' + parts.slice(1, i + 1).join('/');
        crumb.addEventListener('click', (e) => {
          e.stopPropagation();
          this.navigate(targetPath);
        });
        this.breadcrumbEl.appendChild(crumb);
      }
    }

    enterEditMode() {
      this.breadcrumbContainer.classList.add('editing');
      this.addressInput.value = formatPath(this.currentPath);
      this.addressInput.style.display = 'block';
      this.addressInput.focus();
      this.addressInput.select();
    }

    exitEditMode(doNavigate) {
      this.breadcrumbContainer.classList.remove('editing');
      this.addressInput.style.display = '';
      if (doNavigate) {
        const newPath = parsePath(this.addressInput.value);
        if (newPath !== this.currentPath)
          this.navigate(newPath);
      }
    }

    // -----------------------------------------------------------------------
    // Autocomplete
    // -----------------------------------------------------------------------
    async updateAutocomplete() {
      const raw = this.addressInput.value.trim();
      if (!raw) { this.hideAutocomplete(); return; }
      const fullPath = parsePath(raw);
      const dir = parentPath(fullPath);
      const prefix = baseName(fullPath).toLowerCase();

      try {
        let entries = [];
        if (isVfsPath(dir)) {
          const result = await vfsList(toVfsRelative(dir));
          entries = (result.entries || []).filter(e => e.type === 'dir').map(e => e.name);
        } else {
          const result = await browse(dir);
          entries = (result.entries || []).filter(e => e.isContainer).map(e => e.name);
        }

        const matches = prefix ? entries.filter(n => n.toLowerCase().startsWith(prefix)) : entries;
        if (matches.length === 0) { this.hideAutocomplete(); return; }

        this._acItems = matches.map(name => childPath(dir, name));
        this._acActiveIndex = -1;
        this.autocompleteDropdown.innerHTML = '';

        for (let i = 0; i < Math.min(this._acItems.length, 20); ++i) {
          const el = document.createElement('div');
          el.className = 'autocomplete-item';
          el.textContent = formatPath(this._acItems[i]);
          el.dataset.index = String(i);
          el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); this.selectAcItem(i); });
          this.autocompleteDropdown.appendChild(el);
        }
        this.autocompleteDropdown.classList.add('visible');
      } catch { this.hideAutocomplete(); }
    }

    hideAutocomplete() {
      this.autocompleteDropdown.classList.remove('visible');
      this.autocompleteDropdown.innerHTML = '';
      this._acItems = [];
      this._acActiveIndex = -1;
    }

    highlightAcItem() {
      const items = this.autocompleteDropdown.querySelectorAll('.autocomplete-item');
      for (let i = 0; i < items.length; ++i)
        items[i].classList.toggle('active', i === this._acActiveIndex);
      if (this._acActiveIndex >= 0 && items[this._acActiveIndex])
        items[this._acActiveIndex].scrollIntoView({ block: 'nearest' });
    }

    selectAcItem(index) {
      if (index < 0 || index >= this._acItems.length) return;
      const path = this._acItems[index];
      this.addressInput.value = formatPath(path);
      this.hideAutocomplete();
      this.exitEditMode(false);
      this.navigate(path);
    }

    // -----------------------------------------------------------------------
    // Search
    // -----------------------------------------------------------------------
    applySearchFilterFlat() {
      const grid = this.mainView.querySelector('.file-list');
      const table = this.mainView.querySelector('.file-table');
      if (grid) {
        const items = grid.querySelectorAll('.file-item');
        for (const item of items) {
          const name = (item.dataset.name || '').toLowerCase();
          item.style.display = !this.searchFilter || name.includes(this.searchFilter) ? '' : 'none';
        }
      } else if (table) {
        const rows = table.querySelectorAll('tbody tr');
        for (const row of rows) {
          const name = (row.dataset.name || '').toLowerCase();
          row.style.display = !this.searchFilter || name.includes(this.searchFilter) ? '' : 'none';
        }
      }
    }

    async _vfsSearchRecursive(basePath, query, results, maxResults) {
      if (results.length >= maxResults) return;
      const resp = await vfsList(basePath);
      const entries = resp.entries || [];
      for (const entry of entries) {
        if (results.length >= maxResults) return;
        const entryPath = basePath === '/' ? '/' + entry.name : basePath + '/' + entry.name;
        if (entry.name.toLowerCase().includes(query))
          results.push({ name: entry.name, vfsPath: entryPath, type: entry.type, size: entry.size || 0, mtime: entry.mtime || null });
        if (entry.type === 'dir')
          await this._vfsSearchRecursive(entryPath, query, results, maxResults);
      }
    }

    async performRecursiveSearch(query) {
      if (!this.isVfsMode || !query) return;
      const scope = this.searchScope ? this.searchScope.value : 'current';
      const vfsBase = scope === 'all' ? '/' : toVfsRelative(this.currentPath);
      if (paneManager.activePaneId === this.id)
        statusInfo.textContent = 'Searching...';
      const results = [];
      try {
        await this._vfsSearchRecursive(vfsBase, query, results, 200);
      } catch {}
      if (this.searchFilter !== query) return;

      this.isSearchResultsView = true;
      this.currentEntries = results.map(r => ({
        name: r.name,
        type: r.type === 'dir' ? 'dir' : 'file',
        isContainer: r.type === 'dir',
        size: r.size,
        mtime: r.mtime,
        preview: r.type === 'dir' ? 'Folder' : formatSize(r.size),
        entryType: r.type === 'dir' ? 'vfsFolder' : 'vfsFile',
        _vfsPath: r.vfsPath,
        _relPath: r.vfsPath,
      }));

      this.renderSearchResultsTable(query);
      if (paneManager.activePaneId === this.id) {
        statusCount.textContent = results.length + ' result(s)';
        statusInfo.textContent = 'Search results for "' + query + '"' + (results.length >= 200 ? ' (limited to 200)' : '');
      }
    }

    renderSearchResultsTable(query) {
      this.mainView.innerHTML = '';
      const table = document.createElement('table');
      table.className = 'file-table';
      table.innerHTML = '<colgroup><col class="col-icon"><col class="col-name"><col class="col-path"><col class="col-size"><col class="col-type"></colgroup>'
        + '<thead><tr><th></th><th>Name</th><th>Path</th><th>Size</th><th>Type</th></tr></thead>';
      const tbody = document.createElement('tbody');
      const self = this;

      for (let i = 0; i < this.currentEntries.length; ++i) {
        const entry = this.currentEntries[i];
        const tr = document.createElement('tr');
        tr.dataset.name = entry.name;
        tr.dataset.index = String(i);

        const tdIcon = document.createElement('td');
        tdIcon.innerHTML = '<span class="row-icon">' + iconForVfs(entry) + '</span>';
        tr.appendChild(tdIcon);

        const tdName = document.createElement('td');
        tdName.textContent = self.displayName(entry);
        tr.appendChild(tdName);

        const tdPath = document.createElement('td');
        tdPath.textContent = entry._relPath || '';
        tdPath.title = entry._relPath || '';
        tr.appendChild(tdPath);

        const tdSize = document.createElement('td');
        tdSize.textContent = entry.type === 'dir' ? '' : formatSize(entry.size || 0);
        tdSize.style.textAlign = 'right';
        tr.appendChild(tdSize);

        const tdType = document.createElement('td');
        tdType.textContent = getFileTypeLabel(entry);
        tr.appendChild(tdType);

        tr.addEventListener('click', (e) => {
          e.stopPropagation();
          self.selectItem(i, tr, entry, { ctrl: e.ctrlKey, shift: e.shiftKey });
        });

        tr.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          const fullVfsPath = '/vfs' + (entry._vfsPath.startsWith('/') ? '' : '/') + entry._vfsPath;
          if (entry.isContainer || entry.type === 'dir')
            self.navigate(fullVfsPath);
          else
            openFile(fullVfsPath, entry.name);
        });

        tr.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!self.selectedItems.find(s => s.name === entry.name))
            self.selectItem(i, tr, entry, { ctrl: false, shift: false });
          self.showItemContextMenu(e.clientX, e.clientY);
        });

        tbody.appendChild(tr);
      }

      table.appendChild(tbody);
      table.addEventListener('click', (e) => {
        if (e.target === table || e.target.tagName === 'TBODY')
          self.clearSelection();
      });
      this.mainView.appendChild(table);
    }

    // -----------------------------------------------------------------------
    // Selection
    // -----------------------------------------------------------------------
    clearSelection() {
      for (const sel of this.selectedItems)
        if (sel.entryEl)
          sel.entryEl.classList.remove('selected');
      this.selectedItems = [];
      this.lastClickedIndex = -1;
      if (paneManager.activePaneId === this.id) updateRibbonState();
      this.updatePreview();
    }

    selectItem(index, entryEl, entry, modifiers) {
      const item = {
        name: entry.name,
        path: entry._vfsPath ? ('/vfs' + (entry._vfsPath.startsWith('/') ? '' : '/') + entry._vfsPath) : childPath(this.currentPath, entry.name),
        isDir: entry.isContainer || entry.type === 'dir',
        entryEl,
        index,
      };

      if (modifiers.ctrl) {
        const existingIdx = this.selectedItems.findIndex(s => s.name === entry.name);
        if (existingIdx >= 0) {
          this.selectedItems[existingIdx].entryEl.classList.remove('selected');
          this.selectedItems.splice(existingIdx, 1);
        } else {
          entryEl.classList.add('selected');
          this.selectedItems.push(item);
        }
        this.lastClickedIndex = index;
      } else if (modifiers.shift && this.lastClickedIndex >= 0) {
        this.clearSelection();
        const start = Math.min(this.lastClickedIndex, index);
        const end = Math.max(this.lastClickedIndex, index);
        const elements = this._getVisibleEntryElements();
        for (let i = start; i <= end; ++i) {
          if (i < elements.length && i < this.currentEntries.length) {
            elements[i].classList.add('selected');
            const e = this.currentEntries[i];
            this.selectedItems.push({
              name: e.name,
              path: e._vfsPath ? ('/vfs' + (e._vfsPath.startsWith('/') ? '' : '/') + e._vfsPath) : childPath(this.currentPath, e.name),
              isDir: e.isContainer || e.type === 'dir',
              entryEl: elements[i],
              index: i,
            });
          }
        }
      } else {
        this.clearSelection();
        entryEl.classList.add('selected');
        this.selectedItems.push(item);
        this.lastClickedIndex = index;
      }

      if (paneManager.activePaneId === this.id) {
        updateRibbonState();
        this._updateStatusForSelection();
      }
      this.updatePreview();
    }

    _getVisibleEntryElements() {
      const grid = this.mainView.querySelector('.file-list');
      if (grid) return grid.querySelectorAll('.file-item');
      const table = this.mainView.querySelector('.file-table');
      if (table) return table.querySelectorAll('tbody tr');
      return [];
    }

    selectAll() {
      this.clearSelection();
      const elements = this._getVisibleEntryElements();
      for (let i = 0; i < elements.length && i < this.currentEntries.length; ++i) {
        elements[i].classList.add('selected');
        const e = this.currentEntries[i];
        this.selectedItems.push({
          name: e.name,
          path: e._vfsPath ? ('/vfs' + (e._vfsPath.startsWith('/') ? '' : '/') + e._vfsPath) : childPath(this.currentPath, e.name),
          isDir: e.isContainer || e.type === 'dir',
          entryEl: elements[i],
          index: i,
        });
      }
      if (paneManager.activePaneId === this.id) {
        updateRibbonState();
        this._updateStatusForSelection();
      }
    }

    invertSelection() {
      const elements = this._getVisibleEntryElements();
      const wasSelected = new Set(this.selectedItems.map(s => s.name));
      this.clearSelection();
      for (let i = 0; i < elements.length && i < this.currentEntries.length; ++i) {
        const e = this.currentEntries[i];
        if (!wasSelected.has(e.name)) {
          elements[i].classList.add('selected');
          this.selectedItems.push({
            name: e.name,
            path: childPath(this.currentPath, e.name),
            isDir: e.isContainer || e.type === 'dir',
            entryEl: elements[i],
            index: i,
          });
        }
      }
      if (paneManager.activePaneId === this.id) {
        updateRibbonState();
        this._updateStatusForSelection();
      }
    }

    _updateStatusForSelection() {
      if (this.selectedItems.length === 0) return;
      if (this.selectedItems.length === 1) {
        const sel = this.selectedItems[0];
        const entry = this.currentEntries.find(e => e.name === sel.name);
        if (entry)
          statusInfo.textContent = entry.preview || '';
      } else {
        let totalSize = 0;
        for (const s of this.selectedItems) {
          const e = this.currentEntries.find(x => x.name === s.name);
          if (e && e.type !== 'dir') totalSize += e.size || 0;
        }
        statusInfo.textContent = this.selectedItems.length + ' items selected' + (totalSize > 0 ? ' (' + formatSize(totalSize) + ')' : '');
      }
    }

    // -----------------------------------------------------------------------
    // VFS view rendering
    // -----------------------------------------------------------------------
    renderVfsView() {
      if (this.viewMode === 'details')
        this.renderDetailsView();
      else if (this.viewMode === 'tiles')
        this.renderTilesView();
      else
        this.renderIconsView();

      if (paneManager.activePaneId === this.id) this.updateStatusBar();
    }

    updateStatusBar() {
      if (this.isSearchResultsView) return;
      let totalSize = 0, fileCount = 0, folderCount = 0;
      for (const entry of this.currentEntries) {
        if (entry.type === 'dir') ++folderCount;
        else { ++fileCount; totalSize += entry.size || 0; }
      }
      const filteredEntries = this.getFilteredEntries();
      const total = this.currentEntries.length;
      const visible = filteredEntries.length;

      const parts = [];
      if (visible !== total)
        parts.push(visible + '/' + total + ' items');
      else
        parts.push(total + ' items');

      if (folderCount > 0 || fileCount > 0) {
        const sub = [];
        if (folderCount > 0) sub.push(folderCount + ' folder' + (folderCount !== 1 ? 's' : ''));
        if (fileCount > 0) sub.push(fileCount + ' file' + (fileCount !== 1 ? 's' : ''));
        parts[0] += ' (' + sub.join(', ') + ')';
      }
      statusCount.textContent = parts[0];

      if (this.selectedItems.length > 0)
        this._updateStatusForSelection();
      else
        statusInfo.textContent = this.isVfsMode && totalSize > 0 ? 'Total: ' + formatSize(totalSize) : this.isVfsMode ? 'VFS: ' + toVfsRelative(this.currentPath) : '';
    }

    // -----------------------------------------------------------------------
    // Icons view
    // -----------------------------------------------------------------------
    renderIconsView() {
      this.mainView.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'file-list';
      const self = this;
      const entries = this.getFilteredEntries();

      for (let i = 0; i < entries.length; ++i)
        grid.appendChild(this._createFileItem(entries[i], i));

      grid.addEventListener('click', (e) => { if (e.target === grid) self.clearSelection(); });
      grid.addEventListener('contextmenu', (e) => {
        if (e.target === grid) {
          e.preventDefault();
          self.clearSelection();
          self.showBackgroundContextMenu(e.clientX, e.clientY);
        }
      });

      this.mainView.appendChild(grid);
    }

    // -----------------------------------------------------------------------
    // Details view
    // -----------------------------------------------------------------------
    renderDetailsView() {
      this.mainView.innerHTML = '';
      const table = document.createElement('table');
      table.className = 'file-table';
      const self = this;

      const arrow = (field) => field === this.sortField ? (this.sortAscending ? ' \u25B2' : ' \u25BC') : '';
      const colgroup = '<colgroup><col class="col-icon"><col class="col-name"><col class="col-size"><col class="col-type"><col class="col-date"><col class="col-folders"><col class="col-files"></colgroup>';
      table.innerHTML = colgroup
        + '<thead><tr>'
        + '<th></th>'
        + '<th data-sort="name">Name' + arrow('name') + '<div class="col-resize"></div></th>'
        + '<th data-sort="size">Size' + arrow('size') + '<div class="col-resize"></div></th>'
        + '<th data-sort="type">Type' + arrow('type') + '<div class="col-resize"></div></th>'
        + '<th data-sort="date">Date Modified' + arrow('date') + '<div class="col-resize"></div></th>'
        + '<th>Folders<div class="col-resize"></div></th>'
        + '<th>Files<div class="col-resize"></div></th>'
        + '</tr></thead>';

      table.querySelector('thead').addEventListener('click', (e) => {
        const th = e.target.closest('th[data-sort]');
        if (th) {
          e.stopPropagation();
          self.setSortField(th.dataset.sort);
          self.renderVfsView();
        }
      });

      this.initColumnResize(table);

      const tbody = document.createElement('tbody');
      const entries = this.getFilteredEntries();

      for (let i = 0; i < entries.length; ++i) {
        const entry = entries[i];
        const tr = document.createElement('tr');
        tr.dataset.name = entry.name;
        tr.dataset.index = String(i);

        // Make VFS rows draggable
        if (this.isVfsMode) {
          tr.draggable = true;
          tr.addEventListener('dragstart', (e) => {
            const paths = self.selectedItems.length > 0
              ? self.selectedItems.map(s => toVfsRelative(s.path))
              : [toVfsRelative(childPath(self.currentPath, entry.name))];
            const dragPayload = JSON.stringify({ paths, sourcePaneId: self.id });
            e.dataTransfer.setData('application/x-sz-vfs', dragPayload);
            e.dataTransfer.effectAllowed = 'copyMove';
            try { window.parent._szDragData = dragPayload; } catch {}
          });
        }

        if (this.highlightRecents && entry.mtime && (Date.now() - entry.mtime) < 86400000)
          tr.classList.add('recent-highlight');

        if (clipboard && clipboard.mode === 'cut')
          for (const ci of clipboard.items)
            if (ci.path === childPath(this.currentPath, entry.name))
              tr.classList.add('cut-pending');

        const tdIcon = document.createElement('td');
        tdIcon.innerHTML = '';
        tr.appendChild(tdIcon);

        const tdName = document.createElement('td');
        const cellName = document.createElement('div');
        cellName.className = 'cell-name';
        const nameIcon = document.createElement('span');
        nameIcon.className = 'row-icon';
        nameIcon.innerHTML = this.isVfsMode ? iconForVfs(entry) : iconFor(entry.entryType || entry.type);
        cellName.appendChild(nameIcon);
        const nameText = document.createElement('span');
        nameText.textContent = this.displayName(entry);
        if (entry._relPath) {
          const relSpan = document.createElement('span');
          relSpan.className = 'rel-path-hint';
          relSpan.textContent = ' \u2014 ' + entry._relPath;
          nameText.appendChild(relSpan);
        }
        cellName.appendChild(nameText);
        tdName.appendChild(cellName);
        tr.appendChild(tdName);

        const tdSize = document.createElement('td');
        if (entry.type === 'dir') {
          tdSize.textContent = '';
          // Folder size calculation (async)
          this._calcFolderSize(entry, tdSize);
        } else {
          tdSize.textContent = formatSize(entry.size || 0);
        }
        tdSize.style.textAlign = 'right';
        tr.appendChild(tdSize);

        const tdType = document.createElement('td');
        tdType.textContent = getFileTypeLabel(entry);
        tr.appendChild(tdType);

        const tdDate = document.createElement('td');
        tdDate.textContent = formatDate(entry.mtime);
        tr.appendChild(tdDate);

        // Folders column
        const tdFolders = document.createElement('td');
        tdFolders.style.textAlign = 'right';
        if (entry.type === 'dir')
          this._calcSubdirCount(entry, tdFolders);
        tr.appendChild(tdFolders);

        // Files column
        const tdFiles = document.createElement('td');
        tdFiles.style.textAlign = 'right';
        if (entry.type === 'dir')
          this._calcFileCount(entry, tdFiles);
        tr.appendChild(tdFiles);

        tr.addEventListener('click', (e) => {
          e.stopPropagation();
          self.selectItem(i, tr, entry, { ctrl: e.ctrlKey, shift: e.shiftKey });
        });

        tr.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          if (entry.isContainer || entry.type === 'dir')
            self.navigate(childPath(self.currentPath, entry.name));
          else if (self.isVfsMode)
            openFile(childPath(self.currentPath, entry.name), entry.name);
        });

        tr.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!self.selectedItems.find(s => s.name === entry.name))
            self.selectItem(i, tr, entry, { ctrl: false, shift: false });
          self.showItemContextMenu(e.clientX, e.clientY);
        });

        tbody.appendChild(tr);
      }

      table.appendChild(tbody);

      table.addEventListener('click', (e) => {
        if (e.target === table || e.target.tagName === 'TBODY')
          self.clearSelection();
      });
      table.addEventListener('contextmenu', (e) => {
        if (e.target === table || e.target.tagName === 'TBODY') {
          e.preventDefault();
          self.clearSelection();
          self.showBackgroundContextMenu(e.clientX, e.clientY);
        }
      });

      this.mainView.appendChild(table);
    }

    async _calcFolderSize(entry, td) {
      const entryPath = toVfsRelative(childPath(this.currentPath, entry.name));
      const cacheKey = this.currentPath + '/' + entry.name + ':size';
      if (_folderSizeCache.has(cacheKey)) {
        td.textContent = formatSize(_folderSizeCache.get(cacheKey));
        return;
      }
      try {
        const size = await this._recursiveFolderSize(entryPath, 0);
        _folderSizeCache.set(cacheKey, size);
        td.textContent = formatSize(size);
      } catch {}
    }

    async _recursiveFolderSize(path, depth) {
      if (depth > 10) return 0;
      let total = 0;
      const result = await vfsList(path);
      for (const e of (result.entries || [])) {
        if (e.type === 'dir') {
          const childP = path === '/' ? '/' + e.name : path + '/' + e.name;
          total += await this._recursiveFolderSize(childP, depth + 1);
        } else
          total += e.size || 0;
      }
      return total;
    }

    async _calcSubdirCount(entry, td) {
      if (!this.isVfsMode) return;
      try {
        const entryPath = toVfsRelative(childPath(this.currentPath, entry.name));
        const result = await vfsList(entryPath);
        const dirs = (result.entries || []).filter(e => e.type === 'dir');
        td.textContent = dirs.length > 0 ? String(dirs.length) : '';
      } catch {}
    }

    async _calcFileCount(entry, td) {
      if (!this.isVfsMode) return;
      try {
        const entryPath = toVfsRelative(childPath(this.currentPath, entry.name));
        const result = await vfsList(entryPath);
        const files = (result.entries || []).filter(e => e.type !== 'dir');
        td.textContent = files.length > 0 ? String(files.length) : '';
      } catch {}
    }

    initColumnResize(table) {
      table.querySelectorAll('.col-resize').forEach(handle => {
        handle.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const th = handle.parentElement;
          const startX = e.clientX;
          const startWidth = th.offsetWidth;
          handle.setPointerCapture(e.pointerId);

          const onMove = (ev) => {
            const newWidth = Math.max(40, startWidth + ev.clientX - startX);
            th.style.width = newWidth + 'px';
            th.style.minWidth = newWidth + 'px';
          };
          const onUp = () => {
            handle.removeEventListener('pointermove', onMove);
            handle.removeEventListener('pointerup', onUp);
          };
          handle.addEventListener('pointermove', onMove);
          handle.addEventListener('pointerup', onUp);
        });
      });
    }

    // -----------------------------------------------------------------------
    // Tiles view
    // -----------------------------------------------------------------------
    renderTilesView() {
      this.mainView.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'file-list tiles-view';
      const self = this;
      const entries = this.getFilteredEntries();

      for (let i = 0; i < entries.length; ++i) {
        const entry = entries[i];
        const item = document.createElement('div');
        item.className = 'file-item';
        item.dataset.name = entry.name;
        item.dataset.index = String(i);
        item.title = entry.name + '\n' + entry.preview;

        // Make VFS items draggable
        if (this.isVfsMode) {
          item.draggable = true;
          item.addEventListener('dragstart', (e) => {
            const paths = self.selectedItems.length > 0
              ? self.selectedItems.map(s => toVfsRelative(s.path))
              : [toVfsRelative(childPath(self.currentPath, entry.name))];
            const dragPayload = JSON.stringify({ paths, sourcePaneId: self.id });
            e.dataTransfer.setData('application/x-sz-vfs', dragPayload);
            e.dataTransfer.effectAllowed = 'copyMove';
            try { window.parent._szDragData = dragPayload; } catch {}
          });
        }

        if (this.highlightRecents && entry.mtime && (Date.now() - entry.mtime) < 86400000)
          item.classList.add('recent-highlight');

        if (clipboard && clipboard.mode === 'cut')
          for (const ci of clipboard.items)
            if (ci.path === childPath(this.currentPath, entry.name))
              item.classList.add('cut-pending');

        const iconEl = document.createElement('span');
        iconEl.className = 'item-icon';
        iconEl.innerHTML = this.isVfsMode ? iconForVfs(entry) : iconFor(entry.entryType || entry.type);
        item.appendChild(iconEl);

        const info = document.createElement('div');
        info.className = 'tile-info';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'item-name';
        nameSpan.textContent = this.displayName(entry);
        info.appendChild(nameSpan);

        const typeSpan = document.createElement('span');
        typeSpan.className = 'item-type';
        typeSpan.textContent = getFileTypeLabel(entry);
        info.appendChild(typeSpan);

        if (entry.type !== 'dir') {
          const sizeSpan = document.createElement('span');
          sizeSpan.className = 'item-type';
          sizeSpan.textContent = formatSize(entry.size || 0);
          info.appendChild(sizeSpan);
        }

        item.appendChild(info);

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          self.selectItem(i, item, entry, { ctrl: e.ctrlKey, shift: e.shiftKey });
        });

        item.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          if (entry.isContainer || entry.type === 'dir')
            self.navigate(childPath(self.currentPath, entry.name));
          else if (self.isVfsMode)
            openFile(childPath(self.currentPath, entry.name), entry.name);
        });

        item.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!self.selectedItems.find(s => s.name === entry.name))
            self.selectItem(i, item, entry, { ctrl: false, shift: false });
          self.showItemContextMenu(e.clientX, e.clientY);
        });

        grid.appendChild(item);
      }

      grid.addEventListener('click', (e) => { if (e.target === grid) self.clearSelection(); });
      grid.addEventListener('contextmenu', (e) => {
        if (e.target === grid) {
          e.preventDefault();
          self.clearSelection();
          self.showBackgroundContextMenu(e.clientX, e.clientY);
        }
      });

      this.mainView.appendChild(grid);
    }

    // -----------------------------------------------------------------------
    // Shared file item creator (icons view)
    // -----------------------------------------------------------------------
    _createFileItem(entry, index) {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.dataset.name = entry.name;
      item.dataset.index = String(index);
      item.title = entry.name + '\n' + entry.preview;
      const self = this;

      if (this.highlightRecents && entry.mtime && (Date.now() - entry.mtime) < 86400000)
        item.classList.add('recent-highlight');

      if (clipboard && clipboard.mode === 'cut')
        for (const ci of clipboard.items)
          if (ci.path === childPath(this.currentPath, entry.name))
            item.classList.add('cut-pending');

      // Make VFS items draggable for inter-pane drag-and-drop
      if (this.isVfsMode) {
        item.draggable = true;
        item.addEventListener('dragstart', (e) => {
          const paths = self.selectedItems.length > 0
            ? self.selectedItems.map(s => toVfsRelative(s.path))
            : [toVfsRelative(childPath(self.currentPath, entry.name))];
          const dragPayload = JSON.stringify({ paths, sourcePaneId: self.id });
          e.dataTransfer.setData('application/x-sz-vfs', dragPayload);
          e.dataTransfer.effectAllowed = 'copyMove';
          try { window.parent._szDragData = dragPayload; } catch {}
        });
      }

      const iconEl = document.createElement('span');
      iconEl.className = 'item-icon';
      iconEl.innerHTML = this.isVfsMode ? iconForVfs(entry) : iconFor(entry.entryType || entry.type);
      item.appendChild(iconEl);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'item-name';
      nameSpan.textContent = this.displayName(entry);
      item.appendChild(nameSpan);

      const typeSpan = document.createElement('span');
      typeSpan.className = 'item-type';
      typeSpan.textContent = entry.preview || '';
      item.appendChild(typeSpan);

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        self.selectItem(index, item, entry, { ctrl: e.ctrlKey, shift: e.shiftKey });
      });

      item.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (entry.isContainer || entry.type === 'dir')
          self.navigate(childPath(self.currentPath, entry.name));
        else if (self.isVfsMode)
          openFile(childPath(self.currentPath, entry.name), entry.name);
      });

      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!self.selectedItems.find(s => s.name === entry.name))
          self.selectItem(index, item, entry, { ctrl: false, shift: false });
        self.showItemContextMenu(e.clientX, e.clientY);
      });

      return item;
    }

    // -----------------------------------------------------------------------
    // Object browser view (non-VFS)
    // -----------------------------------------------------------------------
    renderObjectView(result) {
      this.mainView.innerHTML = '';
      const entries = result.entries || [];
      const self = this;

      if (result.nodeType === 'function' || result.nodeType === 'class') {
        this._showDetailPanel({ name: baseName(this.currentPath) || result.nodeType, type: result.nodeType, preview: result.preview, detail: result.detail });
        return;
      }

      if (entries.length === 0 && !CONTAINER_TYPES.has(result.nodeType)) {
        const detail = document.createElement('div');
        detail.className = 'leaf-detail';
        detail.innerHTML = '<div class="leaf-icon">' + iconFor(result.nodeType) + '</div>'
          + '<div class="leaf-type">' + escapeHtml(result.nodeType || 'unknown') + '</div>'
          + '<div class="leaf-value">' + escapeHtml(result.preview || '') + '</div>';
        this.mainView.appendChild(detail);
        if (paneManager.activePaneId === this.id) {
          statusCount.textContent = result.nodeType;
          statusInfo.textContent = result.preview || '';
        }
        return;
      }

      const grid = document.createElement('div');
      grid.className = 'file-list';

      for (let i = 0; i < entries.length; ++i) {
        const entry = entries[i];
        const item = document.createElement('div');
        item.className = 'file-item';
        item.dataset.name = entry.name;
        item.dataset.index = String(i);
        item.title = entry.name + ' (' + entry.type + ')\n' + entry.preview;

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          self.selectItem(i, item, entry, { ctrl: e.ctrlKey, shift: e.shiftKey });
          if (paneManager.activePaneId === self.id)
            statusInfo.textContent = entry.type + ': ' + entry.preview;
        });

        item.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          if (entry.isContainer)
            self.navigate(childPath(self.currentPath, entry.name));
          else
            self._showDetailPanel(entry);
        });

        item.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!self.selectedItems.find(s => s.name === entry.name))
            self.selectItem(i, item, entry, { ctrl: false, shift: false });
          self.showItemContextMenu(e.clientX, e.clientY);
        });

        const iconEl = document.createElement('span');
        iconEl.className = 'item-icon';
        iconEl.innerHTML = iconFor(entry.type);
        item.appendChild(iconEl);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'item-name';
        nameSpan.textContent = entry.name;
        item.appendChild(nameSpan);

        const typeSpan = document.createElement('span');
        typeSpan.className = 'item-type';
        typeSpan.textContent = entry.type + (entry.childCount > 0 ? ' (' + entry.childCount + ')' : '');
        item.appendChild(typeSpan);

        grid.appendChild(item);
      }

      grid.addEventListener('click', (e) => { if (e.target === grid) self.clearSelection(); });
      grid.addEventListener('contextmenu', (e) => {
        if (e.target === grid) {
          e.preventDefault();
          self.clearSelection();
          self.showBackgroundContextMenu(e.clientX, e.clientY);
        }
      });

      this.mainView.appendChild(grid);
      if (paneManager.activePaneId === this.id) {
        statusCount.textContent = entries.length + ' item(s)';
        statusInfo.textContent = result.nodeType + ': ' + (result.preview || '');
      }
    }

    _showDetailPanel(entry) {
      this.mainView.innerHTML = '';
      const panel = document.createElement('div');
      panel.className = 'detail-panel';
      const self = this;

      const header = document.createElement('div');
      header.className = 'detail-header';

      const backBtn = document.createElement('button');
      backBtn.className = 'detail-back';
      backBtn.textContent = '\u25C0 Back';
      backBtn.addEventListener('click', () => self.render());
      header.appendChild(backBtn);

      const info = document.createElement('div');
      info.className = 'detail-info';
      const iconEl = document.createElement('span');
      iconEl.className = 'detail-icon';
      iconEl.innerHTML = iconFor(entry.type);
      info.appendChild(iconEl);
      const nameEl = document.createElement('span');
      nameEl.className = 'detail-name';
      nameEl.textContent = entry.name;
      info.appendChild(nameEl);
      const typeEl = document.createElement('span');
      typeEl.className = 'detail-type';
      typeEl.textContent = entry.type;
      info.appendChild(typeEl);
      header.appendChild(info);
      panel.appendChild(header);

      const content = document.createElement('pre');
      content.className = 'detail-content';
      const rawText = entry.detail || entry.preview || '';
      if (entry.type === 'function' || entry.type === 'class') {
        content.classList.add('detail-code');
        content.innerHTML = highlightJS(rawText);
      } else
        content.textContent = rawText;
      panel.appendChild(content);

      this.mainView.appendChild(panel);
      if (paneManager.activePaneId === this.id) {
        statusCount.textContent = entry.type;
        statusInfo.textContent = entry.name;
      }
    }

    _renderError(message) {
      this.mainView.innerHTML = '';
      const errDiv = document.createElement('div');
      errDiv.className = 'leaf-detail';
      errDiv.innerHTML = '<div class="leaf-icon">' + ICONS.error + '</div>'
        + '<div class="leaf-type">Error</div>'
        + '<div class="leaf-value">' + escapeHtml(message) + '</div>';
      this.mainView.appendChild(errDiv);
      if (paneManager.activePaneId === this.id) {
        statusCount.textContent = '';
        statusInfo.textContent = message;
      }
    }

    // -----------------------------------------------------------------------
    // Expanded view (Ctrl+E)
    // -----------------------------------------------------------------------
    toggleExpandedMode() {
      this.expandedMode = !this.expandedMode;
      this.render();
    }

    async renderExpandedView() {
      const entries = [];
      const vfsPath = toVfsRelative(this.currentPath);
      await this._collectExpandedEntries(vfsPath, '', entries, 5000);

      this.currentEntries = entries;
      this.sortEntries();

      // Render in current view mode (details is best for expanded, but respect user choice)
      if (this.viewMode === 'details')
        this.renderDetailsView();
      else if (this.viewMode === 'tiles')
        this.renderTilesView();
      else
        this.renderIconsView();

      if (paneManager.activePaneId === this.id) this.updateStatusBar();
    }

    async _collectExpandedEntries(basePath, relPrefix, results, maxEntries) {
      if (results.length >= maxEntries) return;
      const resp = await vfsList(basePath);
      for (const entry of (resp.entries || [])) {
        if (results.length >= maxEntries) return;
        const entryVfsPath = basePath === '/' ? '/' + entry.name : basePath + '/' + entry.name;
        const relPath = relPrefix ? relPrefix + '/' + entry.name : entry.name;
        results.push({
          name: entry.name,
          type: entry.type === 'dir' ? 'dir' : 'file',
          isContainer: entry.type === 'dir',
          size: entry.size || 0,
          mtime: entry.mtime || null,
          preview: entry.type === 'dir' ? 'Folder' : formatSize(entry.size || 0),
          entryType: entry.type === 'dir' ? 'vfsFolder' : 'vfsFile',
          _relPath: relPrefix || '.',
          _vfsPath: entryVfsPath,
        });
        if (entry.type === 'dir')
          await this._collectExpandedEntries(entryVfsPath, relPath, results, maxEntries);
      }
    }

    // -----------------------------------------------------------------------
    // Preview pane
    // -----------------------------------------------------------------------
    togglePreviewPane() {
      this.previewPaneVisible = !this.previewPaneVisible;
      this.previewPane.classList.toggle('visible', this.previewPaneVisible);
      this.previewPane.style.display = this.previewPaneVisible ? '' : 'none';
      this.updatePreview();
      if (paneManager.activePaneId === this.id) updatePreviewButton();
    }

    updatePreview() {
      if (!this.previewPaneVisible) return;
      clearTimeout(this._previewDebounce);
      this._previewDebounce = setTimeout(() => this._doUpdatePreview(), 200);
    }

    async _doUpdatePreview() {
      if (!this.previewPaneVisible) return;
      this.previewPane.innerHTML = '';
      const self = this;

      if (this.selectedItems.length === 0) {
        let totalSize = 0, fileCount = 0, folderCount = 0;
        for (const e of this.currentEntries) {
          if (e.type === 'dir') ++folderCount;
          else { ++fileCount; totalSize += e.size || 0; }
        }
        const div = document.createElement('div');
        div.className = 'preview-folder-info';
        div.innerHTML = '<strong>' + escapeHtml(baseName(this.currentPath) || 'Root') + '</strong><br>'
          + this.currentEntries.length + ' items<br>'
          + folderCount + ' folder(s), ' + fileCount + ' file(s)<br>'
          + (totalSize > 0 ? 'Total: ' + formatSize(totalSize) : '');
        this.previewPane.appendChild(div);
        return;
      }

      if (this.selectedItems.length > 1) {
        let totalSize = 0;
        for (const s of this.selectedItems) {
          const e = this.currentEntries.find(x => x.name === s.name);
          if (e && e.type !== 'dir') totalSize += e.size || 0;
        }
        const div = document.createElement('div');
        div.className = 'preview-multi-info';
        div.textContent = this.selectedItems.length + ' items selected' + (totalSize > 0 ? '\nTotal: ' + formatSize(totalSize) : '');
        this.previewPane.appendChild(div);
        return;
      }

      // Single selection
      const sel = this.selectedItems[0];
      const entry = this.currentEntries.find(e => e.name === sel.name);
      if (!entry) return;

      // Prev/Next nav
      const navBar = document.createElement('div');
      navBar.className = 'preview-nav';
      const prevBtn = document.createElement('button');
      prevBtn.className = 'preview-nav-btn';
      prevBtn.textContent = '\u25C0';
      prevBtn.title = 'Previous';
      prevBtn.addEventListener('click', () => self._previewNavigate(-1));
      navBar.appendChild(prevBtn);
      const nextBtn = document.createElement('button');
      nextBtn.className = 'preview-nav-btn';
      nextBtn.textContent = '\u25B6';
      nextBtn.title = 'Next';
      nextBtn.addEventListener('click', () => self._previewNavigate(1));
      navBar.appendChild(nextBtn);
      this.previewPane.appendChild(navBar);

      if (sel.isDir) {
        const div = document.createElement('div');
        div.className = 'preview-folder-info';
        div.innerHTML = '<strong>' + escapeHtml(sel.name) + '</strong><br>Folder';
        this.previewPane.appendChild(div);
        this._renderPreviewMeta(entry);
        return;
      }

      const ext = getFileExtension(sel.name).replace('.', '');
      const previewPath = sel.path;

      if (this.isVfsMode) {
        const vfsPath = toVfsRelative(previewPath);

        if (_IMAGE_EXTS.has(ext)) {
          try {
            const result = await vfsRead(vfsPath);
            if (result.data) {
              const dataUri = await _toDataUri(result.data, sel.name);
              if (dataUri) {
                // Zoom controls
                const zoomBar = document.createElement('div');
                zoomBar.className = 'preview-zoom-bar';
                const zoomOut = document.createElement('button');
                zoomOut.textContent = '-';
                zoomOut.className = 'preview-zoom-btn';
                zoomOut.addEventListener('click', () => {
                  self._previewZoom = Math.max(25, self._previewZoom - 25);
                  img.style.width = self._previewZoom + '%';
                  zoomLabel.textContent = self._previewZoom + '%';
                });
                zoomBar.appendChild(zoomOut);
                const zoomLabel = document.createElement('span');
                zoomLabel.className = 'preview-zoom-label';
                zoomLabel.textContent = self._previewZoom + '%';
                zoomBar.appendChild(zoomLabel);
                const zoomIn = document.createElement('button');
                zoomIn.textContent = '+';
                zoomIn.className = 'preview-zoom-btn';
                zoomIn.addEventListener('click', () => {
                  self._previewZoom = Math.min(400, self._previewZoom + 25);
                  img.style.width = self._previewZoom + '%';
                  zoomLabel.textContent = self._previewZoom + '%';
                });
                zoomBar.appendChild(zoomIn);
                this.previewPane.appendChild(zoomBar);

                const img = document.createElement('img');
                img.className = 'preview-thumb';
                img.src = dataUri;
                img.style.width = self._previewZoom + '%';
                this.previewPane.appendChild(img);
              }
            }
          } catch {}
        } else if (_TEXT_EXTS.has(ext)) {
          try {
            const result = await vfsRead(vfsPath);
            if (result.data) {
              const text = _decodeText(result.data);
              const lines = text.split('\n').slice(0, 100);
              const pre = document.createElement('pre');
              pre.className = 'preview-text';
              pre.textContent = lines.join('\n');
              this.previewPane.appendChild(pre);
            }
          } catch {}
        } else if (_AUDIO_EXTS.has(ext)) {
          try {
            const result = await vfsRead(vfsPath);
            if (result.data) {
              const dataUri = await _toDataUri(result.data, sel.name);
              if (dataUri) {
                const audio = document.createElement('audio');
                audio.className = 'preview-media';
                audio.controls = true;
                audio.src = dataUri;
                this.previewPane.appendChild(audio);
              }
            }
          } catch {}
        } else if (_VIDEO_EXTS.has(ext)) {
          try {
            const result = await vfsRead(vfsPath);
            if (result.data) {
              const dataUri = await _toDataUri(result.data, sel.name);
              if (dataUri) {
                const video = document.createElement('video');
                video.className = 'preview-media';
                video.controls = true;
                video.style.maxWidth = '100%';
                video.style.maxHeight = '200px';
                video.src = dataUri;
                this.previewPane.appendChild(video);
              }
            }
          } catch {}
        } else {
          try {
            const result = await vfsRead(vfsPath);
            if (result.data) {
              const bytes = _toBytes(result.data);
              if (bytes) {
                const hexLines = [];
                const len = Math.min(bytes.length, 256);
                for (let off = 0; off < len; off += 16) {
                  const hex = [];
                  const ascii = [];
                  for (let j = 0; j < 16 && off + j < len; ++j) {
                    const b = bytes[off + j];
                    hex.push(b.toString(16).padStart(2, '0'));
                    ascii.push(b >= 32 && b <= 126 ? String.fromCharCode(b) : '.');
                  }
                  hexLines.push(off.toString(16).padStart(8, '0') + '  ' + hex.join(' ').padEnd(48) + '  ' + ascii.join(''));
                }
                const pre = document.createElement('pre');
                pre.className = 'preview-hex';
                pre.textContent = hexLines.join('\n');
                this.previewPane.appendChild(pre);
              }
            }
          } catch {}
        }
      }

      this._renderPreviewMeta(entry);
    }

    _previewNavigate(delta) {
      if (this.selectedItems.length !== 1) return;
      const curIdx = this.selectedItems[0].index;
      const files = this.currentEntries.filter(e => e.type !== 'dir');
      if (files.length === 0) return;
      const curFileIdx = files.findIndex(e => e.name === this.selectedItems[0].name);
      if (curFileIdx < 0) return;
      const newFileIdx = (curFileIdx + delta + files.length) % files.length;
      const newEntry = files[newFileIdx];
      const globalIdx = this.currentEntries.indexOf(newEntry);
      const elements = this._getVisibleEntryElements();
      if (globalIdx >= 0 && globalIdx < elements.length) {
        this.selectItem(globalIdx, elements[globalIdx], newEntry, { ctrl: false, shift: false });
        elements[globalIdx].scrollIntoView({ block: 'nearest' });
      }
    }

    _renderPreviewMeta(entry) {
      const table = document.createElement('table');
      table.className = 'preview-meta-table';
      const fields = [
        ['Name', entry.name],
        ['Type', getFileTypeLabel(entry)],
      ];
      if (entry.type !== 'dir' && entry.size != null)
        fields.push(['Size', formatSize(entry.size)]);
      if (entry.mtime)
        fields.push(['Modified', formatDate(entry.mtime)]);

      for (const [label, value] of fields) {
        const tr = document.createElement('tr');
        const tdL = document.createElement('td');
        tdL.className = 'meta-label';
        tdL.textContent = label;
        tr.appendChild(tdL);
        const tdV = document.createElement('td');
        tdV.className = 'meta-value';
        tdV.textContent = value;
        tr.appendChild(tdV);
        table.appendChild(tr);
      }
      this.previewPane.appendChild(table);
    }

    // -----------------------------------------------------------------------
    // Context menus
    // -----------------------------------------------------------------------
    showItemContextMenu(x, y) {
      const menu = createContextMenuEl(x, y);
      const hasSelection = this.selectedItems.length > 0;
      const singleSelection = this.selectedItems.length === 1;
      const canModify = this.isVfsMode;
      const self = this;

      if (hasSelection) {
        const sel = this.selectedItems[0];
        addCtxItem(menu, 'Open', () => {
          if (sel.isDir) self.navigate(sel.path);
          else if (self.isVfsMode) openFile(sel.path, sel.name);
        }, false, ICONS.ctxOpen);

        if (singleSelection && sel.isDir)
          addCtxItem(menu, 'Open in New Tab', () => self.createTab(sel.path), false, ICONS.ctxOpenTab);

        // Open with submenu
        if (singleSelection && !sel.isDir) {
          const ext = getFileExtension(sel.name).replace('.', '');
          if (ext && _fileAssocMap) {
            const openWithPanel = addCtxSubmenu(menu, 'Open with...', ICONS.ctxOpenWith);
            const seenApps = new Set();
            for (const assoc of Object.values(_fileAssocMap)) {
              if (!assoc.appId || seenApps.has(assoc.appId)) continue;
              seenApps.add(assoc.appId);
              const appIcon = _iconSvgCache.get(assoc.iconPath);
              const appSvg = appIcon ? ('<svg viewBox="' + appIcon.viewBox + '" xmlns="http://www.w3.org/2000/svg">' + appIcon.inner + '</svg>') : null;
              addCtxItem(openWithPanel, assoc.appId, () => {
                Shell32.ShellExecute(assoc.appId, { path: toVfsRelative(sel.path) });
              }, false, appSvg);
            }
            if (seenApps.size === 0)
              addCtxItem(openWithPanel, '(no apps)', () => {}, true);
          }
        }

        const canDownload = canModify && !this.selectedItems.some(s => s.isDir);
        addCtxItem(menu, 'Download', () => self.doDownload(), !canDownload, ICONS.ctxDownload);

        addCtxSep(menu);

        // Copy as Path
        addCtxItem(menu, 'Copy as Path', () => {
          const paths = self.selectedItems.map(s => isVfsPath(s.path) ? toVfsRelative(s.path) : s.path);
          try { navigator.clipboard.writeText(paths.join('\n')); } catch {}
        }, false, ICONS.ctxCopyPath);
      }

      addCtxItem(menu, 'Cut', () => self.doClipboardCut(), !canModify || !hasSelection, ICONS.ctxCut);
      addCtxItem(menu, 'Copy', () => self.doClipboardCopy(), !hasSelection, ICONS.ctxCopy);

      addCtxSep(menu);

      addCtxItem(menu, 'Delete', () => self.doDelete(), !canModify || !hasSelection, ICONS.ctxDelete);
      addCtxItem(menu, 'Rename', () => self.beginRename(), !canModify || !singleSelection, ICONS.ctxRename);

      // New Folder with Selection
      if (hasSelection && this.selectedItems.length > 1 && canModify) {
        addCtxSep(menu);
        addCtxItem(menu, 'New Folder with Selection', () => self.doNewFolderWithSelection(), false, ICONS.ctxFolderSel);
      }

      if (singleSelection && this.selectedItems[0].isDir && this.isVfsMode) {
        addCtxSep(menu);
        const isQA = quickAccessPaths.includes(this.selectedItems[0].path);
        addCtxItem(menu, isQA ? 'Unpin from Quick Access' : 'Pin to Quick Access', () => {
          if (isQA)
            quickAccessPaths = quickAccessPaths.filter(p => p !== self.selectedItems[0].path);
          else
            quickAccessPaths.push(self.selectedItems[0].path);
          saveQuickAccess();
          buildSidebar();
        }, false, isQA ? ICONS.ctxUnpin : ICONS.pin);
        const isBM = bookmarkPaths.includes(this.selectedItems[0].path);
        addCtxItem(menu, isBM ? 'Remove Bookmark' : 'Add to Bookmarks', () => {
          if (isBM)
            bookmarkPaths = bookmarkPaths.filter(p => p !== self.selectedItems[0].path);
          else
            bookmarkPaths.push(self.selectedItems[0].path);
          saveBookmarks();
          buildSidebar();
        }, false, isBM ? ICONS.ctxRemove : ICONS.bookmark);
      }

      if (singleSelection && isMountRoot(this.selectedItems[0].path)) {
        addCtxSep(menu);
        addCtxItem(menu, 'Unmount', () => self.doUnmount(self.selectedItems[0].path), false, ICONS.ctxUnmount);
      }

      addCtxSep(menu);
      addCtxItem(menu, 'Properties', () => self.showProperties(), false, ICONS.ctxProperties);
    }

    showBackgroundContextMenu(x, y) {
      const menu = createContextMenuEl(x, y);
      const canModify = this.isVfsMode;
      const self = this;

      if (canModify) {
        const newPanel = addCtxSubmenu(menu, 'New', ICONS.ctxNew);
        addCtxItem(newPanel, 'Folder', () => self.doNewFolder(), false, ICONS.ctxNewFolder);
        addCtxItem(newPanel, 'Text Document', () => self.doNewTextDocument(), false, ICONS.ctxNewFile);
        addCtxSep(menu);
      }

      addCtxItem(menu, 'Paste', () => self.doPaste(), !clipboard || !canModify, ICONS.ctxPaste);
      addCtxSep(menu);
      addCtxItem(menu, 'Refresh', () => self.doRefresh(), false, ICONS.ctxRefresh);
      addCtxSep(menu);

      if (this.isVfsMode) {
        addCtxItem(menu, 'Mount local folder', async () => {
          try {
            const result = await Kernel32.MountLocalDirectory();
            if (result.cancelled) return;
            if (result.success) self.navigate('/vfs/mount/' + result.name);
          } catch (err) { showAlert('Mount failed: ' + err.message); }
        }, false, ICONS.ctxMount);
        if (isMountRoot(this.currentPath))
          addCtxItem(menu, 'Unmount', () => self.doUnmount(), false, ICONS.ctxUnmount);
        addCtxSep(menu);
      }

      addCtxItem(menu, 'Properties', () => self.showFolderProperties(), false, ICONS.ctxProperties);
    }

    // -----------------------------------------------------------------------
    // File operations
    // -----------------------------------------------------------------------
    async doNewFolder() {
      if (!this.isVfsMode) return;
      let name = 'New Folder';
      let counter = 1;
      const existingNames = new Set(this.currentEntries.map(e => e.name));
      while (existingNames.has(name)) name = 'New Folder (' + (++counter) + ')';
      const vfsPath = toVfsRelative(this.currentPath);
      const folderPath = (vfsPath === '/' ? '/' : vfsPath + '/') + name;
      const result = await vfsMkdir(folderPath);
      if (result.error) { showAlert('Could not create folder: ' + result.error); return; }
      await this.doRefresh();
      const newItem = this._findItemByName(name);
      if (newItem) {
        this.selectItem(newItem.index, newItem.el, newItem.entry, { ctrl: false, shift: false });
        this.beginRename();
      }
    }

    _findItemByName(name) {
      const elements = this._getVisibleEntryElements();
      for (let i = 0; i < elements.length; ++i)
        if ((elements[i].dataset.name || elements[i].querySelector?.('.item-name')?.textContent) === name)
          return { index: i, el: elements[i], entry: this.currentEntries[i] };
      return null;
    }

    async doNewTextDocument() {
      if (!this.isVfsMode) return;
      let name = 'New Text Document.txt';
      let counter = 1;
      const existingNames = new Set(this.currentEntries.map(e => e.name));
      while (existingNames.has(name)) name = 'New Text Document (' + (++counter) + ').txt';
      const vfsPath = toVfsRelative(this.currentPath);
      const filePath = (vfsPath === '/' ? '/' : vfsPath + '/') + name;
      const result = await vfsWrite(filePath, '');
      if (result.error) { showAlert('Could not create file: ' + result.error); return; }
      await this.doRefresh();
      const newItem = this._findItemByName(name);
      if (newItem) {
        this.selectItem(newItem.index, newItem.el, newItem.entry, { ctrl: false, shift: false });
        this.beginRename();
      }
    }

    async doNewFolderWithSelection() {
      if (!this.isVfsMode || this.selectedItems.length < 2) return;
      let name = 'New Folder';
      let counter = 1;
      const existingNames = new Set(this.currentEntries.map(e => e.name));
      while (existingNames.has(name)) name = 'New Folder (' + (++counter) + ')';
      const vfsBase = toVfsRelative(this.currentPath);
      const folderPath = (vfsBase === '/' ? '/' : vfsBase + '/') + name;
      const mkResult = await vfsMkdir(folderPath);
      if (mkResult.error) { showAlert('Could not create folder: ' + mkResult.error); return; }
      for (const sel of this.selectedItems) {
        const srcVfs = toVfsRelative(sel.path);
        const destVfs = folderPath + '/' + sel.name;
        await vfsMove(srcVfs, destVfs);
      }
      this.clearSelection();
      await this.doRefresh();
    }

    async doDelete() {
      if (!this.isVfsMode || this.selectedItems.length === 0) return;
      const names = this.selectedItems.map(s => s.name);
      const msg = names.length === 1
        ? 'Are you sure you want to delete "' + names[0] + '"?'
        : 'Are you sure you want to delete ' + names.length + ' items?';
      const confirmed = await showConfirm(msg);
      if (!confirmed) return;
      for (const sel of this.selectedItems) {
        const vfsPath = toVfsRelative(sel.path);
        const result = await vfsDelete(vfsPath);
        if (result.error) showAlert('Could not delete "' + sel.name + '": ' + result.error);
      }
      this.clearSelection();
      await this.doRefresh();
    }

    beginRename() {
      if (!this.isVfsMode || this.selectedItems.length !== 1) return;
      const sel = this.selectedItems[0];
      const el = sel.entryEl;
      if (!el) return;

      let nameSpan = el.querySelector('.item-name');
      if (!nameSpan) {
        const cellName = el.querySelector('.cell-name');
        if (cellName) nameSpan = cellName.lastElementChild;
      }
      if (!nameSpan) return;

      this.cancelRename();
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'inline-rename';
      input.value = sel.name;
      this.activeRename = { input, nameSpan, originalName: sel.name, el };
      nameSpan.style.display = 'none';
      nameSpan.parentNode.insertBefore(input, nameSpan.nextSibling);
      input.focus();
      const dotIdx = sel.name.lastIndexOf('.');
      if (dotIdx > 0) input.setSelectionRange(0, dotIdx);
      else input.select();

      const self = this;
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); self.commitRename(); }
        else if (e.key === 'Escape') { e.preventDefault(); self.cancelRename(); }
      });

      input.addEventListener('blur', () => {
        setTimeout(() => { if (self.activeRename && self.activeRename.input === input) self.commitRename(); }, 100);
      });
    }

    async commitRename() {
      if (!this.activeRename) return;
      const { input, nameSpan, originalName } = this.activeRename;
      const newName = input.value.trim();
      input.remove();
      nameSpan.style.display = '';
      this.activeRename = null;
      if (!newName || newName === originalName) return;
      if (newName.includes('/') || newName.includes('\\')) {
        showAlert('File names cannot contain / or \\ characters.');
        return;
      }
      const oldVfsPath = toVfsRelative(childPath(this.currentPath, originalName));
      const newVfsPath = toVfsRelative(childPath(this.currentPath, newName));
      const result = await vfsRename(oldVfsPath, newVfsPath);
      if (result.error) showAlert('Could not rename: ' + result.error);
      this.clearSelection();
      await this.doRefresh();
    }

    cancelRename() {
      if (!this.activeRename) return;
      const { input, nameSpan } = this.activeRename;
      input.remove();
      nameSpan.style.display = '';
      this.activeRename = null;
    }

    doClipboardCopy() {
      if (this.selectedItems.length === 0) return;
      clipboard = { mode: 'copy', items: this.selectedItems.map(s => ({ name: s.name, path: s.path })) };
      window.parent.postMessage({ type: 'sz:clipboardUpdate', clipboard }, '*');
      this._updateCutVisuals();
      if (paneManager.activePaneId === this.id) updateRibbonState();
    }

    doClipboardCut() {
      if (!this.isVfsMode || this.selectedItems.length === 0) return;
      clipboard = { mode: 'cut', items: this.selectedItems.map(s => ({ name: s.name, path: s.path })) };
      window.parent.postMessage({ type: 'sz:clipboardUpdate', clipboard }, '*');
      this._updateCutVisuals();
      if (paneManager.activePaneId === this.id) updateRibbonState();
    }

    _updateCutVisuals() {
      const elements = this._getVisibleEntryElements();
      for (const el of elements) {
        el.classList.remove('cut-pending');
        if (clipboard && clipboard.mode === 'cut') {
          const itemName = el.dataset.name;
          const itemPath = childPath(this.currentPath, itemName);
          if (clipboard.items.some(ci => ci.path === itemPath))
            el.classList.add('cut-pending');
        }
      }
    }

    async doPaste() {
      if (!clipboard || !this.isVfsMode) return;

      // Check if source is from the object browser (non-VFS paths)
      const isObjBrowserSource = clipboard.items.some(ci => !isVfsPath(ci.path));

      if (isObjBrowserSource) {
        // Resolve objects and write them as files into VFS
        for (const ci of clipboard.items) {
          const content = _resolveObjectAsFile(ci.path, ci.name);
          if (!content) continue;
          const destDir = toVfsRelative(this.currentPath);
          const dest = (destDir === '/' ? '/' : destDir + '/') + content.name;
          await vfsWrite(dest, content.data);
        }
        this.clearSelection();
        await this.doRefresh();
        return;
      }

      for (const ci of clipboard.items) {
        const srcVfs = toVfsRelative(ci.path);
        let destName = ci.name;
        if (clipboard.mode === 'copy' && parentPath(ci.path) === this.currentPath) {
          const existingNames = new Set(this.currentEntries.map(e => e.name));
          if (existingNames.has(destName)) {
            const dotIdx = destName.lastIndexOf('.');
            if (dotIdx > 0) {
              const base = destName.slice(0, dotIdx), ext = destName.slice(dotIdx);
              let counter = 1;
              do { destName = base + ' - Copy' + (counter > 1 ? ' (' + counter + ')' : '') + ext; ++counter; } while (existingNames.has(destName));
            } else {
              let counter = 1;
              do { destName = ci.name + ' - Copy' + (counter > 1 ? ' (' + counter + ')' : ''); ++counter; } while (existingNames.has(destName));
            }
          }
        }
        const destVfs = toVfsRelative(childPath(this.currentPath, destName));
        const result = clipboard.mode === 'copy' ? await vfsCopy(srcVfs, destVfs) : await vfsMove(srcVfs, destVfs);
        if (result.error) showAlert('Could not ' + clipboard.mode + ' "' + ci.name + '": ' + result.error);
      }
      if (clipboard.mode === 'cut') {
        clipboard = null;
        window.parent.postMessage({ type: 'sz:clipboardUpdate', clipboard: null }, '*');
      }
      this.clearSelection();
      await this.doRefresh();
    }

    async doUpload() {
      if (!this.isVfsMode) return;
      uploadInput.click();
    }

    async doDownload() {
      if (!this.isVfsMode || this.selectedItems.length === 0) return;
      for (const sel of this.selectedItems) {
        if (sel.isDir) continue;
        const vfsPath = toVfsRelative(sel.path);
        const result = await vfsRead(vfsPath);
        if (result.error) { showAlert('Could not download "' + sel.name + '": ' + result.error); continue; }
        const content = result.data != null ? result.data : '';
        const blob = contentToDownloadBlob(content);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = sel.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }

    async doRefresh() {
      const node = treeNodeMap.get(this.currentPath);
      if (node) node.refresh();
      this.clearSelection();
      await this.navigate(this.currentPath, true);
    }

    async doUnmount(mountPath) {
      const prefix = getMountPrefix(mountPath || (this.selectedItems.length === 1 && isMountRoot(this.selectedItems[0].path) ? this.selectedItems[0].path : this.currentPath));
      if (!prefix) return;
      const confirmed = await showConfirm('Unmount "' + prefix.replace('/mount/', '') + '"? Files on disk will not be deleted.');
      if (!confirmed) return;
      try {
        await Kernel32.UnmountDirectory(prefix);
        this.navigate('/vfs/mount');
      } catch (err) {
        showAlert('Unmount failed: ' + err.message);
      }
    }

    // -- Properties dialog --
    async showProperties() {
      if (this.selectedItems.length === 0) return;
      const sel = this.selectedItems[0];
      const entry = this.currentEntries.find(e => e.name === sel.name);
      if (!entry) return;

      const overlay = document.getElementById('dlg-properties');
      const tabsEl = document.getElementById('props-tabs');
      const contentEl = document.getElementById('props-content');
      document.getElementById('props-title').textContent = sel.name + ' - Properties';

      const generalFields = [
        { label: 'Name', value: sel.name },
        { label: 'Path', value: formatPath(sel.path) },
        { label: 'Type', value: sel.isDir ? 'Folder' : 'File' },
      ];
      if (!sel.isDir && entry.size != null) generalFields.push({ label: 'Size', value: formatSize(entry.size) });
      if (entry.mtime) generalFields.push({ label: 'Modified', value: formatDate(entry.mtime) });
      generalFields.push({ label: 'Location', value: this.isVfsMode ? 'VFS (localStorage)' : 'SZ Object Tree' });

      const allTabs = [{ name: 'General', fields: generalFields }];

      if (!sel.isDir && this.isVfsMode && typeof SZ.MetadataParsers !== 'undefined') {
        try {
          const vfsPath = toVfsRelative(sel.path);
          const bytes = await Kernel32.ReadAllBytes(vfsPath);
          if (bytes && bytes.length > 0) {
            const result = SZ.MetadataParsers.parse(bytes, sel.name);
            if (result.fileType) generalFields.splice(2, 1, { label: 'Type', value: result.fileType.name });
            for (const cat of result.categories) {
              if (cat.name === 'General') continue;
              allTabs.push({ name: cat.name, fields: cat.fields.map(f => ({ label: f.label, value: f.value })) });
            }
          }
        } catch {}
      }

      let activeTab = 0;
      function renderPropsTabs() {
        tabsEl.innerHTML = '';
        allTabs.forEach((tab, i) => {
          const btn = document.createElement('button');
          btn.className = 'props-tab' + (i === activeTab ? ' active' : '');
          btn.textContent = tab.name;
          btn.addEventListener('click', () => { activeTab = i; renderPropsTabs(); renderPropsContent(); });
          tabsEl.appendChild(btn);
        });
      }

      function renderPropsContent() {
        contentEl.innerHTML = '';
        const tab = allTabs[activeTab];
        if (!tab) return;
        const table = document.createElement('table');
        table.className = 'props-table';
        for (const field of tab.fields) {
          const tr = document.createElement('tr');
          const tdL = document.createElement('td');
          tdL.className = 'props-label';
          tdL.textContent = field.label;
          tr.appendChild(tdL);
          const tdV = document.createElement('td');
          tdV.className = 'props-value';
          tdV.textContent = String(field.value);
          tr.appendChild(tdV);
          table.appendChild(tr);
        }
        contentEl.appendChild(table);
      }

      renderPropsTabs();
      renderPropsContent();

      const mvBtn = document.getElementById('btn-open-metadata-viewer');
      mvBtn.style.display = sel.isDir ? 'none' : '';
      mvBtn.onclick = () => {
        overlay.classList.remove('visible');
        Shell32.ShellExecute('metadata-viewer', { file: this.isVfsMode ? toVfsRelative(sel.path) : sel.path });
      };

      overlay.classList.add('visible');
      overlay.querySelector('button[data-result="ok"]').addEventListener('click', () => overlay.classList.remove('visible'), { once: true });
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('visible'); }, { once: true });
    }

    showFolderProperties() {
      const lines = [];
      lines.push('Path: ' + formatPath(this.currentPath));
      lines.push('Items: ' + this.currentEntries.length);
      if (this.isVfsMode) {
        let totalSize = 0;
        for (const e of this.currentEntries)
          if (e.type !== 'dir') totalSize += e.size || 0;
        lines.push('Total file size: ' + formatSize(totalSize));
        lines.push('Location: VFS (localStorage)');
      } else
        lines.push('Location: SZ Object Tree (read-only)');
      showAlert(lines.join('\n'));
    }

    // -----------------------------------------------------------------------
    // Tab management (per-pane)
    // -----------------------------------------------------------------------
    _createTabState(path) {
      return {
        id: this._nextTabId++,
        path: path || '/',
        backStack: [],
        forwardStack: [],
        selectedItems: [],
        lastClickedIndex: -1,
        currentEntries: [],
        isVfsMode: isVfsPath(path || '/'),
        searchFilter: '',
        isSearchResultsView: false,
        scrollPosition: 0,
      };
    }

    saveTabState() {
      const tab = this.tabs.find(t => t.id === this.activeTabId);
      if (!tab) return;
      tab.path = this.currentPath;
      tab.backStack = this.backStack.slice();
      tab.forwardStack = this.forwardStack.slice();
      tab.selectedItems = this.selectedItems.map(s => ({ name: s.name, path: s.path, isDir: s.isDir, index: s.index }));
      tab.lastClickedIndex = this.lastClickedIndex;
      tab.currentEntries = this.currentEntries;
      tab.isVfsMode = this.isVfsMode;
      tab.searchFilter = this.searchFilter;
      tab.isSearchResultsView = this.isSearchResultsView;
      tab.scrollPosition = this.mainView.scrollTop;
    }

    loadTabState(tabId) {
      const tab = this.tabs.find(t => t.id === tabId);
      if (!tab) return;
      this.currentPath = tab.path;
      this.backStack = tab.backStack.slice();
      this.forwardStack = tab.forwardStack.slice();
      this.selectedItems = [];
      this.lastClickedIndex = tab.lastClickedIndex;
      this.currentEntries = tab.currentEntries;
      this.isVfsMode = tab.isVfsMode;
      this.searchFilter = tab.searchFilter;
      this.isSearchResultsView = tab.isSearchResultsView;
    }

    renderTabBar() {
      this.tabBar.innerHTML = '';
      if (this.tabs.length <= 1) {
        this.tabBar.classList.remove('visible');
        return;
      }
      this.tabBar.classList.add('visible');
      const self = this;

      for (const tab of this.tabs) {
        const el = document.createElement('div');
        el.className = 'explorer-tab' + (tab.id === this.activeTabId ? ' active' : '');

        const label = document.createElement('span');
        label.className = 'tab-label';
        let tabLabel = baseName(tab.path) || 'Root';
        if (this.expandedMode) tabLabel = '[...] ' + tabLabel;
        label.textContent = tabLabel;
        el.appendChild(label);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'tab-close';
        closeBtn.textContent = '\u00D7';
        closeBtn.addEventListener('click', (e) => { e.stopPropagation(); self.closeTab(tab.id); });
        el.appendChild(closeBtn);

        el.addEventListener('click', () => self.switchTab(tab.id));
        el.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); self.closeTab(tab.id); } });

        // Make tab draggable for cross-pane transfer
        el.draggable = true;
        el.addEventListener('dragstart', (e) => {
          self.saveTabState();
          const tabState = self.tabs.find(t => t.id === tab.id);
          e.dataTransfer.setData('application/x-sz-tab', JSON.stringify({
            tabId: tab.id,
            sourcePaneId: self.id,
            tabState,
          }));
          e.dataTransfer.effectAllowed = 'move';
          el.classList.add('dragging');
          for (const [, p] of paneManager.panes)
            p.tabBar.classList.add('visible');
        });
        el.addEventListener('dragend', () => {
          el.classList.remove('dragging');
          for (const [, p] of paneManager.panes)
            p.renderTabBar();
        });

        this.tabBar.appendChild(el);
      }

      const newBtn = document.createElement('button');
      newBtn.className = 'tab-new';
      newBtn.textContent = '+';
      newBtn.title = 'New Tab (Ctrl+T)';
      newBtn.addEventListener('click', () => self.createTab(self.currentPath));
      this.tabBar.appendChild(newBtn);
    }

    createTab(path) {
      this.saveTabState();
      const tab = this._createTabState(path || this.currentPath);
      this.tabs.push(tab);
      this.activeTabId = tab.id;
      this.loadTabState(tab.id);
      this.renderTabBar();
      this.render();
    }

    closeTab(tabId) {
      if (this.tabs.length <= 1) {
        // Close pane instead
        paneManager.closePane(this.id);
        return;
      }
      const idx = this.tabs.findIndex(t => t.id === tabId);
      if (idx < 0) return;
      this.tabs.splice(idx, 1);
      if (this.activeTabId === tabId) {
        const newIdx = Math.min(idx, this.tabs.length - 1);
        this.activeTabId = this.tabs[newIdx].id;
        this.loadTabState(this.activeTabId);
        this.renderTabBar();
        this.render();
      } else
        this.renderTabBar();
    }

    switchTab(tabId) {
      if (tabId === this.activeTabId) return;
      this.saveTabState();
      this.activeTabId = tabId;
      this.loadTabState(tabId);
      this.renderTabBar();
      this.render();
      this.mainView.scrollTop = this.tabs.find(t => t.id === tabId)?.scrollPosition || 0;
    }

    _updateTabLabel() {
      const tab = this.tabs.find(t => t.id === this.activeTabId);
      if (tab) tab.path = this.currentPath;
      this.renderTabBar();
    }

    _acceptTabDrop(data) {
      const { tabId, sourcePaneId, tabState } = data;
      const sourcePane = paneManager.panes.get(sourcePaneId);

      // Same pane — reorder
      if (sourcePaneId === this.id) {
        const fromIdx = this.tabs.findIndex(t => t.id === tabId);
        if (fromIdx < 0) return;
        const [moved] = this.tabs.splice(fromIdx, 1);
        this.tabs.push(moved);
        this.renderTabBar();
        return;
      }

      // Different pane — transfer
      if (!sourcePane) return;
      sourcePane.saveTabState();
      const freshState = sourcePane.tabs.find(t => t.id === tabId);
      const state = freshState || tabState;

      // Remove from source pane
      const srcIdx = sourcePane.tabs.findIndex(t => t.id === tabId);
      if (srcIdx < 0) return;
      sourcePane.tabs.splice(srcIdx, 1);

      if (sourcePane.tabs.length === 0) {
        paneManager.closePane(sourcePaneId);
      } else {
        if (sourcePane.activeTabId === tabId) {
          const newIdx = Math.min(srcIdx, sourcePane.tabs.length - 1);
          sourcePane.activeTabId = sourcePane.tabs[newIdx].id;
          sourcePane.loadTabState(sourcePane.activeTabId);
          sourcePane.render();
        }
        sourcePane.renderTabBar();
      }

      // Add to this pane with a new local ID
      const newTab = { ...state, id: this._nextTabId++ };
      this.saveTabState();
      this.tabs.push(newTab);
      this.activeTabId = newTab.id;
      this.loadTabState(newTab.id);
      this.renderTabBar();
      this.render();
      paneManager.focusPane(this.id);
    }

    // -----------------------------------------------------------------------
    // Type-ahead selection
    // -----------------------------------------------------------------------
    handleTypeAhead(char) {
      this._typeAheadBuffer += char.toLowerCase();
      clearTimeout(this._typeAheadTimer);
      this._typeAheadTimer = setTimeout(() => { this._typeAheadBuffer = ''; }, 500);

      const prefix = this._typeAheadBuffer;
      const elements = this._getVisibleEntryElements();
      for (let i = 0; i < this.currentEntries.length && i < elements.length; ++i) {
        if (this.currentEntries[i].name.toLowerCase().startsWith(prefix)) {
          this.selectItem(i, elements[i], this.currentEntries[i], { ctrl: false, shift: false });
          elements[i].scrollIntoView({ block: 'nearest' });
          return;
        }
      }
    }
  }

  // =========================================================================
  // PaneManager
  // =========================================================================
  class PaneManager {
    constructor() {
      this.rootEl = paneRoot;
      this.root = null;
      this.panes = new Map();
      this.activePaneId = null;
      this._nextPaneId = 1;
    }

    init(path) {
      const pane = this._createPane(path);
      this.root = { type: 'leaf', paneId: pane.id };
      this.activePaneId = pane.id;
      this.renderLayout();
      pane.render();
    }

    _createPane(path) {
      const id = this._nextPaneId++;
      const pane = new Pane(id, path);
      this.panes.set(id, pane);
      return pane;
    }

    getActive() {
      return this.panes.get(this.activePaneId) || null;
    }

    focusPane(id) {
      if (this.activePaneId === id) return;
      const oldPane = this.panes.get(this.activePaneId);
      if (oldPane && oldPane.el) oldPane.el.classList.remove('focused');

      this.activePaneId = id;
      const newPane = this.panes.get(id);
      if (newPane && newPane.el) newPane.el.classList.add('focused');

      // Update shared UI to reflect new active pane
      updateRibbonState();
      updateViewModeButtons();
      updateSortButtons();
      updatePreviewButton();
      if (newPane) newPane.updateStatusBar();
    }

    splitRight(paneId) {
      this._split(paneId, 'horizontal');
    }

    splitBottom(paneId) {
      this._split(paneId, 'vertical');
    }

    _split(paneId, direction) {
      const pane = this.panes.get(paneId);
      if (!pane) return;
      const newPane = this._createPane(pane.currentPath);

      const leafNode = this._findNodeByPaneId(this.root, paneId);
      if (!leafNode) return;

      // Replace the leaf with a split
      const splitNode = {
        type: 'split',
        direction,
        ratio: 0.5,
        children: [
          { type: 'leaf', paneId },
          { type: 'leaf', paneId: newPane.id },
        ],
      };

      this._replaceNode(leafNode, splitNode);
      this.renderLayout();
      newPane.render();
      this.focusPane(newPane.id);
    }

    closePane(paneId) {
      if (this.panes.size <= 1) {
        User32.PostMessage('sz:closeWindow');
        return;
      }

      const parentInfo = this._findParentNode(this.root, null, paneId);
      if (!parentInfo) return;
      const { parent, childIndex } = parentInfo;

      const sibling = parent.children[1 - childIndex];

      // Replace parent with sibling
      this._replaceNode(parent, sibling);

      this.panes.delete(paneId);

      if (this.activePaneId === paneId) {
        // Focus first remaining pane
        const firstPane = this.panes.values().next().value;
        if (firstPane) this.activePaneId = firstPane.id;
      }

      this.renderLayout();
      const active = this.getActive();
      if (active) {
        active.el.classList.add('focused');
        active.updateStatusBar();
      }
    }

    _findNodeByPaneId(node, paneId) {
      if (!node) return null;
      if (node.type === 'leaf' && node.paneId === paneId) return node;
      if (node.type === 'split') {
        for (const child of node.children) {
          const found = this._findNodeByPaneId(child, paneId);
          if (found) return found;
        }
      }
      return null;
    }

    _findParentNode(node, parent, paneId) {
      if (!node) return null;
      if (node.type === 'leaf' && node.paneId === paneId && parent) {
        const childIndex = parent.children.indexOf(node);
        return { parent, childIndex };
      }
      if (node.type === 'split') {
        for (const child of node.children) {
          const found = this._findParentNode(child, node, paneId);
          if (found) return found;
        }
      }
      return null;
    }

    _replaceNode(target, replacement) {
      if (target === this.root) {
        Object.assign(this.root, replacement);
        // Clean up any extra keys from old node
        for (const key of Object.keys(this.root)) {
          if (!(key in replacement)) delete this.root[key];
        }
        return;
      }
      // Find parent and replace
      const _replace = (node) => {
        if (node.type !== 'split') return false;
        for (let i = 0; i < node.children.length; ++i) {
          if (node.children[i] === target) {
            node.children[i] = replacement;
            return true;
          }
          if (_replace(node.children[i])) return true;
        }
        return false;
      };
      _replace(this.root);
    }

    renderLayout() {
      this.rootEl.innerHTML = '';
      const dom = this._buildDom(this.root);
      if (dom) this.rootEl.appendChild(dom);

      // Ensure focused pane is marked
      for (const [id, pane] of this.panes)
        pane.el.classList.toggle('focused', id === this.activePaneId);
    }

    _buildDom(node) {
      if (!node) return null;
      if (node.type === 'leaf') {
        const pane = this.panes.get(node.paneId);
        if (!pane) return null;
        return pane.el;
      }
      if (node.type === 'split') {
        const container = document.createElement('div');
        container.className = 'split-container ' + node.direction;

        const child0 = document.createElement('div');
        child0.className = 'split-child';
        child0.style.flex = String(node.ratio);
        const dom0 = this._buildDom(node.children[0]);
        if (dom0) child0.appendChild(dom0);
        container.appendChild(child0);

        const splitter = document.createElement('div');
        splitter.className = 'pane-splitter ' + node.direction;
        this._initSplitterDrag(splitter, node, child0, container);
        container.appendChild(splitter);

        const child1 = document.createElement('div');
        child1.className = 'split-child';
        child1.style.flex = String(1 - node.ratio);
        const dom1 = this._buildDom(node.children[1]);
        if (dom1) child1.appendChild(dom1);
        container.appendChild(child1);

        return container;
      }
      return null;
    }

    _initSplitterDrag(splitterEl, splitNode, child0El, containerEl) {
      const self = this;
      splitterEl.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        splitterEl.setPointerCapture(e.pointerId);
        const isHorizontal = splitNode.direction === 'horizontal';

        const onMove = (ev) => {
          const rect = containerEl.getBoundingClientRect();
          const total = isHorizontal ? rect.width : rect.height;
          const pos = isHorizontal ? (ev.clientX - rect.left) : (ev.clientY - rect.top);
          const ratio = Math.max(0.1, Math.min(0.9, pos / total));
          splitNode.ratio = ratio;
          child0El.style.flex = String(ratio);
          const sibling = containerEl.querySelector('.split-child:last-child');
          if (sibling) sibling.style.flex = String(1 - ratio);
        };

        const onUp = () => {
          splitterEl.removeEventListener('pointermove', onMove);
          splitterEl.removeEventListener('pointerup', onUp);
        };

        splitterEl.addEventListener('pointermove', onMove);
        splitterEl.addEventListener('pointerup', onUp);
      });
    }

    // Save/Load layout
    saveLayout() {
      const serialize = (node) => {
        if (node.type === 'leaf') {
          const pane = this.panes.get(node.paneId);
          return { type: 'leaf', path: pane ? pane.currentPath : '/', viewMode: pane ? pane.viewMode : 'icons' };
        }
        if (node.type === 'split') {
          return {
            type: 'split',
            direction: node.direction,
            ratio: node.ratio,
            children: node.children.map(c => serialize(c)),
          };
        }
        return null;
      };
      const data = serialize(this.root);
      try { Advapi32.RegSetValue('explorer.layout', JSON.stringify(data)); } catch {}
    }

    loadLayout() {
      try {
        const raw = Advapi32.RegGetValue('explorer.layout');
        if (!raw) return false;
        const data = JSON.parse(raw);
        return this._deserializeLayout(data);
      } catch { return false; }
    }

    _deserializeLayout(data) {
      if (!data) return false;

      // Clear existing panes
      this.panes.clear();
      this._nextPaneId = 1;

      const build = (node) => {
        if (node.type === 'leaf') {
          const pane = this._createPane(node.path || '/');
          if (node.viewMode) pane.viewMode = node.viewMode;
          return { type: 'leaf', paneId: pane.id };
        }
        if (node.type === 'split') {
          return {
            type: 'split',
            direction: node.direction || 'horizontal',
            ratio: node.ratio || 0.5,
            children: (node.children || []).map(c => build(c)),
          };
        }
        return null;
      };

      this.root = build(data);
      if (!this.root) return false;

      // Focus first pane
      const firstId = this.panes.keys().next().value;
      this.activePaneId = firstId;

      this.renderLayout();

      // Render all panes
      for (const [, pane] of this.panes)
        pane.render();

      return true;
    }
  }

  const paneManager = new PaneManager();

  // =========================================================================
  // Sidebar tree + sections
  // =========================================================================
  const treeNodeMap = new Map();

  function buildSidebar() {
    sidebarSections.innerHTML = '';
    treeNodeMap.clear();

    // 1. Recents
    if (recentPaths.length > 0) {
      const section = _createSidebarSection('Recents', ICONS.clock);
      const list = section.content;
      const visibleRecents = recentPaths.slice(0, 10);
      for (const rPath of visibleRecents) {
        const item = document.createElement('div');
        item.className = 'sidebar-item';
        item.dataset.filterText = (baseName(rPath) || 'Root').toLowerCase();
        const icon = document.createElement('span');
        icon.className = 'sidebar-item-icon';
        icon.innerHTML = ICONS.vfsFolder;
        item.appendChild(icon);
        const label = document.createElement('span');
        label.textContent = baseName(rPath) || 'Root';
        item.appendChild(label);
        item.addEventListener('click', () => {
          const pane = paneManager.getActive();
          if (pane) pane.navigate(rPath);
        });
        list.appendChild(item);
      }
      sidebarSections.appendChild(section.container);
    }

    // 2. Bookmarks
    if (bookmarkPaths.length > 0) {
      const section = _createSidebarSection('Bookmarks', ICONS.bookmark);
      const list = section.content;
      for (const bPath of bookmarkPaths) {
        const item = document.createElement('div');
        item.className = 'sidebar-item';
        item.dataset.filterText = (baseName(bPath) || 'Root').toLowerCase();
        const icon = document.createElement('span');
        icon.className = 'sidebar-item-icon';
        icon.innerHTML = ICONS.bookmark;
        item.appendChild(icon);
        const label = document.createElement('span');
        label.textContent = baseName(bPath) || 'Root';
        item.appendChild(label);
        item.addEventListener('click', () => {
          const pane = paneManager.getActive();
          if (pane) pane.navigate(bPath);
        });
        item.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const menu = createContextMenuEl(e.clientX, e.clientY);
          addCtxItem(menu, 'Remove', () => {
            bookmarkPaths = bookmarkPaths.filter(p => p !== bPath);
            saveBookmarks();
            buildSidebar();
          }, false, ICONS.ctxRemove);
        });
        list.appendChild(item);
      }
      sidebarSections.appendChild(section.container);
    }

    // 3. Quick Access
    if (quickAccessPaths.length > 0) {
      const section = _createSidebarSection('Quick Access', ICONS.pin);
      const list = section.content;
      for (const qPath of quickAccessPaths) {
        const item = document.createElement('div');
        item.className = 'sidebar-item quick-access-item';
        item.dataset.filterText = (baseName(qPath) || 'Root').toLowerCase();
        const icon = document.createElement('span');
        icon.className = 'sidebar-item-icon';
        icon.innerHTML = ICONS.pin;
        item.appendChild(icon);
        const label = document.createElement('span');
        label.textContent = baseName(qPath) || 'Root';
        item.appendChild(label);
        item.addEventListener('click', () => {
          const pane = paneManager.getActive();
          if (pane) pane.navigate(qPath);
        });
        item.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const menu = createContextMenuEl(e.clientX, e.clientY);
          addCtxItem(menu, 'Unpin', () => {
            quickAccessPaths = quickAccessPaths.filter(p => p !== qPath);
            saveQuickAccess();
            buildSidebar();
          }, false, ICONS.ctxUnpin);
        });
        list.appendChild(item);
      }
      sidebarSections.appendChild(section.container);
    }

    // 4. Storage
    {
      const section = _createSidebarSection('Storage', ICONS.storage);
      const list = section.content;
      const item = document.createElement('div');
      item.className = 'sidebar-item';
      item.dataset.filterText = 'vfs storage';
      const icon = document.createElement('span');
      icon.className = 'sidebar-item-icon';
      icon.innerHTML = ICONS.vfsDrive;
      item.appendChild(icon);
      const info = document.createElement('div');
      info.style.display = 'flex';
      info.style.flexDirection = 'column';
      info.style.flex = '1';
      info.style.minWidth = '0';
      const label = document.createElement('span');
      label.textContent = '/vfs';
      info.appendChild(label);

      // Usage bar
      let usedBytes = 0;
      try {
        for (let i = 0; i < localStorage.length; ++i) {
          const key = localStorage.key(i);
          if (key) usedBytes += (localStorage.getItem(key) || '').length * 2;
        }
      } catch {}
      const barOuter = document.createElement('div');
      barOuter.style.cssText = 'height:4px;background:#e5e7eb;border-radius:2px;margin-top:2px;';
      const barInner = document.createElement('div');
      const totalStorage = 5 * 1024 * 1024; // ~5MB typical
      const pct = Math.min(100, (usedBytes / totalStorage) * 100);
      barInner.style.cssText = 'height:100%;border-radius:2px;background:' + (pct > 80 ? '#ef4444' : '#3b82f6') + ';width:' + pct + '%';
      barOuter.appendChild(barInner);
      info.appendChild(barOuter);

      const usageLabel = document.createElement('span');
      usageLabel.style.fontSize = '9px';
      usageLabel.style.color = 'var(--sz-color-gray-text)';
      usageLabel.textContent = formatSize(usedBytes) + ' used';
      info.appendChild(usageLabel);

      item.appendChild(info);
      item.addEventListener('click', () => {
        const pane = paneManager.getActive();
        if (pane) pane.navigate('/vfs');
      });
      list.appendChild(item);
      sidebarSections.appendChild(section.container);
    }

    // 5. Places
    {
      const places = [
        { path: '/vfs', label: 'VFS Root' },
        { path: '/vfs/user/documents', label: 'Documents' },
        { path: '/vfs/user/desktop', label: 'Desktop' },
        { path: '/vfs/user/downloads', label: 'Downloads' },
        { path: '/vfs/user/music', label: 'Music' },
        { path: '/vfs/user/pictures', label: 'Pictures' },
        { path: '/vfs/user/videos', label: 'Videos' },
      ];
      const section = _createSidebarSection('Places', ICONS.places);
      const list = section.content;
      for (const place of places) {
        const item = document.createElement('div');
        item.className = 'sidebar-item';
        item.dataset.filterText = place.label.toLowerCase();
        const icon = document.createElement('span');
        icon.className = 'sidebar-item-icon';
        icon.innerHTML = ICONS.vfsFolder;
        item.appendChild(icon);
        const label = document.createElement('span');
        label.textContent = place.label;
        item.appendChild(label);
        item.addEventListener('click', () => {
          const pane = paneManager.getActive();
          if (pane) pane.navigate(place.path);
        });
        list.appendChild(item);
      }
      sidebarSections.appendChild(section.container);
    }

    // 6. Tree
    {
      const section = _createSidebarSection('Tree', ICONS.root, true);
      const list = section.content;
      const rootNode = createTreeNode('/', '\u00BBSynthelicZ\u00AB', 0, 'root');
      list.appendChild(rootNode.container);
      rootNode.expand();
      sidebarSections.appendChild(section.container);
    }
  }

  function _createSidebarSection(title, iconSvg, expandedByDefault) {
    const container = document.createElement('div');
    container.className = 'sidebar-section';
    const header = document.createElement('div');
    header.className = 'sidebar-section-header';
    let expanded = expandedByDefault !== false;

    const toggle = document.createElement('span');
    toggle.className = 'section-toggle';
    toggle.textContent = expanded ? '\u25BC' : '\u25B6';
    header.appendChild(toggle);

    if (iconSvg) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'section-icon';
      iconSpan.innerHTML = iconSvg;
      header.appendChild(iconSpan);
    }

    const label = document.createElement('span');
    label.textContent = title;
    header.appendChild(label);

    container.appendChild(header);

    const content = document.createElement('div');
    content.className = 'sidebar-section-content';
    content.style.display = expanded ? '' : 'none';
    container.appendChild(content);

    header.addEventListener('click', () => {
      expanded = !expanded;
      toggle.textContent = expanded ? '\u25BC' : '\u25B6';
      content.style.display = expanded ? '' : 'none';
    });

    return { container, content };
  }

  // Sidebar filter
  if (sidebarFilter) {
    sidebarFilter.addEventListener('input', () => {
      const query = sidebarFilter.value.trim().toLowerCase();
      const items = sidebarSections.querySelectorAll('.sidebar-item');
      for (const item of items) {
        const text = item.dataset.filterText || item.textContent.toLowerCase();
        item.style.display = !query || text.includes(query) ? '' : 'none';
      }
      // Also filter tree nodes
      const treeNodes = sidebarSections.querySelectorAll('.tree-node');
      for (const node of treeNodes) {
        const label = node.querySelector('.tree-label');
        const text = label ? label.textContent.toLowerCase() : '';
        node.style.display = !query || text.includes(query) ? '' : 'none';
      }
    });
  }

  function createTreeNode(path, label, depth, nodeType) {
    const container = document.createElement('div');
    const row = document.createElement('div');
    row.className = 'tree-node';
    row.style.paddingLeft = (4 + depth * 16) + 'px';
    row.dataset.path = path;

    const toggle = document.createElement('span');
    toggle.className = 'tree-toggle has-children';
    toggle.textContent = '\u25B6';
    row.appendChild(toggle);

    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.innerHTML = treeIcon(nodeType, false);
    row.appendChild(icon);

    const lbl = document.createElement('span');
    lbl.className = 'tree-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    container.appendChild(row);

    const childContainer = document.createElement('div');
    childContainer.className = 'tree-children';
    container.appendChild(childContainer);

    let expanded = false;
    let loaded = false;
    let actualType = nodeType;

    const api = {
      container,
      expand() {
        if (!loaded) {
          loaded = true;
          const loadingEl = document.createElement('div');
          loadingEl.className = 'tree-loading';
          loadingEl.textContent = 'Loading\u2026';
          childContainer.appendChild(loadingEl);

          const isVfs = isVfsPath(path);
          const loadPromise = isVfs
            ? vfsList(toVfsRelative(path)).then((result) => {
              childContainer.innerHTML = '';
              const dirs = (result.entries || []).filter(e => e.type === 'dir');
              if (dirs.length === 0) { toggle.classList.remove('has-children'); toggle.textContent = ''; }
              for (const dir of dirs) {
                const cp = childPath(path, dir.name);
                const isMount = cp.match(/^\/vfs\/mount\/[^/]+$/);
                const child = createTreeNode(cp, dir.name, depth + 1, isMount ? 'vfsDrive' : 'vfsFolder');
                childContainer.appendChild(child.container);
              }
            })
            : browse(path).then((result) => {
              childContainer.innerHTML = '';
              actualType = result.nodeType || actualType;
              const containers = (result.entries || []).filter(e => e.isContainer && e.childCount > 0);
              if (containers.length === 0) { toggle.classList.remove('has-children'); toggle.textContent = ''; }
              for (const entry of containers) {
                const cp = childPath(path, entry.name);
                const child = createTreeNode(cp, entry.name, depth + 1, entry.type);
                childContainer.appendChild(child.container);
              }
            });

          loadPromise.catch(() => {
            childContainer.innerHTML = '';
            toggle.classList.remove('has-children');
            toggle.textContent = '';
          });
        }
        expanded = true;
        childContainer.classList.add('expanded');
        toggle.textContent = '\u25BC';
        icon.innerHTML = treeIcon(actualType, true);
      },
      collapse() {
        expanded = false;
        childContainer.classList.remove('expanded');
        toggle.textContent = '\u25B6';
        icon.innerHTML = treeIcon(actualType, false);
      },
      refresh() {
        loaded = false;
        childContainer.innerHTML = '';
        if (expanded) api.expand();
      },
    };

    treeNodeMap.set(path, api);

    row.addEventListener('click', (e) => {
      e.stopPropagation();
      const pane = paneManager.getActive();
      if (pane) pane.navigate(path);
    });
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (expanded) api.collapse();
      else api.expand();
    });

    return api;
  }

  function highlightSidebar(path) {
    const nodes = sidebarSections.querySelectorAll('.tree-node');
    for (const el of nodes)
      el.classList.toggle('selected', el.dataset.path === path);
    for (const el of sidebarSections.querySelectorAll('.sidebar-item'))
      el.classList.remove('selected');
  }

  // =========================================================================
  // Ribbon state management
  // =========================================================================
  function updateRibbonState() {
    const pane = paneManager.getActive();
    if (!pane) return;

    const hasSelection = pane.selectedItems.length > 0;
    const canModify = pane.isVfsMode;

    setRibbonBtnDisabled('back', pane.backStack.length === 0);
    setRibbonBtnDisabled('forward', pane.forwardStack.length === 0);
    setRibbonBtnDisabled('up', pane.currentPath === '/');

    setRibbonBtnDisabled('paste', !clipboard || !canModify);
    setRibbonBtnDisabled('cut', !canModify || !hasSelection);
    setRibbonBtnDisabled('copy', !hasSelection);
    setRibbonBtnDisabled('delete', !canModify || !hasSelection);
    setRibbonBtnDisabled('rename', !canModify || pane.selectedItems.length !== 1);
    setRibbonBtnDisabled('bulk-rename', !canModify || pane.selectedItems.length < 2);
    setRibbonBtnDisabled('new-folder', !canModify);
    setRibbonBtnDisabled('new-file', !canModify);
    setRibbonBtnDisabled('upload', !canModify);
    setRibbonBtnDisabled('download', !canModify || !hasSelection || pane.selectedItems.some(s => s.isDir));
    setRibbonBtnDisabled('new-folder-with-selection', !canModify || pane.selectedItems.length < 2);
    setRibbonBtnDisabled('copy-path', !hasSelection);

    const unmountBtn = document.querySelector('.backstage-item[data-action="unmount"]');
    if (unmountBtn) {
      const selectedIsMountRoot = pane.selectedItems.length === 1 && isMountRoot(pane.selectedItems[0].path);
      unmountBtn.disabled = !isMountRoot(pane.currentPath) && !selectedIsMountRoot;
    }

    updateViewModeButtons();
    updateSortButtons();
  }

  function setRibbonBtnDisabled(action, disabled) {
    const qatBtn = document.querySelector('.qat-btn[data-action="' + action + '"]');
    if (qatBtn) qatBtn.disabled = disabled;
    const rbBtn = document.querySelector('.rb-btn[data-action="' + action + '"]');
    if (rbBtn) rbBtn.disabled = disabled;
  }

  function updateViewModeButtons() {
    const pane = paneManager.getActive();
    if (!pane) return;
    document.querySelectorAll('[data-action^="view-"]').forEach(btn => {
      const mode = btn.dataset.action.replace('view-', '');
      btn.classList.toggle('active', mode === pane.viewMode);
    });
    if (statusViewMode) statusViewMode.textContent = pane.viewMode.charAt(0).toUpperCase() + pane.viewMode.slice(1);
  }

  function updateSortButtons() {
    const pane = paneManager.getActive();
    if (!pane) return;
    const viewPanel = document.getElementById('ribbon-view');
    if (!viewPanel) return;
    viewPanel.querySelectorAll('[data-action^="sort-"]').forEach(btn => {
      const f = btn.dataset.action.replace('sort-', '');
      btn.classList.toggle('active', f === pane.sortField);
      const arrow = btn.querySelector('.rb-icon');
      if (arrow && f === pane.sortField)
        arrow.textContent = pane.sortAscending ? '\u25B4' : '\u25BE';
      else if (arrow)
        arrow.textContent = '\u25B4';
    });
  }

  function updatePreviewButton() {
    const pane = paneManager.getActive();
    if (!pane) return;
    const btn = document.querySelector('[data-action="toggle-preview"]');
    if (btn) btn.classList.toggle('active', pane.previewPaneVisible);
  }

  // =========================================================================
  // Ribbon event delegation + backstage
  // =========================================================================
  function setViewMode(mode) {
    const pane = paneManager.getActive();
    if (!pane) return;
    pane.viewMode = mode;
    try { Advapi32.RegSetValue('explorer.viewMode', mode); } catch {}
    updateViewModeButtons();
    if (pane.isVfsMode) pane.renderVfsView();
  }

  function toggleNavPane() {
    navPaneVisible = !navPaneVisible;
    sidebar.classList.toggle('hidden', !navPaneVisible);
    try { Advapi32.RegSetValue('explorer.navPane', navPaneVisible ? '1' : '0'); } catch {}
    const btn = document.querySelector('[data-action="toggle-nav"]');
    if (btn) btn.classList.toggle('active', navPaneVisible);
  }

  const ribbonActions = {
    back: () => { const p = paneManager.getActive(); if (p) p.goBack(); },
    forward: () => { const p = paneManager.getActive(); if (p) p.goForward(); },
    up: () => { const p = paneManager.getActive(); if (p && p.currentPath !== '/') p.navigate(parentPath(p.currentPath)); },
    refresh: () => { const p = paneManager.getActive(); if (p) p.doRefresh(); },
    paste: () => { const p = paneManager.getActive(); if (p) p.doPaste(); },
    cut: () => { const p = paneManager.getActive(); if (p) p.doClipboardCut(); },
    copy: () => { const p = paneManager.getActive(); if (p) p.doClipboardCopy(); },
    delete: () => { const p = paneManager.getActive(); if (p) p.doDelete(); },
    rename: () => { const p = paneManager.getActive(); if (p) p.beginRename(); },
    'bulk-rename': () => showBulkRenameDialog(),
    'new-folder': () => { const p = paneManager.getActive(); if (p) p.doNewFolder(); },
    'new-file': () => { const p = paneManager.getActive(); if (p) p.doNewTextDocument(); },
    'new-folder-with-selection': () => { const p = paneManager.getActive(); if (p) p.doNewFolderWithSelection(); },
    'copy-path': () => {
      const p = paneManager.getActive();
      if (p && p.selectedItems.length > 0) {
        const paths = p.selectedItems.map(s => isVfsPath(s.path) ? toVfsRelative(s.path) : s.path);
        try { navigator.clipboard.writeText(paths.join('\n')); } catch {}
      }
    },
    upload: () => { const p = paneManager.getActive(); if (p) p.doUpload(); },
    download: () => { const p = paneManager.getActive(); if (p) p.doDownload(); },
    'select-all': () => { const p = paneManager.getActive(); if (p) p.selectAll(); },
    'select-none': () => { const p = paneManager.getActive(); if (p) p.clearSelection(); },
    'invert-selection': () => { const p = paneManager.getActive(); if (p) p.invertSelection(); },
    'view-icons': () => setViewMode('icons'),
    'view-details': () => setViewMode('details'),
    'view-tiles': () => setViewMode('tiles'),
    'toggle-preview': () => { const p = paneManager.getActive(); if (p) p.togglePreviewPane(); },
    'toggle-nav': toggleNavPane,
    'expand-folder': () => { const p = paneManager.getActive(); if (p) p.toggleExpandedMode(); },
    'split-right': () => { const p = paneManager.getActive(); if (p) paneManager.splitRight(p.id); },
    'split-bottom': () => { const p = paneManager.getActive(); if (p) paneManager.splitBottom(p.id); },
    'close-pane': () => { const p = paneManager.getActive(); if (p) paneManager.closePane(p.id); },
    'zoom-in': () => {
      const p = paneManager.getActive();
      if (p) {
        const levels = ['small', 'medium', 'large', 'xlarge'];
        const idx = levels.indexOf(p.iconZoom);
        if (idx < levels.length - 1) { p.iconZoom = levels[idx + 1]; applyIconZoom(p.iconZoom); }
      }
    },
    'zoom-out': () => {
      const p = paneManager.getActive();
      if (p) {
        const levels = ['small', 'medium', 'large', 'xlarge'];
        const idx = levels.indexOf(p.iconZoom);
        if (idx > 0) { p.iconZoom = levels[idx - 1]; applyIconZoom(p.iconZoom); }
      }
    },
    'sort-name': () => { const p = paneManager.getActive(); if (p) { p.setSortField('name'); if (p.isVfsMode) p.renderVfsView(); } },
    'sort-size': () => { const p = paneManager.getActive(); if (p) { p.setSortField('size'); if (p.isVfsMode) p.renderVfsView(); } },
    'sort-type': () => { const p = paneManager.getActive(); if (p) { p.setSortField('type'); if (p.isVfsMode) p.renderVfsView(); } },
    'sort-date': () => { const p = paneManager.getActive(); if (p) { p.setSortField('date'); if (p.isVfsMode) p.renderVfsView(); } },
    'toggle-hidden': () => {
      const p = paneManager.getActive();
      if (p) { p.showHiddenFiles = !p.showHiddenFiles; p.render(); }
      const btn = document.querySelector('[data-action="toggle-hidden"]');
      if (btn && p) btn.classList.toggle('active', p.showHiddenFiles);
    },
    'toggle-extensions': () => {
      const p = paneManager.getActive();
      if (p) { p.showExtensions = !p.showExtensions; p.renderVfsView(); }
      const btn = document.querySelector('[data-action="toggle-extensions"]');
      if (btn && p) btn.classList.toggle('active', !p.showExtensions);
    },
    'toggle-highlight-recents': () => {
      const p = paneManager.getActive();
      if (p) { p.highlightRecents = !p.highlightRecents; p.renderVfsView(); }
      const btn = document.querySelector('[data-action="toggle-highlight-recents"]');
      if (btn && p) btn.classList.toggle('active', p.highlightRecents);
    },
    'new-window': () => {
      const p = paneManager.getActive();
      Shell32.ShellExecute('explorer', { path: p ? p.currentPath : '/' });
    },
    mount: async () => {
      try {
        const result = await Kernel32.MountLocalDirectory();
        if (result.cancelled) return;
        const p = paneManager.getActive();
        if (result.success && p) p.navigate('/vfs/mount/' + result.name);
      } catch (err) { showAlert('Mount failed: ' + err.message); }
    },
    unmount: () => { const p = paneManager.getActive(); if (p) p.doUnmount(); },
    'save-layout': () => { paneManager.saveLayout(); showAlert('Layout saved.'); },
    'load-layout': () => {
      if (paneManager.loadLayout())
        showAlert('Layout loaded.');
      else
        showAlert('No saved layout found.');
    },
    options: () => showOptionsDialog(),
    about: () => { const dlg = document.getElementById('dlg-about'); if (dlg) dlg.classList.add('visible'); },
    exit: () => User32.PostMessage('sz:closeWindow'),
  };

  function applyIconZoom(zoom) {
    const sizes = { small: '32px', medium: '48px', large: '64px', xlarge: '96px' };
    document.documentElement.style.setProperty('--icon-size', sizes[zoom] || '48px');
  }

  // Event delegation for ribbon panels and QAT
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action && ribbonActions[action]) {
      e.stopPropagation();
      const backstage = document.getElementById('backstage');
      if (backstage && backstage.contains(btn))
        backstage.classList.remove('visible');
      ribbonActions[action]();
    }
  });

  // Ribbon tab switching
  document.querySelector('.ribbon-tab-bar')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.ribbon-tab');
    if (!tab) return;
    const tabName = tab.dataset.tab;
    document.querySelectorAll('.ribbon-tab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.ribbon-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tabName));
  });

  // Backstage
  document.getElementById('ribbon-file-btn')?.addEventListener('click', () => {
    document.getElementById('backstage')?.classList.add('visible');
  });
  document.getElementById('backstage-back')?.addEventListener('click', () => {
    document.getElementById('backstage')?.classList.remove('visible');
  });
  document.getElementById('backstage')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('backstage'))
      document.getElementById('backstage').classList.remove('visible');
  });

  // =========================================================================
  // View filter buttons
  // =========================================================================
  document.getElementById('view-filter-group')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.vf-btn');
    if (!btn) return;
    const vf = btn.dataset.vf;
    const pane = paneManager.getActive();
    if (!pane) return;

    if (vf === 'all' || vf === 'files' || vf === 'folders') {
      pane.filterMode = vf;
      document.querySelectorAll('.vf-btn[data-vf="all"],.vf-btn[data-vf="files"],.vf-btn[data-vf="folders"]').forEach(b => {
        b.classList.toggle('active', b.dataset.vf === vf);
      });
      pane.renderVfsView();
    } else if (vf === 'folders-first') {
      pane.foldersFirst = !pane.foldersFirst;
      btn.classList.toggle('active', pane.foldersFirst);
      pane.sortEntries();
      pane.renderVfsView();
    }
  });

  // =========================================================================
  // Upload handler (shared, dispatches to active pane)
  // =========================================================================
  uploadInput.addEventListener('change', async () => {
    const files = uploadInput.files;
    if (!files || files.length === 0) return;
    const pane = paneManager.getActive();
    if (!pane || !pane.isVfsMode) return;
    const vfsDir = toVfsRelative(pane.currentPath);
    for (let i = 0; i < files.length; ++i) {
      const file = files[i];
      try {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const filePath = (vfsDir === '/' ? '/' : vfsDir + '/') + file.name;
        const result = await vfsWrite(filePath, arrayBuffer);
        if (result.error) showAlert('Could not upload "' + file.name + '": ' + result.error);
      } catch (err) {
        showAlert('Failed to read "' + file.name + '": ' + err.message);
      }
    }
    uploadInput.value = '';
    pane.clearSelection();
    await pane.doRefresh();
  });

  // =========================================================================
  // Command Palette (Ctrl+Shift+P)
  // =========================================================================
  const _commands = [];

  function registerCommand(name, shortcutLabel, callback) {
    _commands.push({ name, shortcutLabel, callback });
  }

  function _initCommands() {
    registerCommand('Go Back', 'Alt+Left', () => ribbonActions.back());
    registerCommand('Go Forward', 'Alt+Right', () => ribbonActions.forward());
    registerCommand('Go Up', 'Alt+Up / Backspace', () => ribbonActions.up());
    registerCommand('Refresh', 'F5', () => ribbonActions.refresh());
    registerCommand('Paste', 'Ctrl+V', () => ribbonActions.paste());
    registerCommand('Cut', 'Ctrl+X', () => ribbonActions.cut());
    registerCommand('Copy', 'Ctrl+C', () => ribbonActions.copy());
    registerCommand('Delete', 'Delete', () => ribbonActions['delete']());
    registerCommand('Rename', 'F2', () => ribbonActions.rename());
    registerCommand('Bulk Rename', '', () => showBulkRenameDialog());
    registerCommand('New Folder', '', () => ribbonActions['new-folder']());
    registerCommand('New File', '', () => ribbonActions['new-file']());
    registerCommand('Upload', '', () => ribbonActions.upload());
    registerCommand('Download', '', () => ribbonActions.download());
    registerCommand('Select All', 'Ctrl+A', () => ribbonActions['select-all']());
    registerCommand('Select None', '', () => ribbonActions['select-none']());
    registerCommand('Invert Selection', '', () => ribbonActions['invert-selection']());
    registerCommand('View: Icons', '', () => setViewMode('icons'));
    registerCommand('View: Details', '', () => setViewMode('details'));
    registerCommand('View: Tiles', '', () => setViewMode('tiles'));
    registerCommand('Toggle Preview Pane', 'Space', () => ribbonActions['toggle-preview']());
    registerCommand('Toggle Navigation Pane', '', () => ribbonActions['toggle-nav']());
    registerCommand('Expand Folder', 'Ctrl+E', () => ribbonActions['expand-folder']());
    registerCommand('Split Right', 'Ctrl+Shift+S', () => ribbonActions['split-right']());
    registerCommand('Split Bottom', '', () => ribbonActions['split-bottom']());
    registerCommand('Close Pane', '', () => ribbonActions['close-pane']());
    registerCommand('Zoom In', 'Ctrl++', () => ribbonActions['zoom-in']());
    registerCommand('Zoom Out', 'Ctrl+-', () => ribbonActions['zoom-out']());
    registerCommand('Toggle Hidden Files', 'Ctrl+H', () => ribbonActions['toggle-hidden']());
    registerCommand('Toggle File Extensions', '', () => ribbonActions['toggle-extensions']());
    registerCommand('Highlight Recent Files', '', () => ribbonActions['toggle-highlight-recents']());
    registerCommand('New Window', '', () => ribbonActions['new-window']());
    registerCommand('Go To Path', 'Ctrl+P / F4', () => showGotoDialog());
    registerCommand('Command Palette', 'Ctrl+Shift+P', () => showCommandPalette());
    registerCommand('Options', 'Ctrl+,', () => showOptionsDialog());
    registerCommand('Save Layout', '', () => ribbonActions['save-layout']());
    registerCommand('Load Layout', '', () => ribbonActions['load-layout']());
    registerCommand('New Tab', 'Ctrl+T', () => { const p = paneManager.getActive(); if (p) p.createTab(p.currentPath); });
    registerCommand('Close Tab', 'Ctrl+F4 / Ctrl+W', () => { const p = paneManager.getActive(); if (p) p.closeTab(p.activeTabId); });
    registerCommand('About', '', () => ribbonActions.about());
    registerCommand('Exit', '', () => ribbonActions.exit());
  }

  function showCommandPalette() {
    const overlay = document.getElementById('dlg-command-palette');
    const input = document.getElementById('cp-input');
    const list = document.getElementById('cp-list');
    overlay.classList.add('visible');
    input.value = '';
    input.focus();
    let activeIdx = -1;
    let filtered = _commands.slice();

    function renderList() {
      list.innerHTML = '';
      for (let i = 0; i < filtered.length; ++i) {
        const cmd = filtered[i];
        const el = document.createElement('div');
        el.className = 'cp-item' + (i === activeIdx ? ' active' : '');
        const nameEl = document.createElement('span');
        nameEl.className = 'cp-name';
        nameEl.textContent = cmd.name;
        el.appendChild(nameEl);
        if (cmd.shortcutLabel) {
          const scEl = document.createElement('span');
          scEl.className = 'cp-shortcut';
          scEl.textContent = cmd.shortcutLabel;
          el.appendChild(scEl);
        }
        el.addEventListener('click', () => { overlay.classList.remove('visible'); cmd.callback(); });
        list.appendChild(el);
      }
    }

    function filter() {
      const q = input.value.trim().toLowerCase();
      filtered = q ? _commands.filter(c => c.name.toLowerCase().includes(q)) : _commands.slice();
      activeIdx = filtered.length > 0 ? 0 : -1;
      renderList();
    }

    filter();

    const onInput = () => filter();
    const onKeydown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIdx = Math.min(activeIdx + 1, filtered.length - 1);
        renderList();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx = Math.max(activeIdx - 1, 0);
        renderList();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIdx >= 0 && activeIdx < filtered.length) {
          overlay.classList.remove('visible');
          filtered[activeIdx].callback();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        overlay.classList.remove('visible');
      }
    };

    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKeydown);

    const onOverlayClick = (e) => {
      if (e.target === overlay)
        overlay.classList.remove('visible');
    };
    overlay.addEventListener('click', onOverlayClick);

    const observer = new MutationObserver(() => {
      if (!overlay.classList.contains('visible')) {
        input.removeEventListener('input', onInput);
        input.removeEventListener('keydown', onKeydown);
        overlay.removeEventListener('click', onOverlayClick);
        observer.disconnect();
      }
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  }

  // =========================================================================
  // GoTo Dialog (Ctrl+P / F4)
  // =========================================================================
  function showGotoDialog() {
    const overlay = document.getElementById('dlg-goto');
    const input = document.getElementById('goto-input');
    const recentsEl = document.getElementById('goto-recents');
    overlay.classList.add('visible');
    input.value = '';
    input.focus();

    function renderRecents(query) {
      recentsEl.innerHTML = '';
      const q = (query || '').trim().toLowerCase();
      const filtered = q ? recentPaths.filter(p => p.toLowerCase().includes(q) || baseName(p).toLowerCase().includes(q)) : recentPaths;
      for (const rPath of filtered.slice(0, 20)) {
        const item = document.createElement('div');
        item.className = 'goto-recent-item';
        item.textContent = formatPath(rPath);
        item.addEventListener('click', () => {
          overlay.classList.remove('visible');
          const pane = paneManager.getActive();
          if (pane) pane.navigate(rPath);
        });
        recentsEl.appendChild(item);
      }
    }

    renderRecents();

    const onInput = () => renderRecents(input.value);
    const onKeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        overlay.classList.remove('visible');
        const path = parsePath(input.value);
        const pane = paneManager.getActive();
        if (pane && path) pane.navigate(path);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        overlay.classList.remove('visible');
      }
    };

    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKeydown);

    const onOverlayClick = (e) => { if (e.target === overlay) overlay.classList.remove('visible'); };
    overlay.addEventListener('click', onOverlayClick);

    const observer = new MutationObserver(() => {
      if (!overlay.classList.contains('visible')) {
        input.removeEventListener('input', onInput);
        input.removeEventListener('keydown', onKeydown);
        overlay.removeEventListener('click', onOverlayClick);
        observer.disconnect();
      }
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  }

  // =========================================================================
  // Options Dialog (Ctrl+,)
  // =========================================================================
  function showOptionsDialog() {
    const overlay = document.getElementById('dlg-options');
    overlay.classList.add('visible');

    const fontSel = document.getElementById('opt-font-size');
    const spacingSel = document.getElementById('opt-row-spacing');
    const zoomSel = document.getElementById('opt-icon-zoom');
    const viewSel = document.getElementById('opt-default-view');

    fontSel.value = String(optFontSize);
    spacingSel.value = optRowSpacing;
    zoomSel.value = optIconZoom;
    viewSel.value = optDefaultView;

    const handler = (e) => {
      const btn = e.target.closest('[data-result]');
      if (!btn) return;
      overlay.classList.remove('visible');
      if (btn.dataset.result === 'ok') {
        optFontSize = parseInt(fontSel.value, 10);
        optRowSpacing = spacingSel.value;
        optIconZoom = zoomSel.value;
        optDefaultView = viewSel.value;
        applyOptions();
        saveOptions();
      }
      overlay.removeEventListener('click', handler);
    };
    overlay.addEventListener('click', handler);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.classList.remove('visible'); overlay.removeEventListener('click', handler); } }, { once: true });
  }

  function applyOptions() {
    document.body.style.fontSize = optFontSize + 'px';
    document.body.classList.remove('spacing-compact', 'spacing-normal', 'spacing-comfortable');
    document.body.classList.add('spacing-' + optRowSpacing);
    applyIconZoom(optIconZoom);
  }

  function saveOptions() {
    try {
      Advapi32.RegSetValue('explorer.optFontSize', String(optFontSize));
      Advapi32.RegSetValue('explorer.optRowSpacing', optRowSpacing);
      Advapi32.RegSetValue('explorer.optIconZoom', optIconZoom);
      Advapi32.RegSetValue('explorer.optDefaultView', optDefaultView);
    } catch {}
  }

  function loadOptions() {
    try {
      const fs = Advapi32.RegGetValue('explorer.optFontSize');
      if (fs) optFontSize = parseInt(fs, 10) || 12;
    } catch {}
    try {
      const rs = Advapi32.RegGetValue('explorer.optRowSpacing');
      if (rs) optRowSpacing = rs;
    } catch {}
    try {
      const iz = Advapi32.RegGetValue('explorer.optIconZoom');
      if (iz) optIconZoom = iz;
    } catch {}
    try {
      const dv = Advapi32.RegGetValue('explorer.optDefaultView');
      if (dv) optDefaultView = dv;
    } catch {}
    applyOptions();
  }

  // =========================================================================
  // Bulk Rename Dialog
  // =========================================================================
  function showBulkRenameDialog() {
    const pane = paneManager.getActive();
    if (!pane || pane.selectedItems.length < 2 || !pane.isVfsMode) return;

    const overlay = document.getElementById('dlg-bulk-rename');
    overlay.classList.add('visible');

    const patternInput = document.getElementById('br-pattern');
    const counterStartInput = document.getElementById('br-counter-start');
    const counterPadInput = document.getElementById('br-counter-pad');
    const previewEl = document.getElementById('br-preview');

    patternInput.value = '{name}{ext}';
    counterStartInput.value = '1';
    counterPadInput.value = '1';

    const items = pane.selectedItems.map(s => {
      const dot = s.name.lastIndexOf('.');
      return {
        original: s.name,
        path: s.path,
        name: dot > 0 ? s.name.slice(0, dot) : s.name,
        ext: dot > 0 ? s.name.slice(dot) : '',
      };
    });

    function generatePreview() {
      const pattern = patternInput.value;
      const counterStart = parseInt(counterStartInput.value, 10) || 0;
      const padding = parseInt(counterPadInput.value, 10) || 1;
      const dateStr = new Date().toISOString().slice(0, 10);

      previewEl.innerHTML = '';
      const tbl = document.createElement('table');
      tbl.className = 'br-preview-table';
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        const counter = String(counterStart + i).padStart(padding, '0');
        const id = Math.random().toString(16).slice(2, 10);
        let newName = pattern
          .replace(/\{name\}/g, item.name)
          .replace(/\{ext\}/g, item.ext)
          .replace(/\{counter\}/g, counter)
          .replace(/\{date\}/g, dateStr)
          .replace(/\{id\}/g, id);

        const tr = document.createElement('tr');
        tr.className = 'br-preview-row';
        const tdOld = document.createElement('td');
        tdOld.className = 'br-preview-old';
        tdOld.textContent = item.original;
        const tdArrow = document.createElement('td');
        tdArrow.className = 'br-preview-arrow';
        tdArrow.textContent = '\u2192';
        const tdNew = document.createElement('td');
        tdNew.className = 'br-preview-new';
        tdNew.textContent = newName;
        if (newName !== item.original) tdNew.style.fontWeight = 'bold';
        tr.append(tdOld, tdArrow, tdNew);
        tbl.appendChild(tr);
      }
      previewEl.appendChild(tbl);
    }

    generatePreview();
    patternInput.addEventListener('input', generatePreview);
    counterStartInput.addEventListener('input', generatePreview);
    counterPadInput.addEventListener('input', generatePreview);

    const handler = async (e) => {
      const btn = e.target.closest('[data-result]');
      if (!btn) return;
      overlay.classList.remove('visible');
      if (btn.dataset.result === 'ok') {
        const pattern = patternInput.value;
        const counterStart = parseInt(counterStartInput.value, 10) || 0;
        const padding = parseInt(counterPadInput.value, 10) || 1;
        const dateStr = new Date().toISOString().slice(0, 10);

        for (let i = 0; i < items.length; ++i) {
          const item = items[i];
          const counter = String(counterStart + i).padStart(padding, '0');
          const id = Math.random().toString(16).slice(2, 10);
          const newName = pattern
            .replace(/\{name\}/g, item.name)
            .replace(/\{ext\}/g, item.ext)
            .replace(/\{counter\}/g, counter)
            .replace(/\{date\}/g, dateStr)
            .replace(/\{id\}/g, id);

          if (newName && newName !== item.original) {
            const oldVfs = toVfsRelative(item.path);
            const dirVfs = toVfsRelative(pane.currentPath);
            const newVfs = (dirVfs === '/' ? '/' : dirVfs + '/') + newName;
            await vfsRename(oldVfs, newVfs);
          }
        }
        pane.clearSelection();
        await pane.doRefresh();
      }
      overlay.removeEventListener('click', handler);
      patternInput.removeEventListener('input', generatePreview);
      counterStartInput.removeEventListener('input', generatePreview);
      counterPadInput.removeEventListener('input', generatePreview);
    };
    overlay.addEventListener('click', handler);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('visible');
        overlay.removeEventListener('click', handler);
      }
    }, { once: true });
  }

  // =========================================================================
  // Keyboard shortcuts
  // =========================================================================
  document.addEventListener('keydown', (e) => {
    // Skip when in inputs (except specific shortcuts)
    const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

    // Command palette
    if (e.key === 'P' && e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      showCommandPalette();
      return;
    }

    // GoTo
    if ((e.key === 'p' && e.ctrlKey && !e.shiftKey) || e.key === 'F4') {
      e.preventDefault();
      showGotoDialog();
      return;
    }

    // Options
    if (e.key === ',' && e.ctrlKey) {
      e.preventDefault();
      showOptionsDialog();
      return;
    }

    // Close tab
    if (e.key === 'F4' && e.ctrlKey) {
      e.preventDefault();
      const pane = paneManager.getActive();
      if (pane) pane.closeTab(pane.activeTabId);
      return;
    }

    if (inInput) return;

    const pane = paneManager.getActive();
    if (!pane) return;

    // Expand folder
    if (e.key === 'e' && e.ctrlKey) {
      e.preventDefault();
      pane.toggleExpandedMode();
      return;
    }

    // Hidden files
    if (e.key === 'h' && e.ctrlKey) {
      e.preventDefault();
      pane.showHiddenFiles = !pane.showHiddenFiles;
      pane.render();
      return;
    }

    // Split right
    if (e.key === 'S' && e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      paneManager.splitRight(pane.id);
      return;
    }

    // Space toggles preview
    if (e.key === ' ') {
      e.preventDefault();
      pane.togglePreviewPane();
      return;
    }

    // Zoom
    if ((e.key === '+' || e.key === '=') && e.ctrlKey) {
      e.preventDefault();
      ribbonActions['zoom-in']();
      return;
    }
    if (e.key === '-' && e.ctrlKey) {
      e.preventDefault();
      ribbonActions['zoom-out']();
      return;
    }

    if (e.key === 'F2' && pane.selectedItems.length === 1 && pane.isVfsMode) {
      e.preventDefault();
      pane.beginRename();
    } else if (e.key === 'Delete' && pane.selectedItems.length > 0 && pane.isVfsMode) {
      e.preventDefault();
      pane.doDelete();
    } else if (e.key === 'F5') {
      e.preventDefault();
      pane.doRefresh();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      if (pane.currentPath !== '/') pane.navigate(parentPath(pane.currentPath));
    } else if (e.key === 'a' && e.ctrlKey) {
      e.preventDefault();
      pane.selectAll();
    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      pane.doClipboardCopy();
    } else if (e.key === 'x' && e.ctrlKey && pane.isVfsMode) {
      e.preventDefault();
      pane.doClipboardCut();
    } else if (e.key === 'v' && e.ctrlKey && pane.isVfsMode) {
      e.preventDefault();
      pane.doPaste();
    } else if (e.key === 'Enter' && pane.selectedItems.length === 1) {
      e.preventDefault();
      const sel = pane.selectedItems[0];
      if (sel.isDir) pane.navigate(sel.path);
      else if (pane.isVfsMode) openFile(sel.path, sel.name);
    } else if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      pane.goBack();
    } else if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      pane.goForward();
    } else if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault();
      if (pane.currentPath !== '/') pane.navigate(parentPath(pane.currentPath));
    } else if (e.key === 't' && e.ctrlKey) {
      e.preventDefault();
      pane.createTab(pane.currentPath);
    } else if (e.key === 'w' && e.ctrlKey) {
      e.preventDefault();
      pane.closeTab(pane.activeTabId);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      // Type-ahead selection
      pane.handleTypeAhead(e.key);
    }
  });

  // Dismiss context menu
  document.addEventListener('click', () => dismissContextMenu());
  document.addEventListener('contextmenu', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  });

  // =========================================================================
  // Directory watching (poll-based, 5s interval)
  // =========================================================================
  let _watchLastEntries = null;
  let _watchInterval = null;

  function startDirectoryWatch() {
    if (_watchInterval) clearInterval(_watchInterval);
    _watchInterval = setInterval(async () => {
      const pane = paneManager.getActive();
      if (!pane || !pane.isVfsMode) return;
      try {
        const vfsPath = toVfsRelative(pane.currentPath);
        const result = await vfsList(vfsPath);
        const names = (result.entries || []).map(e => e.name).sort().join(',');
        if (_watchLastEntries === null) {
          _watchLastEntries = names;
          return;
        }
        if (names !== _watchLastEntries) {
          _watchLastEntries = names;
          pane.clearSelection();
          await pane.render();
        }
      } catch {}
    }, 5000);
  }

  // =========================================================================
  // File-type icon associations (async, fire-and-forget)
  // =========================================================================
  async function _loadFileAssociations() {
    try { _fileAssocMap = await Shell32.SHGetFileTypeAssociations(); } catch { return; }
    const uniqueIcons = new Set();
    for (const ext of Object.keys(_fileAssocMap)) {
      const { iconPath } = _fileAssocMap[ext];
      if (iconPath && !_iconSvgCache.has(iconPath)) uniqueIcons.add(iconPath);
    }
    await Promise.all([...uniqueIcons].map(async (iconPath) => {
      try {
        const resp = await fetch('../' + iconPath);
        if (!resp.ok) return;
        const text = await resp.text();
        _iconSvgCache.set(iconPath, _parseAppSvg(text));
      } catch {}
    }));
    // Re-render active pane
    const pane = paneManager.getActive();
    if (pane && pane.isVfsMode) pane.render();
  }

  // =========================================================================
  // Load persisted settings
  // =========================================================================
  function loadSettings() {
    try {
      const vm = Advapi32.RegGetValue('explorer.viewMode');
      if (vm && ['icons', 'details', 'tiles'].includes(vm)) optDefaultView = vm;
    } catch {}
    try {
      const np = Advapi32.RegGetValue('explorer.navPane');
      if (np === '0') { navPaneVisible = false; sidebar.classList.add('hidden'); }
    } catch {}
    loadQuickAccess();
    loadBookmarks();
    loadRecentPaths();
    loadOptions();
  }

  // =========================================================================
  // Init
  // =========================================================================
  _initObjectRoots();
  _initCommands();
  loadSettings();

  const cmdLine = Kernel32.GetCommandLine();
  let startPath = '/';
  if (cmdLine.path) {
    startPath = cmdLine.path;
  }

  buildSidebar();
  paneManager.init(startPath);
  updateViewModeButtons();
  updatePreviewButton();
  _loadFileAssociations();
  startDirectoryWatch();

  // About dialog handler
  document.getElementById('dlg-about')?.addEventListener('click', function(e) {
    if (e.target.closest('[data-result]'))
      this.classList.remove('visible');
  });

})();
