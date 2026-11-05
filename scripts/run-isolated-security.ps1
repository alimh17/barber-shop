$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$sshArgs = @('-i', "$HOME\.ssh\private-key-file.pem", '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15')
$target = 'deploy@185.110.188.173'
$env:E2E_BASE_URL = 'http://127.0.0.1:18080'
$env:E2E_API_URL = "$env:E2E_BASE_URL/api"
$env:E2E_ISOLATED = '1'
$env:CI = '1'
$tunnel = Start-Process -FilePath ssh -ArgumentList ($sshArgs + @('-N','-o','ExitOnForwardFailure=yes','-L','18080:127.0.0.1:18080',$target)) -PassThru -WindowStyle Hidden
try {
  Start-Sleep -Seconds 3
  if ($tunnel.HasExited) { throw 'SSH tunnel failed' }
  & ssh @sshArgs $target 'bash /home/deploy/barbershop-e2e/reset-e2e-isolated.sh'
  if ($LASTEXITCODE -ne 0) { throw 'E2E-only reset failed' }
  & pnpm exec playwright test e2e/security-hardening.spec.ts --workers=1 --retries=0 --reporter=list
  $result = $LASTEXITCODE
  Write-Host "SECURITY_SUITE_EXIT_CODE=$result"
  exit $result
} finally {
  if ($tunnel -and !$tunnel.HasExited) { Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue }
}
