param(
    [ValidateRange(1, 1440)][int]$Minutes = 480,
    [ValidateRange(1, 3600)][int]$IntervalSeconds = 600,
    [string]$SessionTitle = 'DESKTOP-LSGVBN7 - TeamViewer',
    [switch]$Once,
    [switch]$DryRun
)
if ($SessionTitle -notmatch '^.+ - TeamViewer$') {
    throw 'SessionTitle must identify a remote TeamViewer session, not the TeamViewer manager.'
}

# Only pin the active remote-control window. TeamViewer also has a separate
# management window titled "TeamViewer" which must not be made always-on-top.
Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class TvSessionWindow {
    public delegate bool WindowCallback(IntPtr hwnd, IntPtr data);
    [DllImport("user32.dll")] public static extern bool EnumWindows(WindowCallback cb, IntPtr data);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int max);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hwnd, int index);
    [DllImport("user32.dll", SetLastError=true)] public static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
}
"@

$log = Join-Path $env:LOCALAPPDATA 'UmiBridge\teamviewer-watch.log'
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null

function Write-Status([string]$message) {
    $line = "$(Get-Date -Format o) $message"
    Add-Content -LiteralPath $log -Value $line -Encoding UTF8
    Write-Output $line
}

function Check-RemoteSession {
    $teamviewerIds = @(Get-Process -Name TeamViewer -ErrorAction SilentlyContinue | ForEach-Object { [uint32]$_.Id })
    if ($teamviewerIds.Count -eq 0) { Write-Status 'No TeamViewer process'; return }

    $windows = [System.Collections.Generic.List[object]]::new()
    $callback = [TvSessionWindow+WindowCallback] {
        param([IntPtr]$handle, [IntPtr]$unused)
        $text = [System.Text.StringBuilder]::new(512)
        [void][TvSessionWindow]::GetWindowText($handle, $text, $text.Capacity)
        [uint32]$processId = 0
        [void][TvSessionWindow]::GetWindowThreadProcessId($handle, [ref]$processId)
        if ($teamviewerIds -contains $processId -and $text.ToString() -ceq $SessionTitle -and
            [TvSessionWindow]::IsWindowVisible($handle)) {
            $windows.Add($handle)
        }
        return $true
    }
    [void][TvSessionWindow]::EnumWindows($callback, [IntPtr]::Zero)
    if ($windows.Count -eq 0) { Write-Status "Remote session not found: $SessionTitle"; return }

    foreach ($handle in $windows) {
        if ([TvSessionWindow]::IsIconic($handle)) {
            Write-Status "Remote session minimized; leaving unchanged: $SessionTitle"
            continue
        }
        $alreadyTopmost = ([TvSessionWindow]::GetWindowLong($handle, -20) -band 8) -ne 0
        if ($DryRun) {
            Write-Status "DryRun: would refresh remote session topmost (already=$alreadyTopmost), hwnd=$($handle.ToInt64()): $SessionTitle"
            continue
        }
        # HWND_TOPMOST=-1, SWP_NOSIZE|SWP_NOMOVE|SWP_NOACTIVATE|SWP_NOOWNERZORDER.
        # Pin without moving/resizing the window or stealing keyboard focus.
        $ok = [TvSessionWindow]::SetWindowPos($handle, [IntPtr](-1), 0, 0, 0, 0, [uint32]0x213)
        $verified = ([TvSessionWindow]::GetWindowLong($handle, -20) -band 8) -ne 0
        if ($ok -and $verified) {
            Write-Status "Pinned remote session topmost, hwnd=$($handle.ToInt64()): $SessionTitle"
        } else {
            Write-Status "ERROR: Could not pin remote session: $SessionTitle (win32=$([Runtime.InteropServices.Marshal]::GetLastWin32Error()))"
        }
    }
}

$until = (Get-Date).AddMinutes($Minutes)
do {
    try { Check-RemoteSession } catch { Write-Status "ERROR: $($_.Exception.GetType().Name): $($_.Exception.Message)" }
    if ($Once -or (Get-Date).AddSeconds($IntervalSeconds) -ge $until) { break }
    Start-Sleep -Seconds $IntervalSeconds
} while ((Get-Date) -lt $until)
