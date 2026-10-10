{{- define "streamflix.dns" -}}
{{- printf "%s.%s.svc.%s" .name .root.Release.Namespace .root.Values.clusterDomain -}}
{{- end -}}
{{- define "streamflix.image" -}}
{{- $owner := required "images.owner is required" .root.Values.images.owner -}}
{{- $digest := index .root.Values.images.digests .name -}}
{{- if $digest -}}
{{- if not (regexMatch "^sha256:[a-f0-9]{64}$" $digest) -}}{{- fail "Invalid image digest" -}}{{- end -}}
{{- printf "%s/%s/%s@%s" .root.Values.images.registry $owner .name $digest -}}
{{- else -}}
{{- $tag := required "images.tag must be an immutable release SHA" .root.Values.images.tag -}}
{{- if not (regexMatch "^[a-f0-9]{7,40}$" $tag) -}}{{- fail "images.tag must be a Git SHA" -}}{{- end -}}
{{- printf "%s/%s/%s:%s" .root.Values.images.registry $owner .name $tag -}}
{{- end -}}
{{- end -}}
{{- define "streamflix.env" -}}
- name: PORT
  value: {{ .root.Values.servicePort | quote }}
- name: NODE_ENV
  value: production
- name: SERVICE_NAME
  value: {{ .name | quote }}
- name: OTEL_SERVICE_NAME
  value: {{ .name | quote }}
- name: NAMESPACE
  valueFrom: {fieldRef: {fieldPath: metadata.namespace}}
- name: PUBLIC_ORIGIN
  value: {{ default (printf "%s://%s" (ternary "https" "http" .root.Values.ingress.tls) .root.Values.ingress.host) .root.Values.ingress.publicOrigin | quote }}
- name: COOKIE_SECURE
  value: {{ .root.Values.ingress.tls | quote }}
{{- if .service.jwt }}
- name: JWT_PUBLIC_KEY
  valueFrom: {secretKeyRef: {name: {{ .root.Values.secrets.jwt }}, key: public-key}}
{{- if and (eq .name "auth-service") (not .migration) }}
- name: JWT_PRIVATE_KEY
  valueFrom: {secretKeyRef: {name: {{ .root.Values.secrets.jwt }}, key: private-key}}
{{- end }}
{{- end }}
{{- if .service.database }}
- name: DB_NAME
  value: {{ .service.database | quote }}
- name: DB_USER
  valueFrom: {secretKeyRef: {name: {{ index .root.Values.secrets.databases .name }}, key: username}}
- name: DB_PASSWORD
  valueFrom: {secretKeyRef: {name: {{ index .root.Values.secrets.databases .name }}, key: password}}
{{- end }}
{{- if .service.redis }}
- name: REDIS_PASSWORD
  valueFrom: {secretKeyRef: {name: {{ .root.Values.secrets.redis }}, key: password}}
{{- end }}
{{- if .service.elastic }}
- name: ES_USERNAME
  valueFrom: {secretKeyRef: {name: {{ .root.Values.secrets.elastic }}, key: username}}
- name: ES_PASSWORD
  valueFrom: {secretKeyRef: {name: {{ .root.Values.secrets.elastic }}, key: password}}
{{- end }}
{{- if and .service.kafka .root.Values.endpoints.kafkaAuthSecret }}
- name: KAFKA_USERNAME
  valueFrom: {secretKeyRef: {name: {{ .root.Values.endpoints.kafkaAuthSecret }}, key: username}}
- name: KAFKA_PASSWORD
  valueFrom: {secretKeyRef: {name: {{ .root.Values.endpoints.kafkaAuthSecret }}, key: password}}
{{- end }}
{{- if .service.payment }}
- name: PAYMENT_API_KEY
  valueFrom: {secretKeyRef: {name: {{ .root.Values.secrets.payment }}, key: api-key}}
{{- end }}
{{- end -}}
{{- define "streamflix.security" -}}
allowPrivilegeEscalation: false
readOnlyRootFilesystem: true
capabilities: {drop: [ALL]}
{{- end -}}
