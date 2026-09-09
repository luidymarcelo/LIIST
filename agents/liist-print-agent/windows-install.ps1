param(
  [Parameter(Mandatory = $true)]
  [string]$SupabaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$SupabaseAnonKey,

  [Parameter(Mandatory = $true)]
  [string]$AgentToken,

  [Parameter(Mandatory = $true)]
  [string]$CompanyName,

  [Parameter(Mandatory = $true)]
  [string]$BranchName,

  [string]$TaskSuffix = "filial",

  [string]$PrinterName = ""
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Write-Step {
  param([Parameter(Mandatory = $true)][string]$Message)
  Write-Host ""
  Write-Host "== $Message ==" -ForegroundColor Cyan
}

function Get-SafeTaskSuffix {
  param([string]$Value)
  $safe = ($Value -replace "[^a-zA-Z0-9_-]+", "-").Trim("-")
  if ([string]::IsNullOrWhiteSpace($safe)) { return "filial" }
  return $safe.ToLowerInvariant()
}

function Get-SingleQuoted {
  param([string]$Value)
  return "'$($Value.Replace("'", "''"))'"
}

function Read-LiistPrinterName {
  param([string]$InitialPrinterName)

  if (-not [string]::IsNullOrWhiteSpace($InitialPrinterName)) {
    return $InitialPrinterName
  }

  Write-Step "Escolha da impressora"
  if (-not (Get-Command Get-Printer -ErrorAction SilentlyContinue)) {
    Write-Host "Este Windows nao possui o comando Get-Printer disponivel."
    Write-Host "Se souber o nome exato da impressora, digite abaixo."
    return Read-Host "Nome da impressora ou Enter para usar a padrao"
  }

  $printers = @(Get-Printer | Sort-Object Name)
  if (-not $printers.Length) {
    Write-Host "Nenhuma impressora instalada foi encontrada."
    Write-Host "O agente sera instalado usando a impressora padrao do Windows."
    return ""
  }

  Write-Host "Impressoras encontradas neste computador:"
  for ($index = 0; $index -lt $printers.Length; $index++) {
    $printer = $printers[$index]
    $defaultMark = ""
    try {
      if ($printer.Name -eq (Get-CimInstance -ClassName Win32_Printer -Filter "Default=True" -ErrorAction SilentlyContinue).Name) {
        $defaultMark = "  [padrao]"
      }
    } catch {
      $defaultMark = ""
    }
    Write-Host ("[{0}] {1}  ({2}){3}" -f ($index + 1), $printer.Name, $printer.DriverName, $defaultMark)
  }

  while ($true) {
    $choice = Read-Host "Digite o numero da impressora ou Enter para usar a impressora padrao"
    if ([string]::IsNullOrWhiteSpace($choice)) { return "" }

    $selectedIndex = 0
    if ([int]::TryParse($choice, [ref]$selectedIndex) -and $selectedIndex -ge 1 -and $selectedIndex -le $printers.Length) {
      return $printers[$selectedIndex - 1].Name
    }

    Write-Host "Opcao invalida. Digite um numero da lista." -ForegroundColor Yellow
  }
}

function Test-LiistPrinter {
  param([string]$Name)
  if ([string]::IsNullOrWhiteSpace($Name)) { return }
  if (-not (Get-Command Get-Printer -ErrorAction SilentlyContinue)) { return }
  $printer = Get-Printer -Name $Name -ErrorAction SilentlyContinue
  if ($null -eq $printer) {
    throw "A impressora '$Name' nao foi encontrada neste computador."
  }
}

$TaskSuffix = Get-SafeTaskSuffix $TaskSuffix
$SupabaseUrl = $SupabaseUrl.TrimEnd("/")
$AgentUrl = "https://raw.githubusercontent.com/luidymarcelo/LIIST/main/agents/liist-print-agent/windows-agent.ps1"
$InstallDir = Join-Path $env:LOCALAPPDATA "LIIST\PrintAgent\$TaskSuffix"
$AgentPath = Join-Path $InstallDir "windows-agent.ps1"
$StartPath = Join-Path $InstallDir "start-liist-print-agent.ps1"
$OutboxDir = Join-Path $InstallDir "print-outbox"
$AgentLog = Join-Path $InstallDir "agent.log"
$ConfigPath = Join-Path $InstallDir "config.txt"
$TaskName = "LIIST Print Agent - $TaskSuffix"

Write-Step "Instalando LIIST Print Agent"
Write-Host "Empresa: $CompanyName"
Write-Host "Filial: $BranchName"
Write-Host "Instalacao por usuario, sem precisar de administrador."

New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
New-Item -ItemType Directory -Path $OutboxDir -Force | Out-Null

Write-Step "Baixando agente oficial"
Invoke-WebRequest -Uri $AgentUrl -OutFile $AgentPath -UseBasicParsing
Unblock-File -Path $AgentPath -ErrorAction SilentlyContinue

$SelectedPrinterName = Read-LiistPrinterName -InitialPrinterName $PrinterName
Test-LiistPrinter -Name $SelectedPrinterName

$PrinterArgument = ""
if (-not [string]::IsNullOrWhiteSpace($SelectedPrinterName)) {
  $PrinterArgument = " -PrinterName $(Get-SingleQuoted $SelectedPrinterName)"
}

$StartContent = @"
`$ErrorActionPreference = "Stop"
`$LogPath = '$($AgentLog.Replace("'", "''"))'
Start-Transcript -Path `$LogPath -Append | Out-Null
try {
  & '$($AgentPath.Replace("'", "''"))' -SupabaseUrl '$($SupabaseUrl.Replace("'", "''"))' -SupabaseAnonKey '$($SupabaseAnonKey.Replace("'", "''"))' -AgentToken '$($AgentToken.Replace("'", "''"))'$PrinterArgument -OutputDir '$($OutboxDir.Replace("'", "''"))' -IntervalSeconds 4
} finally {
  Stop-Transcript | Out-Null
}
"@
Set-Content -Path $StartPath -Value $StartContent -Encoding UTF8
Unblock-File -Path $StartPath -ErrorAction SilentlyContinue

$Config = @(
  "LIIST Print Agent",
  "Empresa: $CompanyName",
  "Filial: $BranchName",
  "Tarefa: $TaskName",
  "Impressora: $(if ([string]::IsNullOrWhiteSpace($SelectedPrinterName)) { 'Padrao do Windows' } else { $SelectedPrinterName })",
  "Pasta: $InstallDir",
  "Comandas: $OutboxDir",
  "Log: $AgentLog"
)
Set-Content -Path $ConfigPath -Value ($Config -join [Environment]::NewLine) -Encoding UTF8

Write-Step "Configurando inicializacao automatica"
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$StartPath`""
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel LeastPrivilege
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null

Write-Step "Iniciando agente"
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 1
$Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Instalacao concluida." -ForegroundColor Green
Write-Host "Tarefa do Windows: $TaskName"
if ($Task) { Write-Host "Status da tarefa: $($Task.State)" }
Write-Host "Impressora: $(if ([string]::IsNullOrWhiteSpace($SelectedPrinterName)) { 'Padrao do Windows' } else { $SelectedPrinterName })"
Write-Host "Pasta: $InstallDir"
Write-Host "Log do agente: $AgentLog"
Write-Host ""
Write-Host "Para testar, gere uma comanda interna para esta filial."
Write-Host "Se algo falhar, abra o arquivo de log acima."
