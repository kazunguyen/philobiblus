terraform {
  backend "gcs" {
    prefix = "philobiblus/gke-platform"
  }
}
