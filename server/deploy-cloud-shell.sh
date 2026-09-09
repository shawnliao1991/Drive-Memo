#!/usr/bin/env bash
# Run from the repository root in Google Cloud Shell after enabling billing.
set -euo pipefail
read -r -p 'Google Cloud project ID: ' PROJECT_ID
read -r -p 'Region (for example asia-east1): ' REGION
read -r -p 'Google OAuth web client ID: ' CLIENT_ID
read -r -p 'Allowed Google email: ' OWNER_EMAIL
test -n "$PROJECT_ID" && test -n "$REGION" && test -n "$CLIENT_ID" && test -n "$OWNER_EMAIL"
SERVICE=drive-memo
ACCOUNT="drive-memo-runtime@$PROJECT_ID.iam.gserviceaccount.com"
gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com secretmanager.googleapis.com
if ! gcloud iam service-accounts describe "$ACCOUNT" >/dev/null 2>&1; then
 gcloud iam service-accounts create drive-memo-runtime --display-name='Drive Memo runtime'
fi
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$ACCOUNT" --role=roles/datastore.user --condition=None >/dev/null
if ! gcloud firestore databases describe --database='(default)' >/dev/null 2>&1; then
 gcloud firestore databases create --database='(default)' --location="$REGION" --type=firestore-native
fi
if ! gcloud secrets describe drive-memo-client-secret >/dev/null 2>&1; then
 read -r -s -p 'Google OAuth client secret (hidden input): ' CLIENT_SECRET
 printf '\n'
 printf '%s' "$CLIENT_SECRET" | gcloud secrets create drive-memo-client-secret --data-file=- --replication-policy=automatic
 unset CLIENT_SECRET
fi
if ! gcloud secrets describe drive-memo-encryption-key >/dev/null 2>&1; then
 openssl rand -base64 32 | tr -d '\n' | gcloud secrets create drive-memo-encryption-key --data-file=- --replication-policy=automatic
fi
for SECRET in drive-memo-client-secret drive-memo-encryption-key; do
 gcloud secrets add-iam-policy-binding "$SECRET" --member="serviceAccount:$ACCOUNT" --role=roles/secretmanager.secretAccessor --condition=None >/dev/null
done
# Existing installations keep their origin during updates.
PUBLIC_ORIGIN=$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)' 2>/dev/null || true)
PUBLIC_ORIGIN=${PUBLIC_ORIGIN:-https://setup.invalid}
gcloud run deploy "$SERVICE" --source=. --region="$REGION" --allow-unauthenticated \
 --service-account="$ACCOUNT" --min-instances=0 --max-instances=1 --memory=256Mi \
 --set-env-vars="PUBLIC_ORIGIN=$PUBLIC_ORIGIN,GOOGLE_CLIENT_ID=$CLIENT_ID,ALLOWED_EMAIL=$OWNER_EMAIL,FIRESTORE_PROJECT_ID=$PROJECT_ID,HOST=0.0.0.0" \
 --set-secrets='GOOGLE_CLIENT_SECRET=drive-memo-client-secret:latest,TOKEN_ENCRYPTION_KEY=drive-memo-encryption-key:latest'
PUBLIC_ORIGIN=$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')
gcloud run services update "$SERVICE" --region="$REGION" --update-env-vars="PUBLIC_ORIGIN=$PUBLIC_ORIGIN"
gcloud firestore fields ttls update expiresAt --collection-group=driveMemoSessions --enable-ttl --quiet
printf '\nWebsite: %s\nOAuth authorized redirect URI: %s/auth/callback\n' "$PUBLIC_ORIGIN" "$PUBLIC_ORIGIN"
printf 'Add that redirect URI to the OAuth Web client, switch Audience to In production, then sign in once.\n'
