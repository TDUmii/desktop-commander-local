param([int]$Minutes=480)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class TvWindow {
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd,int nCmdShow);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
$log=Join-Path $env:LOCALAPPDATA 'UmiBridge\teamviewer-watch.log'
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
$until=(Get-Date).AddMinutes($Minutes)
do {
 try {
  $tv=Get-Process TeamViewer -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne [IntPtr]::Zero} | Select-Object -First 1
  if($tv) {
   $handle=$tv.MainWindowHandle
   if([TvWindow]::GetForegroundWindow() -ne $handle -and -not [TvWindow]::IsIconic($handle)) {
    [void][TvWindow]::SetForegroundWindow($handle)
    Add-Content $log "$(Get-Date -Format o) attempted foreground TeamViewer PID=$($tv.Id)"
   } else { Add-Content $log "$(Get-Date -Format o) TeamViewer visible/foreground or minimized" }
  } else { Add-Content $log "$(Get-Date -Format o) TeamViewer not available" }
 } catch { Add-Content $log "$(Get-Date -Format o) monitor error: $($_.Exception.GetType().Name)" }
 if((Get-Date).AddMinutes(10) -gt $until){break}
 Start-Sleep -Seconds 600
} while((Get-Date) -lt $until)
