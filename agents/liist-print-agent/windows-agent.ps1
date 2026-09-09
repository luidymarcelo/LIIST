param(
  [Parameter(Mandatory = $true)]
  [string]$SupabaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$SupabaseAnonKey,

  [Parameter(Mandatory = $true)]
  [string]$AgentToken,

  [string]$PrinterName = "",

  [string]$OutputDir = "print-outbox",

  [int]$IntervalSeconds = 4
)

$ErrorActionPreference = "Stop"
$SupabaseUrl = $SupabaseUrl.TrimEnd("/")
$Headers = @{
  "apikey" = $SupabaseAnonKey
  "Authorization" = "Bearer $SupabaseAnonKey"
  "Content-Type" = "application/json"
}

function Invoke-LiistRpc {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][hashtable]$Body
  )

  $json = $Body | ConvertTo-Json -Depth 20
  Invoke-RestMethod -Method Post -Uri "$SupabaseUrl/rest/v1/rpc/$Name" -Headers $Headers -Body $json
}

function Format-LiistMoney {
  param([decimal]$Value)
  return ("R$ {0:N2}" -f $Value)
}

function Get-LiistText {
  param($Value)
  if ($null -eq $Value) { return "" }
  return [string]$Value
}

function Get-LiistNumber {
  param($Value)
  if ($null -eq $Value) { return [decimal]0 }
  return [decimal]::Parse(([string]$Value).Replace(",", "."), [Globalization.CultureInfo]::InvariantCulture)
}

function New-LiistTicketText {
  param([Parameter(Mandatory = $true)]$Payload)

  $lines = New-Object System.Collections.Generic.List[string]
  $companyName = Get-LiistText $Payload.company.name
  $storeName = Get-LiistText $Payload.store.name
  $orderCode = Get-LiistText $Payload.order_code
  $createdAt = Get-LiistText $Payload.created_at

  $lines.Add($companyName.ToUpperInvariant())
  $lines.Add($storeName)
  $lines.Add("--------------------------------")
  $lines.Add("Comanda: $orderCode")

  if ($null -ne $Payload.table) {
    $tableName = Get-LiistText $Payload.table.name
    if ([string]::IsNullOrWhiteSpace($tableName)) { $tableName = Get-LiistText $Payload.table.code }
    if (-not [string]::IsNullOrWhiteSpace($tableName)) { $lines.Add("Mesa: $tableName") }
  }

  $customerName = Get-LiistText $Payload.customer_name
  if (-not [string]::IsNullOrWhiteSpace($customerName)) { $lines.Add("Cliente: $customerName") }

  $createdByName = Get-LiistText $Payload.created_by_name
  if (-not [string]::IsNullOrWhiteSpace($createdByName)) { $lines.Add("Lancado por: $createdByName") }

  if (-not [string]::IsNullOrWhiteSpace($createdAt)) {
    try {
      $lines.Add("Horario: $([datetime]$createdAt).ToLocalTime().ToString('dd/MM/yyyy HH:mm')")
    } catch {
      $lines.Add("Horario: $createdAt")
    }
  }

  $lines.Add("--------------------------------")
  $totalAdditions = [decimal]0

  foreach ($item in @($Payload.items)) {
    $quantity = Get-LiistNumber $item.quantity
    $unitPrice = Get-LiistNumber $item.unit_price
    $itemTotal = Get-LiistNumber $item.total
    $quantityLabel = if ($quantity -eq [decimal]::Truncate($quantity)) { "{0:N0}" -f $quantity } else { ("{0:N3}" -f $quantity).TrimEnd("0").TrimEnd(",") }

    $lines.Add("$quantityLabel x $(Get-LiistText $item.product_name)")
    $lines.Add("  $(Format-LiistMoney $unitPrice)  Total $(Format-LiistMoney $itemTotal)")

    foreach ($option in @($item.selected_options)) {
      $priceDelta = Get-LiistNumber $option.price_delta
      $totalAdditions += $priceDelta * $quantity
      $groupName = Get-LiistText $option.group_name
      $itemName = Get-LiistText $option.item_name
      if (-not [string]::IsNullOrWhiteSpace($groupName)) {
        $lines.Add("  + ${groupName}: $itemName $(Format-LiistMoney $priceDelta)")
      } else {
        $lines.Add("  + $itemName $(Format-LiistMoney $priceDelta)")
      }
    }
  }

  $lines.Add("--------------------------------")
  if ($totalAdditions -gt 0) {
    $lines.Add("Adicionais: $(Format-LiistMoney $totalAdditions)")
  }
  $lines.Add("TOTAL: $(Format-LiistMoney (Get-LiistNumber $Payload.total))")

  $notes = Get-LiistText $Payload.notes
  if (-not [string]::IsNullOrWhiteSpace($notes)) {
    $lines.Add("--------------------------------")
    $lines.Add("Observacao:")
    $lines.Add($notes)
  }

  $lines.Add("--------------------------------")
  $lines.Add("LIIST")
  return ($lines -join [Environment]::NewLine)
}

function Send-LiistPrint {
  param([Parameter(Mandatory = $true)][string]$Path)

  if ([string]::IsNullOrWhiteSpace($PrinterName)) {
    Start-Process -FilePath $Path -Verb Print -Wait -WindowStyle Hidden
    return
  }

  if (Get-Command Get-Printer -ErrorAction SilentlyContinue) {
    $printer = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
    if ($null -eq $printer) {
      throw "Impressora '$PrinterName' nao encontrada. Rode .\windows-list-printers.ps1 e copie o nome exato."
    }
  }

  Start-Process -FilePath "$env:WINDIR\System32\notepad.exe" -ArgumentList @("/pt", $Path, $PrinterName) -Wait -WindowStyle Hidden
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

if ($PrinterName) {
  Write-Host "LIIST Print Agent iniciado. Impressora: $PrinterName"
} else {
  Write-Host "LIIST Print Agent iniciado. Sem impressora definida: vai usar a impressora padrao do Windows."
}
Write-Host "Pasta das comandas: $((Resolve-Path $OutputDir).Path)"
Write-Host "Pressione Ctrl+C para parar."

while ($true) {
  try {
    $claim = Invoke-LiistRpc -Name "claim_next_print_job" -Body @{
      p_token = $AgentToken
      p_agent_name = $env:COMPUTERNAME
    }

    if ($null -ne $claim.job_id -and -not [string]::IsNullOrWhiteSpace([string]$claim.job_id)) {
      $fileName = "$($claim.job_id).txt"
      $filePath = Join-Path $OutputDir $fileName
      $ticket = New-LiistTicketText -Payload $claim.payload
      Set-Content -Path $filePath -Value $ticket -Encoding UTF8

      try {
        Send-LiistPrint -Path (Resolve-Path $filePath).Path
        Invoke-LiistRpc -Name "complete_print_job" -Body @{
          p_token = $AgentToken
          p_job_id = $claim.job_id
          p_success = $true
          p_error = $null
        } | Out-Null
        Write-Host "Comanda $($claim.payload.order_code) impressa em $filePath"
      } catch {
        Invoke-LiistRpc -Name "complete_print_job" -Body @{
          p_token = $AgentToken
          p_job_id = $claim.job_id
          p_success = $false
          p_error = $_.Exception.Message
        } | Out-Null
        Write-Host "Falha ao imprimir: $($_.Exception.Message)" -ForegroundColor Red
      }
    }
  } catch {
    Write-Host "Erro no agente: $($_.Exception.Message)" -ForegroundColor Yellow
  }

  Start-Sleep -Seconds $IntervalSeconds
}
