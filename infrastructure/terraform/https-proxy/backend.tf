terraform {
  backend "gcs" {
    prefix = "philobiblus/https-proxy"
  }
}
