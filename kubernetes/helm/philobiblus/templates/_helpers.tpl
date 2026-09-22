{{- define "philobiblus.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "philobiblus.backendImage" -}}
{{- if .Values.backend.image.digest -}}
{{- printf "%s@%s" .Values.backend.image.repository .Values.backend.image.digest -}}
{{- else -}}
{{- printf "%s:%s" .Values.backend.image.repository .Values.backend.image.tag -}}
{{- end -}}
{{- end }}

{{- define "philobiblus.recommendationImage" -}}
{{- if .Values.recommendation.image.digest -}}
{{- printf "%s@%s" .Values.recommendation.image.repository .Values.recommendation.image.digest -}}
{{- else -}}
{{- printf "%s:%s" .Values.recommendation.image.repository .Values.recommendation.image.tag -}}
{{- end -}}
{{- end }}

{{- define "philobiblus.backendServiceAccountName" -}}
{{- default (printf "%s-backend" (include "philobiblus.fullname" .)) .Values.serviceAccounts.backend.name -}}
{{- end }}

{{- define "philobiblus.recommendationServiceAccountName" -}}
{{- default (printf "%s-recommendation" (include "philobiblus.fullname" .)) .Values.serviceAccounts.recommendation.name -}}
{{- end }}

{{- define "philobiblus.seedServiceAccountName" -}}
{{- default (printf "%s-seed" (include "philobiblus.fullname" .)) .Values.serviceAccounts.seed.name -}}
{{- end }}

{{- define "philobiblus.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- if contains (include "philobiblus.name" .) .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name (include "philobiblus.name" .) | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "philobiblus.labels" -}}
app.kubernetes.io/name: {{ include "philobiblus.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{- end }}

{{- define "philobiblus.selectorLabels" -}}
app.kubernetes.io/name: {{ include "philobiblus.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "philobiblus.secretName" -}}
{{- if .Values.secrets.create }}
{{- printf "%s-secrets" (include "philobiblus.fullname" .) }}
{{- else }}
{{- required "secrets.existingSecret is required when secrets.create=false" .Values.secrets.existingSecret }}
{{- end }}
{{- end }}
