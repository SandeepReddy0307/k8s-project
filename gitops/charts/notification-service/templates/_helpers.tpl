{{- define "notification-service.fullname" -}}
notification-service
{{- end -}}

{{- define "notification-service.labels" -}}
app.kubernetes.io/name: notification-service
app.kubernetes.io/part-of: streamflix
{{- end -}}

{{- define "notification-service.selectorLabels" -}}
app.kubernetes.io/name: notification-service
{{- end -}}

{{- define "notification-service.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{ default (include "notification-service.fullname" .) .Values.serviceAccount.name }}
{{- else -}}
{{ default "default" .Values.serviceAccount.name }}
{{- end -}}
{{- end -}}
