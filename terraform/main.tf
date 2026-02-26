terraform {
  required_providers {
    kestra = {
      source  = "kestra-io/kestra"
      version = "~> 0.18"
    }
  }
}

provider "kestra" {
  url      = var.kestra_url
  username = var.kestra_username
  password = var.kestra_password
}
