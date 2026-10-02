{{- define "search-service.fullname" -}}
search-service
{{- end -}}

{{- define "search-service.labels" -}}
app.kubernetes.io/name: search-service
app.kubernetes.io/part-of: streamflix
{{- end -}}

{{- define "search-service.selectorLabels" -}}
app.kubernetes.io/name: search-service
{{- end -}}

{{- define "search-service.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{ default (include "search-service.fullname" .) .Values.serviceAccount.name }}
{{- else -}}
{{ default "default" .Values.serviceAccount.name }}
{{- end -}}
{{- end -}}
