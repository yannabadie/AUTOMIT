variable "kestra_url" {
  description = "Kestra API URL"
  type        = string
  default     = "http://localhost:8080"
}

variable "kestra_username" {
  description = "Kestra basic auth username"
  type        = string
  default     = "yann.abadie@motherson-mas.com"
}

variable "kestra_password" {
  description = "Kestra basic auth password"
  type        = string
  sensitive   = true
}
