param(
    [Parameter(Mandatory=$true)]
    [string]$Path
)

$bytes = [System.IO.File]::ReadAllBytes($Path)
if ($bytes.Length -lt 512) { throw "File is too small to be a valid PE executable." }

$peOffset = [BitConverter]::ToInt32($bytes, 0x3C)
if ($peOffset -lt 0 -or ($peOffset + 94) -ge $bytes.Length) { throw "Invalid PE header offset." }
if ($bytes[$peOffset] -ne 0x50 -or $bytes[$peOffset + 1] -ne 0x45) { throw "PE signature not found." }

$optionalHeaderOffset = $peOffset + 24
$magic = [BitConverter]::ToUInt16($bytes, $optionalHeaderOffset)
if ($magic -ne 0x20B -and $magic -ne 0x10B) { throw ("Unexpected PE optional-header magic: 0x{0:X}" -f $magic) }

$subsystemOffset = $optionalHeaderOffset + 68
$current = [BitConverter]::ToUInt16($bytes, $subsystemOffset)
Write-Host "Current PE subsystem: $current"

# IMAGE_SUBSYSTEM_WINDOWS_GUI = 2
$replacement = [BitConverter]::GetBytes([UInt16]2)
$bytes[$subsystemOffset] = $replacement[0]
$bytes[$subsystemOffset + 1] = $replacement[1]
[System.IO.File]::WriteAllBytes($Path, $bytes)
Write-Host "Updated PE subsystem to 2 (Windows GUI)."
