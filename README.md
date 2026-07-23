<div align="center">

<img src="assets/icon.png" width="96" alt="DL-chan icon" />

# DL-chan

**โปรแกรมจัดการดาวน์โหลดสายเป็นมิตร สำหรับ Windows**
โหลดไฟล์เร็วขึ้นด้วยการแบ่งหลายท่อ ต่อวิดีโอสตรีมได้ทั้ง HLS จับลิงก์อัตโนมัติจากเบราว์เซอร์

[![Platform](https://img.shields.io/badge/platform-Windows-0078D6?logo=windows&logoColor=white)](#การติดตั้ง)
[![Built with Electron](https://img.shields.io/badge/built%20with-Electron-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Release](https://img.shields.io/github/v/release/shiawasenanami/dlchan-releases?label=latest%20release&color=6FCF97)](https://github.com/shiawasenanami/dlchan-releases/releases/latest)
[![License](https://img.shields.io/badge/license-Proprietary-lightgrey)](#สัญญาอนุญาต)

[ดาวน์โหลด](https://github.com/shiawasenanami/dlchan-releases/releases/latest) · [ฟีเจอร์](#-ฟีเจอร์) · [วิธีใช้งาน](#-วิธีใช้งานเบื้องต้น) · [สถาปัตยกรรม](#-สถาปัตยกรรมการทำงาน)

</div>

---

## ✨ ฟีเจอร์

| | |
|---|---|
| 🚀 **ดาวน์โหลดหลายท่อ** | แบ่งไฟล์เดียวเป็น 1–32 connections พร้อมกัน โหลดเร็วขึ้นหลายเท่าเมื่อเซิร์ฟเวอร์รองรับ Range request |
| 🎬 **รองรับ HLS (.m3u8)** | ดาวน์โหลดวิดีโอสตรีมมิ่งแบบแบ่งเซกเมนต์ พร้อมถอดรหัส AES-128 อัตโนมัติถ้าลิงก์มีการเข้ารหัส |
| 🧩 **ส่วนขยายเบราว์เซอร์** | ติดตั้งใน Chrome/Edge/Brave/Firefox แล้วจะจับลิงก์วิดีโอ/ไฟล์ระหว่างเปิดเว็บให้อัตโนมัติ พร้อมแนบ Referer/Cookie ให้ลิงก์ที่โหลดตรงๆ ไม่ได้ |
| ⏸️ **หยุด/เล่นต่อได้ทุกเมื่อ** | ดาวน์โหลดค้างไว้ ปิดโปรแกรม เปิดใหม่แล้วโหลดต่อจากจุดเดิมได้ ไม่ต้องเริ่มใหม่ |
| ⏱️ **ตั้งเวลาดาวน์โหลด** | คิวงานไว้ล่วงหน้า ให้เริ่มโหลดอัตโนมัติตามเวลาที่กำหนด |
| 🎚️ **จำกัดความเร็ว** | ตั้ง bandwidth cap แบบ live ปรับได้โดยไม่ต้องรีสตาร์ตดาวน์โหลดที่กำลังทำอยู่ |
| 🔄 **แปลงไฟล์หลังโหลดเสร็จ** | แปลงเป็น MP3 / AAC / WAV / FLAC ได้ในตัว (ผ่าน ffmpeg) |
| 📋 **ตรวจจับจาก Clipboard** | คัดลอกลิงก์ไฟล์ที่รองรับ โปรแกรมจะเสนอให้โหลดทันทีโดยไม่ต้องพิมพ์เอง |
| 🌐 **หลายภาษา** | ไทย / English / 日本語 |
| 🔔 **แจ้งเตือนอัปเดตอัตโนมัติ** | เช็กเวอร์ชันใหม่ให้ทุก 4 ชั่วโมง กดโหลดอัปเดตได้จากในแอปเลย |
| 🗂️ **ค้างอยู่ใน Tray** | ปิดหน้าต่างแล้วไม่หยุดงานที่กำลังโหลด ทำงานเงียบๆ อยู่ที่ system tray |

---

## 📦 การติดตั้ง

1. โหลดตัวติดตั้งล่าสุดจากหน้า **[Releases](https://github.com/shiawasenanami/dlchan-releases/releases/latest)** (ไฟล์ `DL-chan Setup x.x.x.exe`)
2. รันตัวติดตั้ง เลือกโฟลเดอร์ที่ต้องการ แล้วกดติดตั้ง
3. เปิด DL-chan ครั้งแรกจะมีหน้าต้อนรับให้เลือกเปิดใช้ฟีเจอร์ที่ต้องการ (ปรับทีหลังได้ในเมนู **ตัวเลือก**)

### ติดตั้งส่วนขยายเบราว์เซอร์ (แนะนำ)

ส่วนขยายทำหน้าที่ "ดักจับ" ลิงก์วิดีโอ/ไฟล์ระหว่างเปิดเว็บ แล้วส่งให้ DL-chan โหลดให้อัตโนมัติ — ไม่ต้องคัดลอกลิงก์มาวางเอง

1. ในแอป DL-chan ไปที่หน้าต้อนรับ หรือ **ตัวเลือก → เปิดโฟลเดอร์ Extension**
2. **Chrome / Edge / Brave** — เปิด `chrome://extensions` (หรือ `edge://extensions`) → เปิด **Developer mode** → **Load unpacked** → เลือกโฟลเดอร์ `extension` ที่เปิดไว้
3. **Firefox** — เปิด `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → เลือกไฟล์ `manifest.firefox.json`

> ส่วนขยายคุยกับแอปผ่าน local bridge บน `127.0.0.1:47921` เท่านั้น ไม่มีการส่งข้อมูลออกไปเซิร์ฟเวอร์ภายนอกใดๆ

---

## 🚀 วิธีใช้งานเบื้องต้น

### โหลดไฟล์แบบด่วน
1. กด **เพิ่ม URL** (มุมซ้ายบน)
2. วางลิงก์ไฟล์ เลือกโฟลเดอร์ปลายทาง และจำนวนท่อดาวน์โหลด (ยิ่งเยอะยิ่งเร็ว ถ้าเซิร์ฟเวอร์รองรับ)
3. ถ้าลิงก์นั้นโหลดตรงๆ ไม่ได้ (ขึ้น error/403) ลองใส่ **Referer** — คือ URL ของหน้าเว็บที่คุณเจอลิงก์นี้มา
4. กด **เริ่มดาวน์โหลด**

### โหลดวิดีโอจากเว็บที่กำลังดู
ติดตั้งส่วนขยายไว้แล้ว → เปิดเว็บที่มีวิดีโอ → พอส่วนขยายเจอไฟล์วิดีโอ/เสียงที่โหลดได้ จะมีแถบเล็กๆ ขึ้นมาให้กด **ดาวน์โหลด** ได้ทันที (Referer/Cookie ของหน้านั้นจะถูกแนบไปให้อัตโนมัติ)

### จัดการงานที่กำลังโหลด
- คลิกขวาที่รายการในคิว เพื่อ **เปิดโฟลเดอร์ / คัดลอกลิงก์ / ดาวน์โหลดซ้ำ / ยกเลิก**
- ใช้แถบด้านซ้ายกรองตามหมวดหมู่ (วิดีโอ / เพลง / โปรแกรม / เอกสาร / บีบอัด) หรือดูเฉพาะที่ยังไม่เสร็จ/เสร็จแล้ว
- ปุ่ม **ตั้งเวลา** ในแถบเครื่องมือ ใช้คิวดาวน์โหลดให้เริ่มอัตโนมัติตามเวลาที่กำหนด

### ตั้งค่า
เมนู **ตัวเลือก** ปรับได้ทั้ง: โฟลเดอร์บันทึกเริ่มต้น, จำกัดความเร็วสูงสุด, ธีมสี, ภาษา, เปิด/ปิดการตรวจจับ clipboard และเช็กอัปเดตเวอร์ชันใหม่ด้วยตัวเอง

---

## 🧠 สถาปัตยกรรมการทำงาน

```
┌─────────────────────┐     HTTP (127.0.0.1:47921)     ┌──────────────────────────┐
│  Browser Extension  │ ───────────────────────────▶  │   Electron Main Process   │
│  (background.js)    │   /detect, /queue              │   extensionBridge.js       │
│  ดักจับลิงก์วิดีโอ/    │                                 │   downloadEngine.js        │
│  Referer/Cookie      │                                 │   (multi-connection +     │
└─────────────────────┘                                 │    HLS downloader)        │
                                                          │   updateChecker.js        │
┌─────────────────────┐        IPC (contextBridge)      │   license.js               │
│  Renderer (UI)       │ ◀──────────────────────────▶  │   mediaConverter.js        │
│  renderer.js          │                                 └──────────────────────────┘
│  คิวงาน / ตัวเลือก /   │
│  หน้าต่างแอป           │
└─────────────────────┘
```

- **`downloadEngine.js`** — หัวใจของโปรแกรม แบ่งไฟล์เป็นหลาย segment โหลดพร้อมกันด้วย HTTP Range request, merge กลับเป็นไฟล์เดียวแบบ atomic (เขียนลง temp file ก่อน rename ตอนเสร็จจริงเท่านั้น กันไฟล์ค้างเวลา error), และมี `HlsDownloadTask` แยกสำหรับ playlist `.m3u8` (parse master/media playlist, ถอดรหัส AES-128-CBC ถ้ามี key)
- **`extensionBridge.js`** — เซิร์ฟเวอร์ HTTP loopback เล็กๆ ที่ extension คุยด้วย ไม่ต้องติดตั้ง native messaging host
- **`updateChecker.js`** — เช็กเวอร์ชันใหม่จาก `latest.json` ใน [dlchan-releases](https://github.com/shiawasenanami/dlchan-releases)
- **`license.js`** — ยืนยันโค้ดใช้งานด้วย Ed25519 signature verification (private key ไม่เคยอยู่ในตัวติดตั้ง)

---

## 🛠️ Build จาก source

```bash
git clone https://github.com/shiawasenanami/dlchan.git
cd dlchan
npm install
npm start          # รันแอปแบบ dev
npm run dist       # build ตัวติดตั้ง .exe (NSIS) ออกที่ release/
```

---

## 📄 สัญญาอนุญาต

© Nakano Tabasa — สงวนลิขสิทธิ์

