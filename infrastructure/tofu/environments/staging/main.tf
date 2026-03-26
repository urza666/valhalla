# =============================================================================
# Valhalla — Staging VM (DEV Environment)
# =============================================================================
# Host: dval01e.infra.ip413.de (192.168.0.193)
#
# Sizing:
#   2 vCPU   — API + Gateway + Frontend
#   4 GB RAM — PostgreSQL + Redis + NATS + API + Web
#   50 GB    — OS Disk (includes Docker images + DB data)
# =============================================================================

module "dval01e" {
  source = "../../modules/vsphere-vm"

  hostname     = "dval01e"
  folder       = "DEV"
  ipv4_address = "192.168.0.193"
  datastore    = "desx01p-ds-2TB-02"

  cpu       = 2
  memory_mb = 4096

  disk_os_gb   = 50
  disk_data_gb = 0  # No separate data disk for staging
}

# =============================================================================
# Outputs
# =============================================================================

output "dval01e_fqdn" {
  value = module.dval01e.vm_fqdn
}

output "dval01e_ip" {
  value = module.dval01e.vm_ip
}
