#!/bin/bash
set -euo pipefail

# ==============================================================================
# canton-invoice-factoring: Upload Invoice Script
#
# Description:
#   This script creates a new `Invoice.Invoice` contract on the ledger using the
#   Canton JSON API. This simulates a supplier uploading a new, verified invoice
#   to the factoring platform.
#
# Prerequisites:
#   1. A running Canton ledger (e.g., via `dpm sandbox`).
#   2. The parties (Platform, Supplier, Buyer, Factors) must be allocated on the
#      ledger. This can be done with a Daml Script.
#   3. A valid JWT for the `platform` party, which acts as the uploader. The
#      `supplier` is also a signatory, so the JWT needs `actAs: [platform]` and
#      `readAs: [supplier]` claims or similar authorization. A simpler approach
#      is to use a token with both in `actAs`.
#
# Usage:
#   1. Edit the "Configuration" section below with your party IDs and JWT.
#   2. Make the script executable: `chmod +x ./scripts/upload-invoice.sh`
#   3. Run the script: `./scripts/upload-invoice.sh`
#
# ==============================================================================

# --- Configuration ---
# Adjust these variables to match your environment.

# The base URL of the Canton JSON API.
JSON_API_URL="http://localhost:7575"

# A JWT for submitting the command. This token must authorize the command's
# required authorizers (`platform` and `supplier`).
# Example to generate a token (using a dummy secret, replace in production):
#   dpm canton secret --participant-id local --output-file my_secret.key
#   dpm canton jwt --participant-id local --key-file my_secret.key \
#     --claim "actAs=[\"Platform::1220...\", \"Supplier::1220...\"]" \
#     --claim "readAs=[\"Buyer::1220...\"]"
#
# For simplicity in testing, a single token authorizing both signatories works.
JWT_TOKEN="<REPLACE_WITH_JWT>"


# Party IDs. These must be allocated on the ledger beforehand.
# You can get these from the output of a setup script or by querying the party
# management service of your participant.
PLATFORM_PARTY="<REPLACE_WITH_PLATFORM_PARTY_ID>"
SUPPLIER_PARTY="<REPLACE_WITH_SUPPLIER_PARTY_ID>"
BUYER_PARTY="<REPLACE_WITH_BUYER_PARTY_ID>"

# Observers are potential factors who can see the invoice and bid on it.
FACTOR_A_PARTY="<REPLACE_WITH_FACTOR_A_PARTY_ID>"
FACTOR_B_PARTY="<REPLACE_WITH_FACTOR_B_PARTY_ID>"

# --- Invoice Data ---
# We generate a unique invoice ID and dynamic dates for each run.
INVOICE_ID="INV-$(date +%Y%m%d)-$(openssl rand -hex 4 | tr 'a-z' 'A-Z')"
INVOICE_AMOUNT="50000.00"
INVOICE_CURRENCY="USD"
ISSUE_DATE=$(date -u +"%Y-%m-%d")

# Due date is 90 days from the issue date. This handles both GNU and BSD `date`.
if [[ "$(uname)" == "Darwin" ]]; then
  DUE_DATE=$(date -v+90d -u +"%Y-%m-%d") # macOS/BSD date
else
  DUE_DATE=$(date -d "+90 days" -u +"%Y-%m-%d") # GNU date
fi


# --- Sanity Checks ---
if [[ "$JWT_TOKEN" == "<REPLACE_WITH_JWT>" || \
      "$PLATFORM_PARTY" == "<REPLACE_WITH_PLATFORM_PARTY_ID>" || \
      "$SUPPLIER_PARTY" == "<REPLACE_WITH_SUPPLIER_PARTY_ID>" || \
      "$BUYER_PARTY" == "<REPLACE_WITH_BUYER_PARTY_ID>" || \
      "$FACTOR_A_PARTY" == "<REPLACE_WITH_FACTOR_A_PARTY_ID>" || \
      "$FACTOR_B_PARTY" == "<REPLACE_WITH_FACTOR_B_PARTY_ID>" ]]; then
  echo "ERROR: JWT_TOKEN or one or more Party IDs are not set." >&2
  echo "Please edit the script and replace the placeholder values." >&2
  exit 1
fi

# --- Payload Construction ---
# We use a here-document to build the JSON payload for readability and safety.
read -r -d '' JSON_PAYLOAD << EOM
{
  "templateId": "Invoice:Invoice",
  "payload": {
    "platform": "${PLATFORM_PARTY}",
    "supplier": "${SUPPLIER_PARTY}",
    "buyer": "${BUYER_PARTY}",
    "invoiceId": "${INVOICE_ID}",
    "amount": "${INVOICE_AMOUNT}",
    "currency": "${INVOICE_CURRENCY}",
    "issueDate": "${ISSUE_DATE}",
    "dueDate": "${DUE_DATE}",
    "observers": ["${FACTOR_A_PARTY}", "${FACTOR_B_PARTY}"]
  }
}
EOM


# --- API Call ---
echo ">>> Submitting Invoice create command for ID: ${INVOICE_ID}"
echo "Payload:"
echo "$JSON_PAYLOAD" | jq .

# Submit the create command to the JSON API and pretty-print the response.
# The `-s` flag silences progress meter, `-f` fails silently on server errors.
# We check the HTTP status code ourselves.
HTTP_RESPONSE=$(
  curl -s -w "%{http_code}" -X POST \
    "${JSON_API_URL}/v1/create" \
    -H "Authorization: Bearer ${JWT_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "${JSON_PAYLOAD}"
)

HTTP_BODY=$(echo "$HTTP_RESPONSE" | sed '$ d')
HTTP_STATUS=$(echo "$HTTP_RESPONSE" | tail -n 1)

echo ""
echo ">>> API Response (Status: ${HTTP_STATUS}):"
if ! echo "$HTTP_BODY" | jq . ; then
    echo "$HTTP_BODY"
fi

if [ "$HTTP_STATUS" -ne 200 ]; then
    echo ""
    echo "ERROR: Invoice creation failed with HTTP status ${HTTP_STATUS}." >&2
    exit 1
fi

echo ""
echo ">>> Invoice creation command submitted successfully."