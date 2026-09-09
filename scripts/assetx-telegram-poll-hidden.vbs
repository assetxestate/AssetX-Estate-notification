Set shell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
rootDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(scriptDir)
nodeExe = "C:\Program Files\nodejs\node.exe"
scriptPath = scriptDir & "\assetx-telegram-poll.mjs"
cmd = """" & nodeExe & """ """ & scriptPath & """"
shell.CurrentDirectory = rootDir
shell.Run cmd, 0, False
