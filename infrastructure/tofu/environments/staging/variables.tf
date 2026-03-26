variable "vsphere_user" {
  type    = string
  default = "bot_athene@vsphere.local"
}

variable "vsphere_password" {
  type      = string
  sensitive = true
}

variable "vsphere_server" {
  type    = string
  default = "dvsp01p.ip413.de"
}
