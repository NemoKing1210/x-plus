# Security Policy

X Plus is a client-side userscript. It runs in your browser on `x.com` and
`twitter.com`, keeps settings and caches in userscript-manager storage, and
talks to the translation provider you pick, X's media endpoints and, when
needed, X's internal API. It has no backend service and no account system of
its own.

## Supported versions

Only the latest published version is supported. The script updates itself from
GitHub `main` (see the README), so update before reporting an issue.

| Version | Supported |
|---------|-----------|
| Latest release | ✅ |
| Older releases | ❌ |

The settings panel header shows the running version, for example `v0.14.0`.

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it privately through GitHub's private vulnerability reporting:

https://github.com/NemoKing1210/x-plus/security/advisories/new

If the private reporting form is unavailable, open a minimal issue that asks
for a private channel without disclosing the vulnerability details.

Include as much as you can:

- what the issue is and what an attacker could do with it;
- the affected version, browser and userscript manager;
- reproduction steps or a proof of concept;
- relevant console output — `XP-####` error codes help pinpoint the failure.

You will get an acknowledgement as soon as possible, and a fix or mitigation
plan once the report is triaged. This is a volunteer project: there is no bug
bounty.

## Scope

In scope:

- the userscript source (`src/`) and the generated install artifacts
  (`x-plus.user.js`, `x-plus.meta.js`);
- injection, storage, URL and download-name handling, network requests, and the
  settings import/export surfaces;
- translation API keys and other settings kept in userscript storage;
- post screenshots and clipboard output;
- anything that could leak user data, execute untrusted code, or let page
  content escape into userscript-manager privileges.

Out of scope:

- vulnerabilities in X/Twitter services, browsers or userscript managers —
  report those to their vendors;
- the translation providers (Google, DeepL, Microsoft, OpenAI-compatible,
  Yandex, LibreTranslate) and other third-party services;
- issues that require a modified copy of the script, or that only affect a
  manager running the script with `@grant none`;
- spam or denial-of-service testing against X or third-party services.

## Testing guidelines

Test only against your own account and pages you are allowed to use. Do not
access other people's accounts, send automated high-volume requests to X or the
translation providers, or publish a working exploit before a fix is available.

Thank you for helping keep X Plus and its users safe.
