locals {
  selector = format("namespace=%q,cluster=%q", var.namespace, var.cluster_name)

  dashboard_widgets = [
    {
      title = "Scrape targets by component"
      query = trimspace(<<-PROMQL
        sum by (component) (up{${local.selector}})
      PROMQL
      )
    },
    {
      title = "Backend HTTP request rate"
      query = trimspace(<<-PROMQL
        sum(rate(http_requests_total{${local.selector},component="backend"}[5m]))
      PROMQL
      )
    },
    {
      title = "Backend HTTP 5xx ratio"
      query = trimspace(<<-PROMQL
        sum(rate(http_requests_total{${local.selector},component="backend",status=~"5.."}[5m])) / clamp_min(sum(rate(http_requests_total{${local.selector},component="backend"}[5m])), 0.001)
      PROMQL
      )
    },
    {
      title = "Backend p95 request duration (seconds)"
      query = trimspace(<<-PROMQL
        histogram_quantile(0.95, sum by (le) (rate(http_request_duration_highr_seconds_bucket{${local.selector},component="backend"}[5m])))
      PROMQL
      )
    },
    {
      title = "Backend rate-limit decisions"
      query = trimspace(<<-PROMQL
        sum by (scope, result) (rate(rate_limit_operations_total{${local.selector},component="backend"}[5m]))
      PROMQL
      )
    },
    {
      title = "Catalogue cache operations"
      query = trimspace(<<-PROMQL
        sum by (operation, result) (rate(catalog_cache_operations_total{${local.selector},component="backend"}[5m]))
      PROMQL
      )
    },
    {
      title = "Recommendation requests by outcome"
      query = trimspace(<<-PROMQL
        sum by (outcome) (rate(philobiblus_recommendation_requests_total{${local.selector},component="recommendation"}[5m]))
      PROMQL
      )
    },
    {
      title = "Recommendation model version"
      query = trimspace(<<-PROMQL
        max by (model_version) (philobiblus_recommendation_model_info{${local.selector},component="recommendation"})
      PROMQL
      )
    },
  ]

  alerts = {
    backend_unavailable = {
      display_name = "Philobiblus ${var.environment}: backend scrape target unavailable"
      query = trimspace(<<-PROMQL
        sum(up{${local.selector},component="backend"}) < 1
      PROMQL
      )
      duration  = "120s"
      severity  = "critical"
      component = "backend"
    }
    backend_high_5xx = {
      display_name = "Philobiblus ${var.environment}: backend HTTP 5xx ratio above 5%"
      query = trimspace(<<-PROMQL
        sum(rate(http_requests_total{${local.selector},component="backend",status=~"5.."}[5m])) / clamp_min(sum(rate(http_requests_total{${local.selector},component="backend"}[5m])), 0.001) > 0.05
      PROMQL
      )
      duration  = "300s"
      severity  = "warning"
      component = "backend"
    }
    backend_rate_limit_rejections = {
      display_name = "Philobiblus ${var.environment}: backend rate-limit rejections sustained"
      query = trimspace(<<-PROMQL
        sum(rate(rate_limit_operations_total{${local.selector},component="backend",result=~".*rejected"}[5m])) > 0.5
      PROMQL
      )
      duration  = "300s"
      severity  = "warning"
      component = "backend"
    }
    backend_rate_limit_redis_error = {
      display_name = "Philobiblus ${var.environment}: backend rate limiter Redis errors"
      query = trimspace(<<-PROMQL
        sum(rate(rate_limit_operations_total{${local.selector},component="backend",result="redis_error"}[5m])) > 0
      PROMQL
      )
      duration  = "120s"
      severity  = "critical"
      component = "backend"
    }
    recommendation_unavailable = {
      display_name = "Philobiblus ${var.environment}: recommendation scrape target unavailable"
      query = trimspace(<<-PROMQL
        sum(up{${local.selector},component="recommendation"}) < 1
      PROMQL
      )
      duration  = "120s"
      severity  = "critical"
      component = "recommendation"
    }
  }
}

resource "google_monitoring_notification_channel" "operations" {
  count = var.enable_alerting ? 1 : 0

  display_name = "Philobiblus ${var.environment} operations"
  type         = "email"
  labels = {
    email_address = var.alert_email
  }
}

resource "google_monitoring_dashboard" "philobiblus" {
  dashboard_json = jsonencode({
    displayName = "Philobiblus ${var.environment} GKE"
    labels = {
      application = "philobiblus"
      environment = var.environment
    }
    gridLayout = {
      columns = "2"
      widgets = [
        for widget in local.dashboard_widgets : {
          title = widget.title
          xyChart = {
            chartOptions = {
              mode = "COLOR"
            }
            dataSets = [{
              timeSeriesQuery = {
                prometheusQuery = widget.query
              }
              plotType = "LINE"
            }]
            yAxis = {
              scale = "LINEAR"
            }
          }
        }
      ]
    }
  })
}

resource "google_monitoring_alert_policy" "philobiblus" {
  # A new Prometheus metric needs to be ingested and indexed by Cloud
  # Monitoring before it can be referenced from an alert policy. Keep the
  # dashboard and established alerts deployable during that interval.
  for_each = var.enable_alerting ? {
    for key, alert in local.alerts : key => alert
    if var.enable_rate_limit_alerts || !contains([
      "backend_rate_limit_rejections",
      "backend_rate_limit_redis_error",
    ], key)
  } : {}

  display_name          = each.value.display_name
  combiner              = "OR"
  notification_channels = [google_monitoring_notification_channel.operations[0].name]

  conditions {
    display_name = each.value.display_name

    condition_prometheus_query_language {
      query               = each.value.query
      duration            = each.value.duration
      evaluation_interval = "30s"
      alert_rule          = each.key
      rule_group          = "philobiblus.${var.environment}"
      labels = {
        component = each.value.component
        severity  = each.value.severity
      }
    }
  }

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content   = "Investigate the Philobiblus GKE dashboard and workload logs before resolving this alert."
    mime_type = "text/markdown"
  }

  user_labels = {
    application = "philobiblus"
    component   = each.value.component
    environment = var.environment
    severity    = each.value.severity
  }
}
