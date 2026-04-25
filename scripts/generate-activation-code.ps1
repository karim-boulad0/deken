param(
  [Parameter(Mandatory = $true)]
  [string]$MachineCode
)

$normalized = ($MachineCode.Trim().ToUpper() -replace '\s+', '')
if ($normalized.Length -ne 12) {
  throw "MachineCode must be 12 characters (from app activation screen)."
}

$secret = "deken-local-license-v1"
$keyBytes = [System.Text.Encoding]::UTF8.GetBytes($secret)
$dataBytes = [System.Text.Encoding]::UTF8.GetBytes($normalized)
$hmac = [System.Security.Cryptography.HMACSHA256]::new($keyBytes)
$hashBytes = $hmac.ComputeHash($dataBytes)
$hmac.Dispose()
$hex = -join ($hashBytes | ForEach-Object { $_.ToString("x2") })
$sig = $hex.Substring(0, 6).ToUpper()
$code = "DEKEN-$normalized-$sig"

Write-Output $code
