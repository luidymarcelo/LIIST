Get-Printer |
  Sort-Object Name |
  Select-Object Name, DriverName, PortName, Shared, Published |
  Format-Table -AutoSize
