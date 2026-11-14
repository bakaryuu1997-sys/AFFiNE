# AFFiNE cá nhân — ứng dụng desktop (Tauri)

Bọc bản web của fork này thành ứng dụng Windows (`.exe`), kèm cầu nối MCP viết bằng Rust
để AI agent (Claude, Antigravity...) đọc và sửa workspace.

```
apps/tauri/
├─ mcp-bridge/   cầu nối MCP bằng Rust (thư viện + lệnh `affine-mcp`), cùng giao thức với scripts/mcp
├─ src-tauri/    ứng dụng Tauri: cửa sổ, cầu nối MCP chạy cùng ứng dụng, icon
├─ scripts/      build-windows.ps1, make-icons.py
└─ web-dist/     (do script tạo) bản web đã build
```

## Dữ liệu nằm ở đâu

Workspace lưu trong **IndexedDB của WebView2**, giống trình duyệt. Xóa hồ sơ ứng dụng là mất dữ liệu,
nên hãy dùng **Cài đặt → Lưu trữ → Xuất ra Markdown** để sao lưu định kỳ (có thể chọn thẳng một thư mục git).

## Build ra `.exe`

Chia hai bước vì repo nằm trong WSL còn `.exe` phải build bằng bộ công cụ Windows.

**1. Build bản web (trong WSL)**

```bash
cd ~/AFFiNE
yarn workspace @affine/web build        # ra packages/frontend/apps/web/dist
```

**2. Build ứng dụng (trong PowerShell trên Windows)**

Cần sẵn: Rust (`cargo`), Visual Studio Build Tools có thành phần C++, Node.js, WebView2 (đã có trên Windows 11).

```powershell
cd \\wsl.localhost\Ubuntu\home\<tên-bạn>\AFFiNE\packages\frontend\apps\tauri\scripts
.\build-windows.ps1 -WebDist "\\wsl.localhost\Ubuntu\home\<tên-bạn>\AFFiNE\packages\frontend\apps\web\dist"
```

Script chép dự án sang thư mục làm việc `%USERPROFILE%\affine-build` (đường dẫn trong hồ sơ người dùng, tránh lỗi quyền hạn ghi ổ C và tránh đường dẫn có dấu), build và in ra:

- bộ cài NSIS (`target\release\bundle\nsis\*.exe`)
- `affine-personal.exe` — ứng dụng
- `affine-mcp.exe` — công cụ dòng lệnh cho MCP

Lần build đầu mất khá lâu vì biên dịch Tauri; các lần sau nhanh hơn do giữ lại thư mục `target`.

## Dùng với AI agent (MCP)

Ứng dụng tự chạy cầu nối MCP ở `127.0.0.1:20130` khi mở, và tự điền địa chỉ + token vào
**Cài đặt → Lưu trữ → Cầu nối MCP** (bật công tắc là xong). Token nằm ở `%USERPROFILE%\.affine-mcp\token`.
Agent chỉ làm việc được **khi ứng dụng đang mở**.

- **Client dùng HTTP** (Claude Code...): trỏ tới `http://127.0.0.1:20130/mcp`, header `Authorization: Bearer <token>`.
- **Client dùng lệnh** (Claude Desktop, Antigravity...): lệnh là `affine-mcp.exe`, tham số `--stdio`.
  Nếu ứng dụng đang chạy thì nó dùng cầu nối của ứng dụng.

Ví dụ cấu hình kiểu `mcpServers`:

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

(Cách mỗi client khai báo MCP có thể khác nhau; kiểm tra tài liệu của client đó.)

## Lỗi thường gặp và cách xử lý

1. **Ghi vào gốc `C:\` bị từ chối quyền (Access is denied)**:
   Mặc định script hiện tại sử dụng `%USERPROFILE%\affine-build` (trong thư mục người dùng) thay vì `C:\affine-build`. Nếu bạn tự chỉ định `-Work`, hãy chọn thư mục có toàn quyền ghi.
2. **`rustc` bị sập với lỗi `STATUS_STACK_BUFFER_OVERRUN` (0xc0000409)**:
   Xảy ra trên Windows khi biên dịch quá nhiều crate song song gây tràn stack. Script `build-windows.ps1` tự động thiết lập `$env:CARGO_BUILD_JOBS = '2'` để hạn chế số luồng và ngăn ngừa lỗi này.
3. **Xung đột phiên bản Rust toolchain (`rust-toolchain.toml`)**:
   Tệp `rust-toolchain.toml` ở gốc repo AFFiNE ghim phiên bản 1.97.1 (bản này trên Windows có thể bị lỗi thiếu manifest). Script tự sao chép phần mã nguồn Tauri ra ngoài thư mục `%USERPROFILE%\affine-build` để sử dụng bộ toolchain Rust stable mặc định của hệ thống Windows (1.99+), không bị ghim bởi cấu hình monorepo của Linux.

## Chạy thử bản dev

```powershell
npx @tauri-apps/cli@2 dev      # sau khi đã có web-dist
```

## Đổi icon

Sửa `scripts/make-icons.py` rồi chạy `python scripts/make-icons.py` (không cần thư viện ngoài).
