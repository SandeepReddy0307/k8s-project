{{- define "activity-tracker.fullname" -}}
activity-tracker
{{- end -}}

{{- define "activity-tracker.labels" -}}
app.kubernetes.io/name: activity-tracker
app.kubernetes.io/part-of: streamflix
{{- end -}}

{{- define "activity-tracker.selectorLabels" -}}
app.kubernetes.io/name: activity-tracker
{{- end -}}

{{- define "activity-tracker.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{ default (include "activity-tracker.fullname" .) .Values.serviceAccount.name }}
{{- else -}}
{{ default "default" .Values.serviceAccount.name }}
{{- end -}}
{{- end -}}
