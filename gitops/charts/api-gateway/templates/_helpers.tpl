{{- define "api-gateway.fullname" -}}
api-gateway
{{- end -}}

{{- define "api-gateway.labels" -}}
app.kubernetes.io/name: api-gateway
app.kubernetes.io/part-of: streamflix
{{- end -}}

{{- define "api-gateway.selectorLabels" -}}
app.kubernetes.io/name: api-gateway
{{- end -}}

{{- define "api-gateway.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{ default (include "api-gateway.fullname" .) .Values.serviceAccount.name }}
{{- else -}}
{{ default "default" .Values.serviceAccount.name }}
{{- end -}}
{{- end -}}
