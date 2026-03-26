variable "vsphere_user" {
  type    = string
  default = "# Vault: vsphere/user"
}

variable "vsphere_password" {
  type      = string
  sensitive = true
}

variable "vsphere_server" {
  type    = string
  default = "# Vault: vsphere/server"
}
