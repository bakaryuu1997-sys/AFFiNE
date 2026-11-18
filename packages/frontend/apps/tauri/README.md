# AFFiNE Cá nhân — Tài liệu Tổng quan, Build & Vận hành

Bản fork **AFFiNE cá nhân (local-first, Việt hóa 100%)** đóng gói thành ứng dụng Windows (`.exe`) bằng **Tauri**, tích hợp sẵn cầu nối **MCP (Rust)** và **Trợ lý AI BYOK** (người dùng tự cấu hình API Key cục bộ).

## Tính năng chính của bản Cá nhân

- **Giao diện tiếng Việt & Local-first:** Dữ liệu lưu trực tiếp trong IndexedDB của WebView2 (không phụ thuộc cloud/tài khoản, loại bỏ các thành phần thanh toán/team/analytics).
- **Sơ đồ hệ thống tương tác (`system-diagram`):** 7 mẫu kiến trúc chuẩn Offshore/Production (Web 3-Tier AWS, Microservices & Kafka, Batch/ETL, AI RAG, HA/DR, Tổng hợp 11 thành phần, Tối giản), mô phỏng lưu lượng thời gian thực, né va chạm nhãn tự động, xuất **Mermaid** và **PNG**, chế độ toàn màn hình (`Esc` để thoát).
- **Trợ lý AI cục bộ / BYOK (`Trí tuệ` & `Cài đặt → Cài đặt AI`):** Hỗ trợ **OpenAI**, **Google Gemini** (`https://generativelanguage.googleapis.com/v1beta/openai`), **Anthropic**, **Ollama (Cục bộ)**, **OpenRouter**, **OpenAI Compatible (Tự do)**, **MiniMax**, **9Router**. API Key lưu hoàn toàn cục bộ trên máy.
- **Tiện ích cá nhân:** Hộp **Việc cần làm** gom checkbox toàn workspace (hỗ trợ hạn `@YYYY-MM-DD HH:mm`), **Nhật ký** kèm lịch âm/ngày lễ Việt Nam và bộ chọn Ngày/Tháng/Năm, **Tìm kiếm không dấu**, xuất toàn bộ workspace ra thư mục **Markdown**.
- **Cầu nối MCP (Rust):** Tích hợp 1-click cho Claude Desktop, Claude Code, Codex, Cursor, Windsurf, Antigravity.

```text
packages/frontend/apps/tauri/
├─ mcp-bridge/   cầu nối MCP viết bằng Rust (`affine-mcp.exe`)
├─ src-tauri/    ứng dụng Tauri: cửa sổ desktop, nhúng cầu nối MCP, icon
├─ scripts/      build-windows.ps1, make-icons.py
└─ web-dist/     bản web đã build (do script tạo)
```

## Dữ liệu & Sao lưu

Workspace lưu trong **IndexedDB của WebView2**. Nên sao lưu định kỳ bằng **Cài đặt → Lưu trữ → Xuất ra Markdown** (có thể trỏ thẳng tới một thư mục đồng bộ Google Drive hoặc Git).

## Kiểm thử & Build ra `.exe`

Repo phát triển nằm trong **WSL2 Ubuntu** (`/home/bakaryuu/AFFiNE`, nhánh `vi-lean`); tệp `.exe` và bộ cài đặt NSIS được build bằng bộ công cụ **Windows**.

### 1. Chạy Unit Test & Lint (trong WSL)

```bash
cd /home/bakaryuu/AFFiNE
yarn vitest --run packages/frontend/core/src/blocksuite/system-diagram packages/frontend/core/src/modules/local-ai
npx oxlint packages/frontend/core/src/blocksuite/system-diagram packages/frontend/core/src/modules/local-ai
```

### 2. Build bản Web (trong WSL)

```bash
cd /home/bakaryuu/AFFiNE
NODE_OPTIONS="--max-old-space-size=6144" node --import=file:///home/bakaryuu/AFFiNE/tools/cli/tsx-register.js /home/bakaryuu/AFFiNE/tools/cli/src/affine.ts bundle -p @affine/web
```

Đầu ra nằm tại `packages/frontend/apps/web/dist`.

### 3. Build ứng dụng Windows & bộ cài NSIS (trong PowerShell Windows)

Yêu cầu: Rust (`cargo`), Visual Studio Build Tools (C++), Node.js, WebView2.

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\asus\affine-build\scripts\build-windows.ps1" -WebDist "\\wsl.localhost\Ubuntu\home\bakaryuu\AFFiNE\packages\frontend\apps\web\dist"
```

Script tự động đồng bộ mã nguồn sang `%USERPROFILE%\affine-build`, biên dịch và cập nhật:

- Bộ cài NSIS: `%USERPROFILE%\affine-build\target\release\bundle\nsis\AFFiNE Ca nhan_0.3.0_x64-setup.exe`
- Ứng dụng chạy trực tiếp: `%USERPROFILE%\affine-build\target\release\affine-personal.exe` (tự động chép đè bản cài tại `%LOCALAPPDATA%\AFFiNE Ca nhan\affine-personal.exe`)
- Công cụ MCP CLI: `%USERPROFILE%\affine-build\target\release\affine-mcp.exe`

## Kết nối với AI Agent (MCP)

Ứng dụng tự bật cầu nối MCP tại `127.0.0.1:20130` khi đang mở. Token nằm ở `%USERPROFILE%\.affine-mcp\token`. Mở **Tích hợp MCP** trên thanh bên để cài cấu hình 1-click, hoặc khai báo thủ công:

```json
{
  "mcpServers": {
    "affine": {
      "command": "C:\\Users\\<tên-bạn>\\affine-build\\target\\release\\affine-mcp.exe",
      "args": ["--stdio"]
    }
  }
}
```

## Ghi chú xử lý sự cố build

1. **Ghi vào gốc `C:\` bị từ chối quyền:** Script dùng mặc định `%USERPROFILE%\affine-build`.
2. **Lỗi `rustc` `STATUS_STACK_BUFFER_OVERRUN (0xc0000409)`:** Script tự giới hạn `CARGO_BUILD_JOBS=2`.
3. **Xung đột `rust-toolchain.toml`:** Build ngoài thư mục monorepo giúp Windows dùng Rust stable hệ thống thay vì toolchain Linux.
