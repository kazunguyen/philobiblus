resource "google_compute_security_policy" "backend" {
  count = var.enable_cloud_armor ? 1 : 0

  project     = var.project_id
  name        = "${local.name}-backend-security"
  description = "Philobiblus backend Cloud Armor WAF and rate limits."
  type        = "CLOUD_ARMOR"

  rule {
    action      = "deny(403)"
    priority    = 100
    preview     = var.cloud_armor_waf_rules_preview
    description = "CRS 4.22 SQL injection protection."

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('sqli-v422-stable', {'sensitivity': 1})"
      }
    }
  }

  rule {
    action      = "deny(403)"
    priority    = 110
    preview     = var.cloud_armor_waf_rules_preview
    description = "CRS 4.22 XSS protection."

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('xss-v422-stable', {'sensitivity': 1})"
      }
    }
  }

  rule {
    action      = "deny(403)"
    priority    = 120
    preview     = var.cloud_armor_waf_rules_preview
    description = "CRS 4.22 local file inclusion protection."

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('lfi-v422-stable', {'sensitivity': 1})"
      }
    }
  }

  rule {
    action      = "deny(403)"
    priority    = 130
    preview     = var.cloud_armor_waf_rules_preview
    description = "CRS 4.22 remote file inclusion protection."

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('rfi-v422-stable', {'sensitivity': 1})"
      }
    }
  }

  rule {
    action      = "deny(403)"
    priority    = 140
    preview     = var.cloud_armor_waf_rules_preview
    description = "CRS 4.22 remote code execution protection."

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('rce-v422-stable', {'sensitivity': 1})"
      }
    }
  }

  rule {
    action      = "deny(403)"
    priority    = 150
    preview     = var.cloud_armor_waf_rules_preview
    description = "CRS 4.22 scanner detection."

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('scannerdetection-v422-stable', {'sensitivity': 1})"
      }
    }
  }

  rule {
    action      = "throttle"
    priority    = 1000
    preview     = var.cloud_armor_sensitive_rate_limit_preview
    description = "Limit login attempts by client IP."

    match {
      expr {
        expression = "request.path == '/api/auth/login'"
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"

      rate_limit_threshold {
        count        = var.cloud_armor_login_count
        interval_sec = var.cloud_armor_login_interval_seconds
      }
    }
  }

  rule {
    action      = "throttle"
    priority    = 1010
    preview     = var.cloud_armor_sensitive_rate_limit_preview
    description = "Limit account registrations by client IP."

    match {
      expr {
        expression = "request.path == '/api/auth/register'"
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"

      rate_limit_threshold {
        count        = var.cloud_armor_register_count
        interval_sec = var.cloud_armor_register_interval_seconds
      }
    }
  }

  rule {
    action      = "throttle"
    priority    = 1020
    preview     = var.cloud_armor_sensitive_rate_limit_preview
    description = "Limit expensive cover uploads by client IP."

    match {
      expr {
        expression = "request.path == '/api/uploads/cover'"
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"

      rate_limit_threshold {
        count        = var.cloud_armor_upload_count
        interval_sec = var.cloud_armor_upload_interval_seconds
      }
    }
  }

  rule {
    action      = "throttle"
    priority    = 1030
    preview     = var.cloud_armor_sensitive_rate_limit_preview
    description = "Limit recommendation requests by client IP."

    match {
      expr {
        expression = "request.path.startsWith('/api/books/recommendations/') || request.path.endsWith('/recommendations')"
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"

      rate_limit_threshold {
        count        = var.cloud_armor_recommendation_count
        interval_sec = var.cloud_armor_recommendation_interval_seconds
      }
    }
  }

  rule {
    action      = "throttle"
    priority    = 2000
    preview     = var.cloud_armor_general_rate_limit_preview
    description = "General per-IP API flood protection."

    match {
      expr {
        expression = "request.path.startsWith('/api/')"
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"

      rate_limit_threshold {
        count        = var.cloud_armor_general_count
        interval_sec = var.cloud_armor_general_interval_seconds
      }
    }
  }

  rule {
    action      = "allow"
    priority    = 2147483647
    description = "Default allow for traffic that matches no higher-priority rule."

    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
  }
}
