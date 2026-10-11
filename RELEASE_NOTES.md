# 🎬 mini VLC v1.0.0 — Production Release

mini VLC is a desktop local video library and streaming player crafted with an **Apple Liquid Glass** design aesthetic, powered by Electron, SQLite, and custom hardware-accelerated protocol pipelines.

---

## 🌟 What's New in v1.0.0

### 🪟 Apple Liquid Glass Interface & New Icon
- **New Liquid Glass Traffic Cone Icon**: Crafted 3D glass VLC traffic cone icon with transparent refraction and reflective accents.
- **Optical Glass Refraction**: Dynamic SVG displacement map filters and chromatic dispersion on floating control layers.
- **Dynamic Ambient Canvas**: Background gently adopts the soft blurred color palette of the currently selected video artwork.
- **Fluid Layout**: Auto-adapting layout with collapsible icon rail and slide-out video inspector panel.

### ⚡ Database & Media Engine
- **SQLite3 Integration**: Embedded `better-sqlite3` database engine for indexing thousands of local media files.
- **Smart Release Tag Cleaning**: Automatically detects and strips scene tags (`1080p`, `x264`, `HEVC`, `WEBRip`) into badges while keeping clean display titles.
- **Custom URI Protocols**:
  - `mediavault-thumb://`: Low-latency local thumbnail caching.
  - `mediavault-stream://`: Audio track switching and on-the-fly MP3 transcoding via FFmpeg.
- **Dual Playback Engine**: In-app Chromium video renderer or instant one-click launch with external players like VLC.

---

## 📦 Downloads & Deliverables

| File | Type | Platform | Size | Notes |
|---|---|---|---|---|
| **`mini VLC 1.0.0.exe`** | Standalone Executable | Windows (x64) | ~105.5 MB | **Zero install needed.** Carry on USB or run from anywhere. |

---

## 🔒 Verification & SHA-256 Checksums

To verify the integrity of the downloaded binary in PowerShell:
```powershell
Get-FileHash -Path "mini VLC 1.0.0.exe" -Algorithm SHA256
```

- **`mini VLC 1.0.0.exe`**:  
  `660EB5303FC978BDC79FE402CD2E3F09587A4A496B44838D3659F5C6370BAF6D`
