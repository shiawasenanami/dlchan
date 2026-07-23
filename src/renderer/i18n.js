// Lightweight i18n: static UI chrome (menu, toolbar, sidebar, table headers,
// modal titles/buttons) is translated via [data-i18n] lookups. Dynamic,
// JS-generated strings (queue row status text, license messages, table
// counts) stay Thai-only for now — extending those to use t() is the next
// increment, following the same LOCALES pattern below.
const LOCALES = {
  th: {
    menuTasks: 'งาน', menuFile: 'ไฟล์', menuDownloads: 'การดาวน์โหลด', menuView: 'มุมมอง', menuHelp: 'วิธีใช้',
    tbAdd: 'เพิ่ม URL', tbResume: 'เล่นต่อ', tbPause: 'หยุด', tbStopAll: 'หยุดทั้งหมด',
    tbDelete: 'ลบ', tbDeleteDone: 'ลบที่เสร็จแล้ว', tbSchedule: 'ตั้งเวลา', tbSettings: 'ตัวเลือก',
    treeAll: 'การดาวน์โหลดทั้งหมด', treeCompressed: 'บีบอัด', treeDocuments: 'เอกสาร', treeMusic: 'เพลง',
    treePrograms: 'โปรแกรม', treeVideo: 'วิดีโอ', treeUnfinished: 'ยังไม่เสร็จ', treeFinished: 'เสร็จสิ้น', treeQueue: 'คิว',
    colName: 'ชื่อไฟล์', colSize: 'ขนาด', colStatus: 'สถานะ', colEta: 'เวลาที่เหลือ', colSpeed: 'ความเร็ว', colAdded: 'วันที่เพิ่ม',
    queueEmpty: 'ยังไม่มีงานดาวน์โหลด กด "เพิ่ม URL" เพื่อเริ่มต้น',
    addTitle: 'เพิ่มลิงก์ดาวน์โหลด', fieldSaveTo: 'บันทึกไปที่', fieldConnections: 'จำนวนท่อดาวน์โหลด',
    fieldReferer: 'Referer (ใส่เฉพาะลิงก์ที่โหลดตรงๆ ไม่ได้)',
    conn1: '1 ท่อ', conn8: '8 ท่อ', conn16: '16 ท่อ', conn32: '32 ท่อ',
    fieldFormat: 'รูปแบบไฟล์ผลลัพธ์', fmtOriginal: 'ต้นฉบับ (ไม่แปลง)',
    fmtMp3: 'MP3 (lossy)', fmtAac: 'AAC / M4A (lossy)',
    fmtWav16: 'WAV 16-bit (lossless)', fmtWav24: 'WAV 24-bit (lossless)',
    fmtFlac16: 'FLAC 16-bit (lossless)', fmtFlac24: 'FLAC 24-bit (lossless)',
    btnCancel: 'ยกเลิก', btnStartDownload: 'เริ่มดาวน์โหลด', btnDownloadNow: 'ดาวน์โหลด', btnNoThanks: 'ไม่เป็นไร', btnBrowse: 'เลือกโฟลเดอร์',
    optionsTitle: 'ตัวเลือก', tabGeneral: 'ทั่วไป', tabConnection: 'การเชื่อมต่อ', tabTheme: 'ธีมสี', tabLanguage: 'ภาษา',
    fieldDefaultFolder: 'โฟลเดอร์บันทึกเริ่มต้น',
    checkAutoCategorize: 'จัดหมวดหมู่ไฟล์อัตโนมัติตามนามสกุล',
    checkClipboard: 'ตรวจจับลิงก์ดาวน์โหลดจาก clipboard อัตโนมัติ',
    versionLabel: 'เวอร์ชันปัจจุบัน: —', btnCheckUpdate: 'ตรวจสอบอัปเดตตอนนี้',
    fieldSpeedLimit: 'จำกัดความเร็วสูงสุด (KB/s, 0 = ไม่จำกัด)',
    themeCustomLabel: 'กำหนดเอง', checkShowMascot: 'แสดงมาสคอตสไลม์ (ปิดได้ถ้าอยากได้หน้าตาจริงจังแบบคลาสสิก)',
    fieldLanguage: 'ภาษา', btnClose: 'ปิด',
    scheduleTitle: 'ตั้งเวลาดาวน์โหลด', fieldScheduleTime: 'เริ่มดาวน์โหลดเวลา', btnSetSchedule: 'ตั้งเวลา',
    ctxOpenFolder: 'เปิดโฟลเดอร์', ctxCopyLink: 'คัดลอกลิงก์', ctxRedownload: 'ดาวน์โหลดซ้ำ',
    ctxPriorityTop: 'เลื่อนขึ้นบนสุด', ctxRemove: 'ยกเลิก/ลบ',
    updateToastTitle: 'มีเวอร์ชันใหม่ให้อัปเดต!', btnDownloadUpdate: 'ดาวน์โหลดอัปเดต',
    fieldLicenseCode: 'กรอกโค้ดใช้งาน (ถ้ามี)', btnActivateLicense: 'เปิดใช้งานโค้ด',
    welcomeTitle: 'ยินดีต้อนรับสู่ DL-chan', welcomeSub: 'เลือกฟีเจอร์ที่อยากเปิดใช้งาน (ปรับทีหลังได้ที่ "ตัวเลือก")',
    welcomeHls: 'รองรับดาวน์โหลดวิดีโอสตรีม HLS (.m3u8)',
    welcomeSpeedlimit: 'เปิดใช้ตัวจำกัดความเร็วดาวน์โหลด (ตั้งค่าทีหลังได้)',
    welcomeScheduler: 'ปุ่มตั้งเวลาดาวน์โหลดล่วงหน้า',
    welcomeContextmenu: 'เมนูคลิกขวา (เปิดโฟลเดอร์ / คัดลอกลิงก์ / ดาวน์โหลดซ้ำ)',
    welcomeExtSub: 'ติดตั้ง Extension ให้ browser (จับวิดีโอ/ไฟล์ตอนดูเว็บ)',
    btnExtFolder: 'เปิดโฟลเดอร์ extension', btnExtCopyPath: 'คัดลอก path',
    welcomeStepChrome: 'Chrome/Edge/Brave: เปิด <code>chrome://extensions</code> (หรือ <code>edge://extensions</code>) → เปิด Developer mode → Load unpacked → วางโฟลเดอร์ที่เปิดไว้',
    welcomeStepFirefox: 'Firefox: เปิด <code>about:debugging#/runtime/this-firefox</code> → Load Temporary Add-on',
    btnGetStarted: 'เริ่มใช้งาน'
  },
  en: {
    menuTasks: 'Tasks', menuFile: 'File', menuDownloads: 'Downloads', menuView: 'View', menuHelp: 'Help',
    tbAdd: 'Add URL', tbResume: 'Resume', tbPause: 'Pause', tbStopAll: 'Stop all',
    tbDelete: 'Delete', tbDeleteDone: 'Delete finished', tbSchedule: 'Schedule', tbSettings: 'Options',
    treeAll: 'All downloads', treeCompressed: 'Compressed', treeDocuments: 'Documents', treeMusic: 'Music',
    treePrograms: 'Programs', treeVideo: 'Video', treeUnfinished: 'Unfinished', treeFinished: 'Finished', treeQueue: 'Queue',
    colName: 'File name', colSize: 'Size', colStatus: 'Status', colEta: 'Time left', colSpeed: 'Speed', colAdded: 'Date added',
    queueEmpty: 'No downloads yet — click "Add URL" to get started',
    addTitle: 'Add download link', fieldSaveTo: 'Save to', fieldConnections: 'Number of connections',
    fieldReferer: 'Referer (only needed for links that fail to download directly)',
    conn1: '1 connection', conn8: '8 connections', conn16: '16 connections', conn32: '32 connections',
    fieldFormat: 'Output format', fmtOriginal: 'Original (no conversion)',
    fmtMp3: 'MP3 (lossy)', fmtAac: 'AAC / M4A (lossy)',
    fmtWav16: 'WAV 16-bit (lossless)', fmtWav24: 'WAV 24-bit (lossless)',
    fmtFlac16: 'FLAC 16-bit (lossless)', fmtFlac24: 'FLAC 24-bit (lossless)',
    btnCancel: 'Cancel', btnStartDownload: 'Start download', btnDownloadNow: 'Download', btnNoThanks: 'No thanks', btnBrowse: 'Browse',
    optionsTitle: 'Options', tabGeneral: 'General', tabConnection: 'Connection', tabTheme: 'Theme', tabLanguage: 'Language',
    fieldDefaultFolder: 'Default save folder',
    checkAutoCategorize: 'Automatically categorize files by extension',
    checkClipboard: 'Automatically detect download links from clipboard',
    versionLabel: 'Current version: —', btnCheckUpdate: 'Check for updates now',
    fieldSpeedLimit: 'Max download speed (KB/s, 0 = unlimited)',
    themeCustomLabel: 'Custom', checkShowMascot: 'Show slime mascot (turn off for a more classic look)',
    fieldLanguage: 'Language', btnClose: 'Close',
    scheduleTitle: 'Schedule a download', fieldScheduleTime: 'Start time', btnSetSchedule: 'Schedule',
    ctxOpenFolder: 'Open folder', ctxCopyLink: 'Copy link', ctxRedownload: 'Redownload',
    ctxPriorityTop: 'Move to top', ctxRemove: 'Cancel / remove',
    updateToastTitle: 'A new version is available!', btnDownloadUpdate: 'Download update',
    fieldLicenseCode: 'Enter license code (if you have one)', btnActivateLicense: 'Activate code',
    welcomeTitle: 'Welcome to DL-chan', welcomeSub: 'Pick the features you want (you can change these later in Options)',
    welcomeHls: 'Support HLS (.m3u8) video stream downloads',
    welcomeSpeedlimit: 'Enable the download speed limiter (configurable later)',
    welcomeScheduler: 'Schedule-download button',
    welcomeContextmenu: 'Right-click menu (open folder / copy link / redownload)',
    welcomeExtSub: 'Install the browser extension (catches videos/files while browsing)',
    btnExtFolder: 'Open extension folder', btnExtCopyPath: 'Copy path',
    welcomeStepChrome: 'Chrome/Edge/Brave: open <code>chrome://extensions</code> (or <code>edge://extensions</code>) → enable Developer mode → Load unpacked → select the folder you just opened',
    welcomeStepFirefox: 'Firefox: open <code>about:debugging#/runtime/this-firefox</code> → Load Temporary Add-on',
    btnGetStarted: 'Get started'
  },
  ja: {
    menuTasks: 'タスク', menuFile: 'ファイル', menuDownloads: 'ダウンロード', menuView: '表示', menuHelp: 'ヘルプ',
    tbAdd: 'URLを追加', tbResume: '再開', tbPause: '一時停止', tbStopAll: 'すべて停止',
    tbDelete: '削除', tbDeleteDone: '完了済みを削除', tbSchedule: 'スケジュール', tbSettings: '設定',
    treeAll: 'すべてのダウンロード', treeCompressed: '圧縮ファイル', treeDocuments: '書類', treeMusic: '音楽',
    treePrograms: 'プログラム', treeVideo: '動画', treeUnfinished: '未完了', treeFinished: '完了', treeQueue: 'キュー',
    colName: 'ファイル名', colSize: 'サイズ', colStatus: '状態', colEta: '残り時間', colSpeed: '速度', colAdded: '追加日',
    queueEmpty: 'まだダウンロードがありません。「URLを追加」を押して開始してください',
    addTitle: 'ダウンロードリンクを追加', fieldSaveTo: '保存先', fieldConnections: '接続数',
    fieldReferer: 'Referer（直接ダウンロードできない場合のみ入力）',
    conn1: '1接続', conn8: '8接続', conn16: '16接続', conn32: '32接続',
    fieldFormat: '出力形式', fmtOriginal: 'オリジナル（変換なし）',
    fmtMp3: 'MP3（ロッシー）', fmtAac: 'AAC / M4A（ロッシー）',
    fmtWav16: 'WAV 16bit（ロスレス）', fmtWav24: 'WAV 24bit（ロスレス）',
    fmtFlac16: 'FLAC 16bit（ロスレス）', fmtFlac24: 'FLAC 24bit（ロスレス）',
    btnCancel: 'キャンセル', btnStartDownload: 'ダウンロード開始', btnDownloadNow: 'ダウンロード', btnNoThanks: '結構です', btnBrowse: '参照',
    optionsTitle: '設定', tabGeneral: '一般', tabConnection: '接続', tabTheme: 'テーマ', tabLanguage: '言語',
    fieldDefaultFolder: 'デフォルトの保存先フォルダ',
    checkAutoCategorize: '拡張子でファイルを自動分類',
    checkClipboard: 'クリップボードのダウンロードリンクを自動検出',
    versionLabel: '現在のバージョン: —', btnCheckUpdate: '今すぐアップデートを確認',
    fieldSpeedLimit: '最大ダウンロード速度 (KB/s, 0 = 無制限)',
    themeCustomLabel: 'カスタム', checkShowMascot: 'スライムマスコットを表示 (オフでクラシックな見た目に)',
    fieldLanguage: '言語', btnClose: '閉じる',
    scheduleTitle: 'ダウンロードのスケジュール', fieldScheduleTime: '開始時刻', btnSetSchedule: 'スケジュール設定',
    ctxOpenFolder: 'フォルダを開く', ctxCopyLink: 'リンクをコピー', ctxRedownload: '再ダウンロード',
    ctxPriorityTop: '一番上へ移動', ctxRemove: 'キャンセル / 削除',
    updateToastTitle: '新しいバージョンがあります！', btnDownloadUpdate: 'アップデートをダウンロード',
    fieldLicenseCode: 'ライセンスコードを入力（お持ちの場合）', btnActivateLicense: 'コードを有効化',
    welcomeTitle: 'DL-chanへようこそ', welcomeSub: '使いたい機能を選んでください（後で設定から変更できます）',
    welcomeHls: 'HLS (.m3u8) 動画ストリームのダウンロードに対応',
    welcomeSpeedlimit: 'ダウンロード速度制限を有効にする（後で設定可能）',
    welcomeScheduler: 'ダウンロード予約ボタン',
    welcomeContextmenu: '右クリックメニュー（フォルダを開く / リンクをコピー / 再ダウンロード）',
    welcomeExtSub: 'ブラウザ拡張機能をインストール（閲覧中の動画/ファイルを検出）',
    btnExtFolder: '拡張機能フォルダを開く', btnExtCopyPath: 'パスをコピー',
    welcomeStepChrome: 'Chrome/Edge/Brave: <code>chrome://extensions</code>（または<code>edge://extensions</code>）を開く → デベロッパーモードを有効化 → 「パッケージ化されていない拡張機能を読み込む」→ 開いたフォルダを選択',
    welcomeStepFirefox: 'Firefox: <code>about:debugging#/runtime/this-firefox</code>を開く → 「一時的なアドオンを読み込む」',
    btnGetStarted: '始める'
  }
};

