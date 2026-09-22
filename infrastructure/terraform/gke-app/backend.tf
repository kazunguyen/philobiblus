terraform {
  backend "gcs" {
    prefix = "philobiblus/gke-app"
  }
}
