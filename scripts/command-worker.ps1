param([int]$ParentPid)

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
$protocolOut = [Console]::Out

# A separate runspace keeps `exit` inside a command from closing the worker.
Add-Type -ReferencedAssemblies ([System.Management.Automation.PSObject].Assembly.Location) -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Globalization;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Management.Automation;
using System.Management.Automation.Host;
using System.Security;
using System.Diagnostics;
using System.Threading;
using System.Runtime.InteropServices;

public sealed class UmiWriter : TextWriter {
    private readonly StringBuilder text = new StringBuilder();
    public override Encoding Encoding { get { return new UTF8Encoding(false); } }
    public override void Write(char value) { if (text.Length < 100000) text.Append(value); }
    public override void Write(string value) { if (value != null && text.Length < 100000) text.Append(value, 0, Math.Min(value.Length, 100000 - text.Length)); }
    public override void Write(char[] value, int index, int count) { if (text.Length < 100000) text.Append(value, index, Math.Min(count, 100000 - text.Length)); }
    public override void WriteLine(string value) { Write(value); Write(Environment.NewLine); }
    public void Clear() { text.Clear(); }
    public override string ToString() { return text.ToString(); }
}

public sealed class UmiUI : PSHostUserInterface {
    public readonly UmiWriter Output = new UmiWriter();
    public readonly UmiWriter Error = new UmiWriter();
    public override PSHostRawUserInterface RawUI { get { return null; } }
    public override void Write(string value) { Output.Write(value); }
    public override void Write(ConsoleColor foreground, ConsoleColor background, string value) { Write(value); }
    public override void WriteLine(string value) { Output.WriteLine(value); }
    public override void WriteErrorLine(string value) { Error.WriteLine(value); }
    public override void WriteDebugLine(string value) { Output.WriteLine(value); }
    public override void WriteProgress(long source, ProgressRecord record) { }
    public override void WriteVerboseLine(string value) { Output.WriteLine(value); }
    public override void WriteWarningLine(string value) { Output.WriteLine(value); }
    public override string ReadLine() { throw new InvalidOperationException("Interactive input is unavailable. Supply command arguments explicitly."); }
    public override SecureString ReadLineAsSecureString() { throw new InvalidOperationException("Interactive input is unavailable."); }
    public override Dictionary<string, PSObject> Prompt(string caption, string message, Collection<FieldDescription> descriptions) { throw new InvalidOperationException("Interactive input is unavailable."); }
    public override PSCredential PromptForCredential(string caption, string message, string userName, string targetName) { throw new InvalidOperationException("Interactive input is unavailable."); }
    public override PSCredential PromptForCredential(string caption, string message, string userName, string targetName, PSCredentialTypes types, PSCredentialUIOptions options) { throw new InvalidOperationException("Interactive input is unavailable."); }
    public override int PromptForChoice(string caption, string message, Collection<ChoiceDescription> choices, int defaultChoice) { throw new InvalidOperationException("Interactive input is unavailable."); }
}

public sealed class UmiHost : PSHost {
    private readonly Guid instance = Guid.NewGuid();
    public readonly UmiUI ConsoleUI = new UmiUI();
    public bool ExitRequested;
    public int ExitCode;
    public override Guid InstanceId { get { return instance; } }
    public override string Name { get { return "UmiBridge background command session"; } }
    public override Version Version { get { return new Version(1, 0); } }
    public override PSHostUserInterface UI { get { return ConsoleUI; } }
    public override CultureInfo CurrentCulture { get { return CultureInfo.CurrentCulture; } }
    public override CultureInfo CurrentUICulture { get { return CultureInfo.CurrentUICulture; } }
    public override void SetShouldExit(int code) { ExitRequested = true; ExitCode = code; }
    public override void EnterNestedPrompt() { throw new InvalidOperationException("Nested prompts are unavailable."); }
    public override void ExitNestedPrompt() { }
    public override void NotifyBeginApplication() { }
    public override void NotifyEndApplication() { }
}

public sealed class UmiParentGuard : IDisposable {
    private readonly Process parent;
    private readonly Timer timer;
    private readonly IntPtr job;
    [StructLayout(LayoutKind.Sequential)] private struct BasicLimits {
        public long ProcessTime, JobTime;
        public uint Flags;
        public UIntPtr MinWorkingSet, MaxWorkingSet;
        public uint ActiveProcesses;
        public UIntPtr Affinity;
        public uint Priority, Scheduling;
    }
    [StructLayout(LayoutKind.Sequential)] private struct IoCounters {
        public ulong ReadOperations, WriteOperations, OtherOperations, ReadBytes, WriteBytes, OtherBytes;
    }
    [StructLayout(LayoutKind.Sequential)] private struct ExtendedLimits {
        public BasicLimits Basic;
        public IoCounters Io;
        public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
    }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool SetInformationJobObject(IntPtr job, int kind, ref ExtendedLimits limits, int length);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")] private static extern bool TerminateJobObject(IntPtr job, uint exitCode);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
    public UmiParentGuard(int parentPid) {
        parent = Process.GetProcessById(parentPid);
        job = CreateJobObject(IntPtr.Zero, null);
        var limits = new ExtendedLimits();
        limits.Basic.Flags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if (job == IntPtr.Zero || !SetInformationJobObject(job, 9, ref limits, Marshal.SizeOf(limits)) || !AssignProcessToJobObject(job, Process.GetCurrentProcess().Handle)) {
            int error = Marshal.GetLastWin32Error();
            if (job != IntPtr.Zero) CloseHandle(job);
            parent.Dispose();
            throw new System.ComponentModel.Win32Exception(error, "Unable to protect the background command process tree.");
        }
        timer = new Timer(Check, null, 1000, 1000);
    }
    private void Check(object ignored) {
        bool exited;
        try { exited = parent.HasExited; } catch { exited = true; }
        if (!exited) return;
        TerminateJobObject(job, 0);
    }
    public void Dispose() { timer.Dispose(); parent.Dispose(); CloseHandle(job); }
}
'@

