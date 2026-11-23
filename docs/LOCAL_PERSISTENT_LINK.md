# Local persistent link

Use this local address when you want to keep reading the original browser
localStorage data:

```text
http://127.0.0.1:5173/
```

The app stores business data in browser localStorage, which is separated by
origin. `http://127.0.0.1:5173/` and `http://127.0.0.1:8787/` are different
origins, so data saved under one address will not automatically appear under
the other address.

Use `http://127.0.0.1:5173/` for the original local data. The backend also
runs on port 8787 for AI task breakdown and weekly HTML report generation.

## Install startup task

Run this once in PowerShell from the project directory:

```powershell
.\scripts\install-startup-task.ps1
```

This creates a Windows Scheduled Task named `Growth Evidence Dashboard`. It
starts the local server when you sign in and immediately starts it once after
installation.

## Remove startup task

```powershell
.\scripts\uninstall-startup-task.ps1
```

## Manual start

```powershell
npm run build
npm run start
```
