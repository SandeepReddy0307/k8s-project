{{- define "auth-service.fullname" -}}
auth-service
{{- end -}}

{{- define "auth-service.labels" -}}
app.kubernetes.io/name: auth-service
app.kubernetes.io/part-of: streamflix
{{- end -}}

{{- define "auth-service.selectorLabels" -}}
app.kubernetes.io/name: auth-service
{{- end -}}

{{- define "auth-service.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{ default (include "auth-service.fullname" .) .Values.serviceAccount.name }}
{{- else -}}
{{ default "default" .Values.serviceAccount.name }}
{{- end -}}
{{- end -}}
