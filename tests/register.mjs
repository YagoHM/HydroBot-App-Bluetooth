// Permite que o test runner do Node resolva imports TypeScript sem extensão.
import { register } from 'node:module';
register('./ts-resolve-hooks.mjs', import.meta.url);
