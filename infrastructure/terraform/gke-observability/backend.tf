terraform {
  backend "gcs" {
    prefix = "philobiblus/gke-observability"
  }
}