// Bonus locales demonstrating the system scales beyond th/en/ja — adding a
// new language is just another key in LOCALES following the same shape.
LOCALES.zh = { ...LOCALES.en, menuTasks: '任务', menuFile: '文件', menuDownloads: '下载', menuView: '视图', menuHelp: '帮助', tbAdd: '添加链接', tbSettings: '选项' };
LOCALES.ko = { ...LOCALES.en, menuTasks: '작업', menuFile: '파일', menuDownloads: '다운로드', menuView: '보기', menuHelp: '도움말', tbAdd: 'URL 추가', tbSettings: '설정' };
LOCALES.es = { ...LOCALES.en, menuTasks: 'Tareas', menuFile: 'Archivo', menuDownloads: 'Descargas', menuView: 'Ver', menuHelp: 'Ayuda', tbAdd: 'Añadir URL', tbSettings: 'Opciones' };

function t(key, locale) {
  const lang = locale || window.i18n.getLocale();
  return (LOCALES[lang] && LOCALES[lang][key]) || LOCALES.en[key] || key;
}

function applyLocale(locale) {
  const lang = LOCALES[locale] ? locale : 'th';
  document.documentElement.setAttribute('lang', lang);
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const value = t(el.dataset.i18n, lang);
    el.innerHTML = value;
  });
  localStorage.setItem('dlchan-lang', lang);
}

function getLocale() {
  return localStorage.getItem('dlchan-lang') || 'th';
}

window.i18n = { t, applyLocale, getLocale, LOCALES };
