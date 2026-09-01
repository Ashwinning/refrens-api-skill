#!/usr/bin/env node

import { runCli } from "../skills/refrens-api/scripts/lib/cli.js";

process.exitCode = await runCli(process.argv.slice(2));
