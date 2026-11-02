param(
  [string]$HostIp = '185.110.188.173',
  [string]$SshKey = "$HOME\.ssh\private-key-file.pem"
)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
if (!(Test-Path $SshKey)) { throw "SSH key not found: $SshKey" }
$sshArgs = @('-i', $SshKey, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15')
$target = "deploy@$HostIp"
$env:E2E_BASE_URL = 'http://127.0.0.1:18080'
$env:E2E_API_URL = "$env:E2E_BASE_URL/api"
$env:E2E_ISOLATED = '1'
$env:E2E_PHONE = '09120000981'
$env:E2E_SALON_SLUG = 'e2e-playwright-salon'
$env:E2E_CUSTOMER_PHONE = '09120000981'
$env:E2E_BARBER_PHONE = '09120000982'
$env:E2E_SALON_NAME = 'E2E Test Salon'
$env:E2E_BARBER_NAME = 'E2E Barber'
$env:E2E_SERVICE_NAME = 'E2E Haircut'
$env:CI = '1'
$specs = @(
  'auth.spec.ts',
  'booking-browser-actions.spec.ts',
  'booking-multitenant.spec.ts',
  'booking-security.spec.ts',
  'booking.spec.ts',
  'staging-readonly.spec.ts',
  'tenant-browser.spec.ts',
  'tenant-registration.spec.ts'
)
Write-Host 'Uploading E2E-only reset script...'
& scp @sshArgs 'deploy/reset-e2e-isolated.sh' "${target}:barbershop-e2e/reset-e2e-isolated.sh"
if ($LASTEXITCODE -ne 0) { throw 'E2E reset script upload failed' }
$tunnel = Start-Process -FilePath 'ssh' -ArgumentList ($sshArgs + @('-N','-o','ExitOnForwardFailure=yes','-L','18080:127.0.0.1:18080',$target)) -PassThru -WindowStyle Hidden
$results = @()
try {
  Start-Sleep -Seconds 3
  if ($tunnel.HasExited) { throw 'SSH tunnel failed to start' }
  foreach ($spec in $specs) {
    Write-Host "=== Isolated reset before $spec ==="
    & ssh @sshArgs $target 'bash /home/deploy/barbershop-e2e/reset-e2e-isolated.sh'
    if ($LASTEXITCODE -ne 0) { throw "Isolated reset failed for $spec. Stopping regression." }
    Write-Host "=== Running $spec ==="
    & pnpm exec playwright test "e2e/$spec" --workers=1 --retries=0 --reporter=list
    $code = $LASTEXITCODE
    $results += [pscustomobject]@{ Spec=$spec; ExitCode=$code }
  }
} finally {
  if ($tunnel -and !$tunnel.HasExited) { Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue }
  $results | Format-Table -AutoSize
  $results | ConvertTo-Json | Set-Content -Path 'e2e-regression-results.json' -Encoding utf8
}
if (($results | Where-Object ExitCode -ne 0).Count -gt 0) { exit 1 }
Write-Host 'ALL E2E SUITES PASSED'
