{{- define "frontend.fullname" -}}
frontend
{{- end -}}

{{- define "frontend.labels" -}}
app.kubernetes.io/name: frontend
app.kubernetes.io/part-of: streamflix
{{- end -}}

{{- define "frontend.selectorLabels" -}}
app.kubernetes.io/name: frontend
{{- end -}}

{{- define "frontend.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{ default (include "frontend.fullname" .) .Values.serviceAccount.name }}
{{- else -}}
{{ default "default" .Values.serviceAccount.name }}
{{- end -}}
{{- end -}}
