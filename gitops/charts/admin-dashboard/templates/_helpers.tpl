{{- define "admin-dashboard.fullname" -}}
admin-dashboard
{{- end -}}

{{- define "admin-dashboard.labels" -}}
app.kubernetes.io/name: admin-dashboard
app.kubernetes.io/part-of: streamflix
{{- end -}}

{{- define "admin-dashboard.selectorLabels" -}}
app.kubernetes.io/name: admin-dashboard
{{- end -}}

{{- define "admin-dashboard.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{ default (include "admin-dashboard.fullname" .) .Values.serviceAccount.name }}
{{- else -}}
{{ default "default" .Values.serviceAccount.name }}
{{- end -}}
{{- end -}}
