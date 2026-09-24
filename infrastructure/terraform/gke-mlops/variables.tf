variable "project_id" { type = string }
variable "region" {
  type    = string
  default = "asia-southeast1"
}
variable "sql_instance_name" { type = string }
variable "mlops_namespace" {
  type    = string
  default = "philobiblus-mlops"
}
variable "app_namespace" {
  type    = string
  default = "philobiblus"
}
variable "recommendation_gsa_account_id" {
  description = "Existing runtime recommender GSA account id from the app stack."
  type        = string
  default     = "philobiblus-recommend"
}
variable "mlflow_database_url_secret_id" {
  description = "Existing Secret Manager secret containing the MLflow PostgreSQL URI."
  type        = string
}
variable "trainer_database_url_secret_id" {
  description = "Existing Secret Manager secret containing the read-only catalog PostgreSQL URI."
  type        = string
}
