# ═══════════════════════════════════════════════════════════
# Valhalla Staging Server — OpenTofu / Terraform
# Provider: vSphere
# Template: AlmaLinux 9
# ═══════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    vsphere = {
      source  = "hashicorp/vsphere"
      version = "~> 2.6"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "~> 3.25"
    }
  }
}

# ─── Vault Provider (reads credentials) ─────────────────
provider "vault" {
  address = var.vault_addr
  token   = var.vault_token
}

# Read vSphere credentials from Vault
data "vault_generic_secret" "vsphere" {
  path = var.vault_vsphere_secret_path
}

# ─── vSphere Provider ───────────────────────────────────
provider "vsphere" {
  user                 = data.vault_generic_secret.vsphere.data["username"]
  password             = data.vault_generic_secret.vsphere.data["password"]
  vsphere_server       = data.vault_generic_secret.vsphere.data["server"]
  allow_unverified_ssl = true
}

# ─── Data Sources ────────────────────────────────────────
data "vsphere_datacenter" "dc" {
  name = var.vsphere_datacenter
}

data "vsphere_compute_cluster" "cluster" {
  name          = var.vsphere_cluster
  datacenter_id = data.vsphere_datacenter.dc.id
}

data "vsphere_datastore" "datastore" {
  name          = var.vsphere_datastore
  datacenter_id = data.vsphere_datacenter.dc.id
}

data "vsphere_network" "network" {
  name          = var.vsphere_network
  datacenter_id = data.vsphere_datacenter.dc.id
}

data "vsphere_virtual_machine" "template" {
  name          = var.vsphere_template
  datacenter_id = data.vsphere_datacenter.dc.id
}

# ─── VM Resource ─────────────────────────────────────────
resource "vsphere_virtual_machine" "staging" {
  name             = "valhalla-staging"
  resource_pool_id = data.vsphere_compute_cluster.cluster.resource_pool_id
  datastore_id     = data.vsphere_datastore.datastore.id
  folder           = var.vsphere_folder

  num_cpus = var.vm_cpus
  memory   = var.vm_memory_mb
  guest_id = data.vsphere_virtual_machine.template.guest_id

  network_interface {
    network_id   = data.vsphere_network.network.id
    adapter_type = data.vsphere_virtual_machine.template.network_interface_types[0]
  }

  disk {
    label            = "disk0"
    size             = var.vm_disk_gb
    thin_provisioned = true
  }

  clone {
    template_uuid = data.vsphere_virtual_machine.template.id

    customize {
      linux_options {
        host_name = "valhalla-staging"
        domain    = var.domain
      }

      network_interface {
        ipv4_address = var.vm_ip
        ipv4_netmask = var.vm_netmask
      }

      ipv4_gateway    = var.vm_gateway
      dns_server_list = var.dns_servers
    }
  }

  tags = []

  lifecycle {
    ignore_changes = [clone]
  }
}

# ─── Outputs ─────────────────────────────────────────────
output "staging_ip" {
  value       = var.vm_ip
  description = "Staging server IP address"
}

output "staging_name" {
  value = vsphere_virtual_machine.staging.name
}
