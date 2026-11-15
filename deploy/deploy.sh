#!/usr/bin/env bash
# Deploys SamiMeds to Google Cloud Run with Firestore, Secret Manager and Cloud Scheduler.
# Usage: PROJECT_ID=my-project REGION=asia-south1 ./deploy/deploy.sh
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID}"
REGION="${REGION:-asia-south1}"
SERVICE="${SERVICE:-samimeds}"
DEMO_MODE="${DEMO_MODE:-true}"

gcloud config set project "$PROJECT_ID"

echo "▶ Enabling Google APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com firestore.googleapis.com \
  secretmanager.googleapis.com cloudscheduler.googleapis.com storage.googleapis.com

echo "▶ Firestore (native mode) + indexes"
gcloud firestore databases describe --database='(default)' >/dev/null 2>&1 || \
  gcloud firestore databases create --location="$REGION" --type=firestore-native
for spec in "samimeds_doses" "samimeds_moods"; do
  gcloud firestore indexes composite create --collection-group="$spec" \
    --field-config=field-path=circleId,order=ascending --field-config=field-path=date,order=ascending \
    --async 2>/dev/null || true
done

echo "▶ Secrets (Secret Manager)"
create_secret() {
  local name="$1" value="$2"
  [ -z "$value" ] && return 0
  gcloud secrets describe "$name" >/dev/null 2>&1 || gcloud secrets create "$name" --replication-policy=automatic
  printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=-
}
CRON_SECRET="${CRON_SECRET:-$(openssl rand -hex 24)}"
create_secret samimeds-cron-secret "$CRON_SECRET"
create_secret samimeds-gemini-key "${GEMINI_API_KEY:-}"
create_secret samimeds-smtp-pass "${SMTP_PASS:-}"

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
for s in samimeds-cron-secret samimeds-gemini-key samimeds-smtp-pass; do
  gcloud secrets describe "$s" >/dev/null 2>&1 && \
    gcloud secrets add-iam-policy-binding "$s" --member="serviceAccount:$RUN_SA" --role=roles/secretmanager.secretAccessor >/dev/null
done

SECRETS="CRON_SECRET=samimeds-cron-secret:latest"
gcloud secrets describe samimeds-gemini-key >/dev/null 2>&1 && SECRETS="$SECRETS,GEMINI_API_KEY=samimeds-gemini-key:latest"
gcloud secrets describe samimeds-smtp-pass >/dev/null 2>&1 && SECRETS="$SECRETS,SMTP_PASS=samimeds-smtp-pass:latest"

ENV_VARS="STORE=firestore,INTERNAL_SCHEDULER=false,DEMO_MODE=${DEMO_MODE},DEFAULT_TIMEZONE=${DEFAULT_TIMEZONE:-Asia/Kolkata}"
[ -n "${SMTP_USER:-}" ] && ENV_VARS="$ENV_VARS,SMTP_HOST=${SMTP_HOST:-smtp.gmail.com},SMTP_PORT=${SMTP_PORT:-465},SMTP_USER=$SMTP_USER,MAIL_FROM=${MAIL_FROM:-$SMTP_USER}"
[ -n "${PHOTO_BUCKET:-}" ] && ENV_VARS="$ENV_VARS,PHOTO_BUCKET=$PHOTO_BUCKET"

echo "▶ Deploying to Cloud Run"
gcloud run deploy "$SERVICE" --source . --region "$REGION" --allow-unauthenticated \
  --set-env-vars "$ENV_VARS" --set-secrets "$SECRETS" --memory 512Mi --max-instances 3

URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')
gcloud run services update "$SERVICE" --region "$REGION" --update-env-vars "PUBLIC_URL=$URL" >/dev/null

echo "▶ Cloud Scheduler: reminders every 5 minutes"
JOB=samimeds-tick
ARGS=(--location="$REGION" --schedule="*/5 * * * *" --uri="$URL/api/cron/tick" --http-method=POST
  --headers="X-Cron-Secret=$CRON_SECRET,Content-Type=application/json" --message-body='{}')
gcloud scheduler jobs describe "$JOB" --location="$REGION" >/dev/null 2>&1 \
  && gcloud scheduler jobs update http "$JOB" "${ARGS[@]}" \
  || gcloud scheduler jobs create http "$JOB" "${ARGS[@]}"

echo "✅ SamiMeds is live at $URL"
