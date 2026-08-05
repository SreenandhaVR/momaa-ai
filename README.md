# momaa-ai

pnpm workspace monorepo for Momaa AI.

## Structure

```
apps/
  backend/      Express API (TypeScript)
  mobile/       Expo + React Native app (TypeScript, Expo Router)
packages/
  config/       Shared constants
  shared/       Shared business logic
  types/        Cross-app TypeScript types
  ui/           Shared React Native UI components
  utils/        Shared pure utility functions
docs/           Project documentation
scripts/        Repository scripts
```

## Setup

Requires Node.js 20.19+ and pnpm 9.15.4 (managed by Corepack).

```sh
corepack enable
corepack pnpm install
```

## Run the apps

```sh
# API at http://localhost:3000
corepack pnpm dev:backend

# Expo development server (web and Expo Go)
corepack pnpm dev:mobile --web --port 8082
```

Open `http://localhost:3000/health` to verify the API and `http://localhost:8082` for the web app. For a physical phone on the same Wi-Fi, open Expo Go and enter `exp://<your-computer-LAN-IP>:8082`. The mobile app uses Expo SDK 54, which matches the current Expo Go release.

For mobile authentication, create `apps/mobile/.env` and set `EXPO_PUBLIC_API_BASE_URL` to your computer's LAN address for a physical phone. Browser sessions use local storage; Android and iOS use Expo Secure Store.

## Backend authentication

Create `apps/backend/.env`, set `MONGODB_URI`, and add long random values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. Registration and login return a short-lived access token plus a refresh token. Send the access token as `Authorization: Bearer <accessToken>` to protected endpoints such as `/api/babies`.

```sh
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Ava Parent","email":"ava@example.com","password":"secure-password-123","firstName":"Ava","timezone":"Asia/Kolkata"}'
```

Use `POST /api/auth/refresh` with `{ "refreshToken": "..." }` to obtain a new token pair. An importable Postman collection is available at [`docs/postman_collection.json`](docs/postman_collection.json). Run the end-to-end backend tests with `pnpm --filter @momaa/backend test`.

## AI chat provider

Set `AI_PROVIDER=openai` with `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) or `AI_PROVIDER=gemini` with `GEMINI_API_KEY` in `apps/backend/.env`. The authenticated chat endpoint is `POST /api/babies/:babyId/chat` with `{ "message": "..." }`. Urgent red-flag phrases are handled locally before the provider is called.

## WhatsApp webhook (local development)

Configure the `WHATSAPP_*` and optional `CLOUDINARY_*` values directly in `apps/backend/.env`. Start the API, then expose it with ngrok:

```sh
pnpm dev:backend
ngrok http 3000
```

Set Meta's Callback URL to `https://<your-ngrok-domain>/api/webhook/whatsapp`, set the same verification token in Meta and `WHATSAPP_VERIFY_TOKEN`, and subscribe to the `messages` webhook field. The endpoint returns Meta's verification challenge on a valid GET request. Send a message such as `Fed 90ml` to the Meta test number from the WhatsApp number stored on the Parent profile; Momaa logs the feed and replies to the sender.

## Workspace packages

Packages are linked locally through `workspace:*`, so they can be imported without publishing to npm. TypeScript project references ensure `@momaa/types` and `@momaa/shared` build before their consumers.

```sh
pnpm typecheck
pnpm lint
pnpm format:check
```
