{{- define "recommendation-service.fullname" -}}
recommendation-service
{{- end -}}

{{- define "recommendation-service.labels" -}}
app.kubernetes.io/name: recommendation-service
app.kubernetes.io/part-of: streamflix
{{- end -}}

{{- define "recommendation-service.selectorLabels" -}}
app.kubernetes.io/name: recommendation-service
{{- end -}}

{{- define "recommendation-service.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{ default (include "recommendation-service.fullname" .) .Values.serviceAccount.name }}
{{- else -}}
{{ default "default" .Values.serviceAccount.name }}
{{- end -}}
{{- end -}}
