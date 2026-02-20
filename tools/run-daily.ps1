Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function ConvertFrom-SecureStringToPlain([Security.SecureString]$secure) {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Write-Utf8NoBomNoNewline([string]$path, [string]$value) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($path, $value, $utf8NoBom)
}

function Parse-PositiveInt([string]$name, [string]$raw) {
  $value = 0
  if (-not [int]::TryParse($raw, [ref]$value) -or $value -le 0) {
    throw "$name must be an integer greater than 0"
  }
  return $value
}

function Parse-IndexList([string]$raw, [int]$count) {
  $items = $raw.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
  if ($items.Count -eq 0) {
    throw "Select at least one index"
  }

  $result = New-Object System.Collections.Generic.List[int]
  foreach ($item in $items) {
    $index = 0
    if (-not [int]::TryParse($item, [ref]$index)) {
      throw "Invalid index: $item"
    }
    if ($index -lt 0 -or $index -ge $count) {
      throw "Index out of range: $index"
    }
    if (-not $result.Contains($index)) {
      $result.Add($index)
    }
  }
  return $result.ToArray()
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$encPathInput = (Read-Host "Wallet enc path [secrets/wallet.enc]").Trim()
$encPath = if ($encPathInput) { $encPathInput } else { "secrets/wallet.enc" }
$env:WALLET_ENC_PATH = $encPath

$pattern = (Read-Host "RUN_PATTERN (1/2/3)").Trim()
if ($pattern -notin @("1", "2", "3")) {
  throw "RUN_PATTERN must be 1, 2, or 3"
}

$jsonLines = npm run -s list-addresses -- --json
if ($LASTEXITCODE -ne 0) {
  throw "list-addresses command failed"
}

$addresses = @(($jsonLines -join "") | ConvertFrom-Json)
if ($addresses.Count -eq 0) {
  throw "No addresses found in wallet.enc"
}

Write-Host "Available addresses:"
foreach ($entry in $addresses) {
  Write-Host ("{0}: {1}" -f $entry.index, $entry.address)
}

$selectedAddresses = @()
$targetAddresses = ""

if ($pattern -eq "1") {
  $rawIndex = (Read-Host "Select one index").Trim()
  $idx = 0
  if (-not [int]::TryParse($rawIndex, [ref]$idx)) {
    throw "Invalid index: $rawIndex"
  }
  if ($idx -lt 0 -or $idx -ge $addresses.Count) {
    throw "Index out of range: $idx"
  }
  $selectedAddresses = @($addresses[$idx].address)
  $targetAddresses = $selectedAddresses[0]
} else {
  $rawSelection = (Read-Host "Select indices (ALL or comma list like 1,3)").Trim()
  if ($rawSelection.ToUpperInvariant() -eq "ALL") {
    $targetAddresses = "ALL"
    $selectedAddresses = @($addresses | ForEach-Object { $_.address })
  } else {
    $indexes = Parse-IndexList $rawSelection $addresses.Count
    $selectedAddresses = @($indexes | ForEach-Object { $addresses[$_].address })
    $targetAddresses = ($selectedAddresses -join ",")
  }
}

$passwordPrompt = if ($pattern -eq "1") { "Wallet password for selected address" } else { "Wallet password for selected addresses" }
$walletPasswordSecure = Read-Host $passwordPrompt -AsSecureString
$sinkAddressSecure = Read-Host "SINK_ADDRESS" -AsSecureString

$walletPassword = ConvertFrom-SecureStringToPlain $walletPasswordSecure
$sinkAddress = ConvertFrom-SecureStringToPlain $sinkAddressSecure

if ([string]::IsNullOrEmpty($walletPassword)) {
  throw "Wallet password is empty"
}
if ([string]::IsNullOrEmpty($sinkAddress)) {
  throw "SINK_ADDRESS is empty"
}

$everyMinutes = $null
$jitterSeconds = $null
if ($pattern -eq "3") {
  $everyMinutes = Parse-PositiveInt "SCHEDULE_EVERY_MINUTES" (Read-Host "SCHEDULE_EVERY_MINUTES (>0)")
  $jitterSeconds = Parse-PositiveInt "SCHEDULE_JITTER_SECONDS" (Read-Host "SCHEDULE_JITTER_SECONDS (>0)")
}

$tmpPw = Join-Path $env:TEMP ("tempo_wallet_password_" + [guid]::NewGuid().ToString("n") + ".txt")
$tmpSink = Join-Path $env:TEMP ("tempo_sink_address_" + [guid]::NewGuid().ToString("n") + ".txt")

try {
  Write-Utf8NoBomNoNewline $tmpPw $walletPassword
  Write-Utf8NoBomNoNewline $tmpSink $sinkAddress

  if (Test-Path Env:WALLET_PASSWORD) { Remove-Item Env:WALLET_PASSWORD }
  if (Test-Path Env:SINK_ADDRESS) { Remove-Item Env:SINK_ADDRESS }

  $env:WALLET_PASSWORD_FILE = $tmpPw
  $env:SINK_ADDRESS_FILE = $tmpSink
  $env:RUN_PATTERN = $pattern
  $env:TARGET_ADDRESSES = $targetAddresses

  if ($pattern -eq "3") {
    $env:SCHEDULE_EVERY_MINUTES = [string]$everyMinutes
    $env:SCHEDULE_JITTER_SECONDS = [string]$jitterSeconds
  } else {
    if (Test-Path Env:SCHEDULE_EVERY_MINUTES) { Remove-Item Env:SCHEDULE_EVERY_MINUTES }
    if (Test-Path Env:SCHEDULE_JITTER_SECONDS) { Remove-Item Env:SCHEDULE_JITTER_SECONDS }
  }

  Write-Host ("RUN_PATTERN=" + $env:RUN_PATTERN)
  Write-Host ("TARGET_ADDRESSES=" + $env:TARGET_ADDRESSES)
  Write-Host ("WALLET_ENC_PATH=" + $env:WALLET_ENC_PATH)
  if ($pattern -eq "3") {
    Write-Host ("SCHEDULE_EVERY_MINUTES=" + $env:SCHEDULE_EVERY_MINUTES)
    Write-Host ("SCHEDULE_JITTER_SECONDS=" + $env:SCHEDULE_JITTER_SECONDS)
  }

  npm run run:daily
  if ($LASTEXITCODE -ne 0) {
    throw "npm run run:daily failed (exit=$LASTEXITCODE)"
  }
} finally {
  if (Test-Path $tmpPw) { Remove-Item -Force $tmpPw }
  if (Test-Path $tmpSink) { Remove-Item -Force $tmpSink }
  $walletPassword = $null
  $sinkAddress = $null
  $walletPasswordSecure = $null
  $sinkAddressSecure = $null
}
