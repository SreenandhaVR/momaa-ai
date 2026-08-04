#!/usr/bin/env node

const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', 'apps', 'backend', '.env') });

const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const appIdArgumentIndex = process.argv.indexOf('--app-id');
const appId = appIdArgumentIndex === -1 ? undefined : process.argv[appIdArgumentIndex + 1];

class MetaApiError extends Error {
  constructor(status, body) {
    super(`Meta API request failed with status ${status}.`);
    this.name = 'MetaApiError';
    this.status = status;
    this.body = body;
  }
}

function required(name, value) {
  if (!value)
    throw new Error(`${name} is required. Set it in apps/backend/.env or the shell environment.`);
  return value;
}

function formatBody(body) {
  return typeof body === 'string' ? body : JSON.stringify(body, null, 2);
}

async function subscribedAppsRequest(method) {
  const endpoint = `https://graph.facebook.com/v21.0/${encodeURIComponent(
    required('WHATSAPP_BUSINESS_ACCOUNT_ID', businessAccountId)
  )}/subscribed_apps`;
  const response = await fetch(endpoint, {
    method,
    headers: { Authorization: `Bearer ${required('WHATSAPP_ACCESS_TOKEN', accessToken)}` }
  });
  const rawBody = await response.text();
  let body = rawBody;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    // Preserve a non-JSON Meta response verbatim for diagnostics.
  }

  console.log(`\n${method} ${endpoint}`);
  console.log(formatBody(body));

  if (!response.ok) throw new MetaApiError(response.status, body);
  return body;
}

function isCurrentAppSubscribed(data) {
  if (!Array.isArray(data) || data.length === 0) return false;
  if (!appId) return true;
  return data.some((subscription) => String(subscription?.id ?? '') === appId);
}

async function main() {
  const subscriptionResponse = await subscribedAppsRequest('GET');
  const subscriptions = Array.isArray(subscriptionResponse?.data) ? subscriptionResponse.data : [];

  if (isCurrentAppSubscribed(subscriptions)) {
    console.log(
      appId
        ? `\nWhatsApp app ${appId} is already subscribed to this WABA.`
        : '\nAt least one app is subscribed to this WABA. Pass --app-id <META_APP_ID> to verify a specific app.'
    );
    return;
  }

  console.log(
    appId
      ? `\nWhatsApp app ${appId} is NOT subscribed to this WABA. Attempting to subscribe it now.`
      : '\nNo app is subscribed to this WABA. Attempting to subscribe the app associated with this access token now.'
  );
  await subscribedAppsRequest('POST');
}

main().catch((error) => {
  if (error instanceof MetaApiError) {
    console.error(`\nMeta API error (${error.status}):`);
    console.error(formatBody(error.body));
  } else {
    console.error(
      `\nSubscription check failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  process.exitCode = 1;
});
