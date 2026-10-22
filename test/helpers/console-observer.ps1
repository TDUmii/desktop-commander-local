Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class UmiConsoleObserver {
    public delegate bool WindowCallback(IntPtr window, IntPtr state);
    public delegate void EventCallback(IntPtr hook, uint kind, IntPtr window, int objectId, int childId, uint thread, uint time);
    [DllImport("user32.dll")] static extern bool EnumWindows(WindowCallback callback, IntPtr state);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr window, StringBuilder name, int length);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
    [DllImport("user32.dll")] static extern IntPtr SetWinEventHook(uint min, uint max, IntPtr module, EventCallback callback, uint pid, uint thread, uint flags);
    [DllImport("user32.dll")] static extern bool UnhookWinEvent(IntPtr hook);
    static readonly HashSet<IntPtr> baseline = new HashSet<IntPtr>();
    static readonly Dictionary<IntPtr,string> shown = new Dictionary<IntPtr,string>();
    static EventCallback callback;
    static IntPtr hook;
    static void Record(IntPtr window, bool initial) {
        if (window == IntPtr.Zero || !IsWindowVisible(window)) return;
        var name = new StringBuilder(256);
        GetClassName(window, name, name.Capacity);
        string kind = name.ToString();
        if (kind != "ConsoleWindowClass" && kind != "CASCADIA_HOSTING_WINDOW_CLASS") return;
        if (initial) { baseline.Add(window); return; }
        if (!baseline.Contains(window)) {
            uint pid;
            GetWindowThreadProcessId(window, out pid);
            shown[window] = kind + ":" + pid;
        }
    }
    public static void Start() {
        EnumWindows((window,state) => { Record(window, true); return true; }, IntPtr.Zero);
        callback = (a,e,window,objectId,c,t,m) => { if (objectId == 0) Record(window, false); };
        hook = SetWinEventHook(0x8000, 0x8002, IntPtr.Zero, callback, 0, 0, 0);
        if (hook == IntPtr.Zero) throw new Exception("Unable to observe console windows.");
    }
    public static string[] Stop() {
        EnumWindows((window,state) => { Record(window, false); return true; }, IntPtr.Zero);
        UnhookWinEvent(hook);
        return new List<string>(shown.Values).ToArray();
    }
    // Console.In.ReadLineAsync blocks synchronously on .NET Framework.
    public static System.Threading.Tasks.Task<string> ReadStop() {
        return System.Threading.Tasks.Task.Run(() => Console.ReadLine());
    }
}
'@
[UmiConsoleObserver]::Start()
[Console]::WriteLine('READY')
$stopLine = [UmiConsoleObserver]::ReadStop()
while (-not $stopLine.IsCompleted) {
    [System.Windows.Forms.Application]::DoEvents()
    Start-Sleep -Milliseconds 5
}
[System.Windows.Forms.Application]::DoEvents()
[Console]::WriteLine((ConvertTo-Json -Compress -InputObject @([UmiConsoleObserver]::Stop())))
