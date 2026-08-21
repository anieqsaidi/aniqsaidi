## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Deployment

Do not deploy the application automatically.

Codex may:
- Modify source code
- Run the Astro development server
- Run local builds
- Run tests and validation
- Inspect Firebase configuration
- Prepare deployment-related changes
- Commit or push changes when explicitly requested

Codex must NOT run any command that publishes the application or Firebase resources unless the user explicitly requests deployment.

Do not run by default:
- `firebase deploy`
- `firebase deploy --only hosting`
- `firebase deploy --only functions`
- `firebase hosting:channel:deploy`
- `npx firebase-tools deploy`
- any equivalent command that deploys to Firebase or Google Cloud

When work is complete:
1. Run the appropriate local build and validation checks.
2. Report whether the project is ready for deployment.
3. Summarize what was changed.
4. Do not deploy unless the user explicitly asks to deploy in the current conversation.

If deployment is explicitly requested, deploy only the resources required for the task. Prefer:

```bash
firebase deploy --only hosting
```

for Hosting-only changes instead of a full:

```bash
firebase deploy
```