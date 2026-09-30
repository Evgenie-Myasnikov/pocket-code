using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

// The launcher alone owns this handle. Windows closes the entire process tree
// even if the console is closed before a PowerShell finally block can execute.
public sealed class PocketCodeOwnedHost : IDisposable {
    IntPtr job, initial;
    public int ProcessId { get; private set; }
    [StructLayout(LayoutKind.Sequential)] struct BasicLimits {
        public long ProcessTime, JobTime; public uint Flags;
        public UIntPtr MinimumWorkingSet, MaximumWorkingSet; public uint ActiveProcessLimit;
        public UIntPtr Affinity; public uint PriorityClass, SchedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)] struct IoCounters { public ulong ReadOps, WriteOps, OtherOps, ReadBytes, WriteBytes, OtherBytes; }
    [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits {
        public BasicLimits Basic; public IoCounters Io;
        public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
    }
    [StructLayout(LayoutKind.Sequential)] struct Accounting {
        public long UserTime, KernelTime, PeriodUserTime, PeriodKernelTime;
        public uint PageFaults, TotalProcesses, ActiveProcesses, TerminatedProcesses;
    }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct StartupInfo {
        public uint cb; public IntPtr Reserved, Desktop, Title;
        public uint X, Y, XSize, YSize, XChars, YChars, Fill, Flags;
        public ushort ShowWindow, ReservedBytes; public IntPtr Reserved2, Input, Output, Error;
    }
    [StructLayout(LayoutKind.Sequential)] struct StartupInfoEx { public StartupInfo Info; public IntPtr Attributes; }
    [StructLayout(LayoutKind.Sequential)] struct ProcessInformation { public IntPtr Process, Thread; public uint ProcessId, ThreadId; }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int type, ref ExtendedLimits value, uint length);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int type, out Accounting value, uint length, IntPtr returned);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list, int count, int flags, ref IntPtr size);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list, uint flags, IntPtr attribute, IntPtr value, IntPtr size, IntPtr previous, IntPtr returned);
    [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcessW(string app, StringBuilder command, IntPtr processAttributes, IntPtr threadAttributes, bool inherit, uint flags, IntPtr environment, string directory, ref StartupInfoEx startup, out ProcessInformation info);
    [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, uint id);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool IsProcessInJob(IntPtr process, IntPtr job, out bool result);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process, out uint code);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    static void Check(bool ok) { if(!ok) throw new Win32Exception(Marshal.GetLastWin32Error()); }
    public static PocketCodeOwnedHost Start(string executable, string arguments, string directory) {
        var owner=new PocketCodeOwnedHost(); IntPtr attributes=IntPtr.Zero, value=IntPtr.Zero; bool initialized=false;
        try {
            owner.job=CreateJobObject(IntPtr.Zero,null); Check(owner.job!=IntPtr.Zero);
            var limits=new ExtendedLimits(); limits.Basic.Flags=0x2000; // KILL_ON_JOB_CLOSE; never allow breakaway.
            Check(SetInformationJobObject(owner.job,9,ref limits,(uint)Marshal.SizeOf(typeof(ExtendedLimits))));
            IntPtr size=IntPtr.Zero; InitializeProcThreadAttributeList(IntPtr.Zero,1,0,ref size);
            attributes=Marshal.AllocHGlobal(size); Check(InitializeProcThreadAttributeList(attributes,1,0,ref size)); initialized=true;
            value=Marshal.AllocHGlobal(IntPtr.Size); Marshal.WriteIntPtr(value,owner.job);
            // Atomic job assignment prevents an orphan between CreateProcess and assignment.
            Check(UpdateProcThreadAttribute(attributes,0,new IntPtr(0x0002000D),value,new IntPtr(IntPtr.Size),IntPtr.Zero,IntPtr.Zero));
            var startup=new StartupInfoEx(); startup.Info.cb=(uint)Marshal.SizeOf(typeof(StartupInfoEx)); startup.Attributes=attributes;
            ProcessInformation info;
            Check(CreateProcessW(executable,new StringBuilder("\""+executable+"\" "+arguments),IntPtr.Zero,IntPtr.Zero,false,0x00080000,IntPtr.Zero,directory,ref startup,out info));
            owner.initial=info.Process; owner.ProcessId=(int)info.ProcessId; CloseHandle(info.Thread);
            return owner;
        } catch { owner.Dispose(); throw; }
        finally { if(initialized)DeleteProcThreadAttributeList(attributes); if(attributes!=IntPtr.Zero)Marshal.FreeHGlobal(attributes); if(value!=IntPtr.Zero)Marshal.FreeHGlobal(value); }
    }
    public bool Contains(int pid) {
        if(job==IntPtr.Zero||pid<=0)return false;
        var process=OpenProcess(0x1000,false,(uint)pid); if(process==IntPtr.Zero)return false;
        try { bool inside; uint code; return IsProcessInJob(process,job,out inside)&&inside&&GetExitCodeProcess(process,out code)&&code==259; }
        finally { CloseHandle(process); }
    }
    public uint ActiveCount { get { if(job==IntPtr.Zero)return 0; Accounting info; Check(QueryInformationJobObject(job,1,out info,(uint)Marshal.SizeOf(typeof(Accounting)),IntPtr.Zero)); return info.ActiveProcesses; } }
    public int ExitCode { get { uint code; return initial!=IntPtr.Zero&&GetExitCodeProcess(initial,out code)&&code!=259?(int)code:0; } }
    public void Dispose() { if(job!=IntPtr.Zero){CloseHandle(job);job=IntPtr.Zero;}if(initial!=IntPtr.Zero){CloseHandle(initial);initial=IntPtr.Zero;}GC.SuppressFinalize(this); }
    ~PocketCodeOwnedHost(){Dispose();}
}
