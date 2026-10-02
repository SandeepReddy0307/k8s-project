{{- define "billing-service.fullname" -}}
billing-service
{{- end -}}

{{- define "billing-service.labels" -}}
app.kubernetes.io/name: billing-service
app.kubernetes.io/part-of: streamflix
{{- end -}}

{{- define "billing-service.selectorLabels" -}}
app.kubernetes.io/name: billing-service
{{- end -}}

{{- define "billing-service.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{ default (include "billing-service.fullname" .) .Values.serviceAccount.name }}
{{- else -}}
{{ default "default" .Values.serviceAccount.name }}
{{- end -}}
{{- end -}}
