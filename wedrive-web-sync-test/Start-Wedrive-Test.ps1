$ErrorActionPreference = 'Stop'
$testRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$testUrl = 'http://127.0.0.1:8787/'
$statusUrl = $testUrl + 'api/status'
$nodeProcess = $null

Set-Location -LiteralPath $testRoot

try {
    $existingStatus = Invoke-RestMethod -Uri $statusUrl -TimeoutSec 2
    Write-Host '微盤測試後端已在執行。' -ForegroundColor Green
    Start-Process $testUrl
    exit 0
} catch {
    # 預期行為：尚未啟動時繼續。
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    Write-Host '找不到 Node.js，無法啟動微盤測試後端。' -ForegroundColor Red
    Read-Host '按 Enter 關閉'
    exit 1
}

if (-not (Test-Path -LiteralPath (Join-Path $testRoot '.env'))) {
    Write-Host '提示：尚未找到 .env，服務會啟動，但要設定微盤憑證後才能連線。' -ForegroundColor Yellow
    Write-Host '可參考 .env.example 建立 .env，切勿將真實 Secret 提交到 Git。' -ForegroundColor Yellow
}

try {
    $nodeProcess = Start-Process `
        -FilePath $nodeCommand.Source `
        -ArgumentList '--env-file-if-exists=.env', 'server.mjs' `
        -WorkingDirectory $testRoot `
        -WindowStyle Hidden `
        -PassThru

    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
        if ($nodeProcess.HasExited) {
            throw "後端過早結束，結束碼 $($nodeProcess.ExitCode)。"
        }
        try {
            $status = Invoke-RestMethod -Uri $statusUrl -TimeoutSec 1
            $ready = $true
            break
        } catch {
            Start-Sleep -Milliseconds 200
        }
    }

    if (-not $ready) {
        throw '後端未在預期時間內就緒。'
    }

    Write-Host ''
    Write-Host "微盤 WEB 同步驗證頁：$testUrl" -ForegroundColor Green
    if ($status.configured) {
        Write-Host '後端憑證設定完整。' -ForegroundColor Green
    } else {
        Write-Host '後端已啟動，但 .env 尚未提供完整憑證。' -ForegroundColor Yellow
    }
    Start-Process $testUrl
    Write-Host ''
    Read-Host '按 Enter 停止後端並關閉此視窗'
} catch {
    Write-Host "啟動失敗：$($_.Exception.Message)" -ForegroundColor Red
    Read-Host '按 Enter 關閉'
    exit 1
} finally {
    if ($nodeProcess -and -not $nodeProcess.HasExited) {
        Stop-Process -Id $nodeProcess.Id
    }
}
