Set shell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
cmd = "cmd /c """ & scriptDir & "\run-deken.bat"""
' 0 = hidden window, False = do not wait
shell.Run cmd, 0, False
