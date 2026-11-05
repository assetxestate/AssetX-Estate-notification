' Start the image worker (scripts/image-worker.mjs) with no window. Log: .local\image-worker.log
' Auto-start at Windows sign-in: press Win+R, type shell:startup, and put a shortcut to this file in that folder.
' A second copy will not start while one is running (lock file in .local).
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
rootDir = fso.GetParentFolderName(scriptDir)
nodeExe = "C:\Program Files\nodejs\node.exe"
If Not fso.FileExists(nodeExe) Then nodeExe = "node.exe"
scriptPath = scriptDir & "\image-worker.mjs"
cmd = """" & nodeExe & """ """ & scriptPath & """ --log"

Set service = GetObject("winmgmts:\\.\root\cimv2")
Set startup = service.Get("Win32_ProcessStartup").SpawnInstance_
startup.ShowWindow = 0
result = service.Get("Win32_Process").Create(cmd, rootDir, startup, processId)
WScript.Quit result
