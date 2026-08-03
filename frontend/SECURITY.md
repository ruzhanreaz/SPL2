Security checklist and recommendations for the frontend

1. Do not store secrets in frontend environment files. Use server-side storage for secrets.
2. Configure CSP via server response headers in production. A meta CSP exists as an interim measure.
3. Use `src/utils/sanitize.js` (DOMPurify) to clean any user-provided HTML before rendering.
4. Ensure production server sets headers: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`.
5. Use `HttpOnly`+`Secure` cookies for session/auth tokens; avoid storing sensitive tokens in `localStorage`.
6. Serve the app over HTTPS only and enforce HSTS on the server.
7. Regularly run `npm audit` and keep dependencies up-to-date.