$parentGuard = New-Object UmiParentGuard($ParentPid)
$sessionHost = New-Object UmiHost
# Use the built-in cmdlet's full parameter binding, with a quiet default only.
# Unlike PSDefaultParameterValues, this does not conflict with -NoNewWindow.
$startMetadata = New-Object System.Management.Automation.CommandMetadata (Get-Command Microsoft.PowerShell.Management\Start-Process)
$startProxy = [System.Management.Automation.ProxyCommand]::Create($startMetadata)
$startProxy = $startProxy.Replace('$outBuffer = $null', @'
if (-not $PSBoundParameters.ContainsKey('WindowStyle') -and -not $PSBoundParameters.ContainsKey('NoNewWindow')) {
            $PSBoundParameters['WindowStyle'] = [System.Diagnostics.ProcessWindowStyle]::Hidden
        }
        $outBuffer = $null
'@)
function New-UmiCommandRunspace {
    $initialState = [System.Management.Automation.Runspaces.InitialSessionState]::CreateDefault()
    $initialState.Commands.Add((New-Object System.Management.Automation.Runspaces.SessionStateFunctionEntry 'Start-Process', $startProxy))
    $space = [runspacefactory]::CreateRunspace($sessionHost, $initialState)
    $space.Open()
    $space.SessionStateProxy.SetVariable('OutputEncoding', $utf8)
    return $space
}
$runspace = New-UmiCommandRunspace
$protocolOut.WriteLine('{"ready":true}')
$protocolOut.Flush()
try {
    while ($null -ne ($line = [Console]::ReadLine())) {
        if (-not $line) { continue }
        $request = $line | ConvertFrom-Json
        $sessionHost.ConsoleUI.Output.Clear()
        $sessionHost.ConsoleUI.Error.Clear()
        $sessionHost.ExitRequested = $false
        $sessionHost.ExitCode = 0
        $pipeline = [powershell]::Create()
        $pipeline.Runspace = $runspace
        $exitCode = 0
        $oldOutput = [Console]::Out
        $oldError = [Console]::Error
        try {
            [Console]::SetOut($sessionHost.ConsoleUI.Output)
            [Console]::SetError($sessionHost.ConsoleUI.Error)
            $runspace.SessionStateProxy.Path.SetLocation([string]$request.cwd) | Out-Null
            $runspace.SessionStateProxy.SetVariable('LASTEXITCODE', 0)
            # Out-Default can let native executables inherit the protocol pipe.
            # A real formatting pipeline forces stdout through the capture writer.
            $null = $pipeline.AddScript([string]$request.command, $false).AddCommand('Out-String').AddParameter('Stream').AddCommand('ForEach-Object').AddParameter('Process', [scriptblock]::Create('[Console]::WriteLine($_)'))
            $null = $pipeline.Invoke()
            $nativeExit = $runspace.SessionStateProxy.GetVariable('LASTEXITCODE')
            if ($sessionHost.ExitRequested) { $exitCode = $sessionHost.ExitCode }
            elseif ($nativeExit) { $exitCode = [int]$nativeExit }
            elseif (@($pipeline.Streams.Error | Where-Object { $_.FullyQualifiedErrorId -notmatch '^NativeCommandError' }).Count -gt 0) { $exitCode = 1 }
        } catch {
            $exitCode = 1
            $sessionHost.ConsoleUI.Error.WriteLine($_.Exception.Message)
        } finally {
            [Console]::SetOut($oldOutput)
            [Console]::SetError($oldError)
        }
        foreach ($record in $pipeline.Streams.Error) { $sessionHost.ConsoleUI.Error.WriteLine($record.ToString()) }
        $response = @{ id = $request.id; exit_code = $exitCode; timed_out = $false; stdout = $sessionHost.ConsoleUI.Output.ToString(); stderr = $sessionHost.ConsoleUI.Error.ToString() }
        $pipeline.Dispose()
        $protocolOut.WriteLine(($response | ConvertTo-Json -Compress -Depth 4))
        $protocolOut.Flush()
        if ($sessionHost.ExitRequested -or $runspace.RunspaceStateInfo.State -ne 'Opened') {
            $runspace.Dispose()
            $runspace = New-UmiCommandRunspace
        }
    }
} finally {
    $runspace.Dispose()
    $parentGuard.Dispose()
}
