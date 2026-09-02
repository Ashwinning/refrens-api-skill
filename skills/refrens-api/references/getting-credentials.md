# Getting Refrens credentials

Use this short guide when the skill or CLI asks you to set up `.credentials`.

## What you need

Copy these values from Refrens:

1. **App ID**
2. **App Secret**
3. **Business URL Key**
4. **Base URL**: `https://api.refrens.com`

## Where to get them

1. Sign in to your Refrens account.
2. Make sure API access is enabled for your business.
3. Open:

   `Business Settings -> Integrations -> Accounting Integrations`

4. Use **Generate API Keys**.
5. Copy the values shown by Refrens.

## How to finish setup

Run:

```powershell
npx refrens-api-skill setup
```

Or, from the installed skill directory:

```powershell
node .\scripts\refrens-api.js setup
```

The CLI will ask for each value one by one and write a local `.credentials` file for you.

By default, that `.credentials` file is written to the directory where you run the command. If you want it somewhere else, run setup with `--credentials C:\path\to\.credentials`.
