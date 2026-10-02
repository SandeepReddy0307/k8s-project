{{- define "catalog-service.fullname" -}}
catalog-service
{{- end -}}

{{- define "catalog-service.labels" -}}
app.kubernetes.io/name: catalog-service
app.kubernetes.io/part-of: streamflix
{{- end -}}

{{- define "catalog-service.selectorLabels" -}}
app.kubernetes.io/name: catalog-service
{{- end -}}

{{- define "catalog-service.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{ default (include "catalog-service.fullname" .) .Values.serviceAccount.name }}
{{- else -}}
{{ default "default" .Values.serviceAccount.name }}
{{- end -}}
{{- end -}}
