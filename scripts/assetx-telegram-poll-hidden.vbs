Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
rootDir = fso.GetParentFolderName(scriptDir)
nodeExe = "C:\Program Files\nodejs\node.exe"
scriptPath = scriptDir & "\assetx-telegram-poll.mjs"
cmd = """" & nodeExe & """ """ & scriptPath & """"

Set service = GetObject("winmgmts:\\.\root\cimv2")
Set startup = service.Get("Win32_ProcessStartup").SpawnInstance_
startup.ShowWindow = 0
result = service.Get("Win32_Process").Create(cmd, rootDir, startup, processId)
WScript.Quit result
