# Permite que el teléfono llegue al backend (puerto 4000) a través del Firewall de Windows.
# Ejecutar en PowerShell COMO ADMINISTRADOR:   powershell -File scripts/firewall-windows.ps1
param([int]$Puerto = 4000)
$nombre = "Consulta Ciudadano API ($Puerto)"
if (Get-NetFirewallRule -DisplayName $nombre -ErrorAction SilentlyContinue) {
  Write-Host "La regla '$nombre' ya existe."
} else {
  New-NetFirewallRule -DisplayName $nombre -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Puerto -Profile Private | Out-Null
  Write-Host "Regla creada: permite conexiones entrantes al puerto $Puerto en redes PRIVADAS."
}
Write-Host "Si su Wi-Fi está marcada como 'Pública', cámbiela a 'Privada' en Configuración > Red e Internet."
