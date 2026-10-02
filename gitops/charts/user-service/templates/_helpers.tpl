{{- define "user-service.fullname" -}}
user-service
{{- end -}}

{{- define "user-service.labels" -}}
app.kubernetes.io/name: user-service
app.kubernetes.io/part-of: streamflix
{{- end -}}

{{- define "user-service.selectorLabels" -}}
app.kubernetes.io/name: user-service
{{- end -}}

{{- define "user-service.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{ default (include "user-service.fullname" .) .Values.serviceAccount.name }}
{{- else -}}
{{ default "default" .Values.serviceAccount.name }}
{{- end -}}
{{- end -}}
