import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';
import { defineConfig } from 'rollup';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export default defineConfig({
  input: 'src/index.ts',
  output: [
    // UMD build - for <script> tags and AMD/CommonJS
    {
      file: 'dist/recsys-tracker.umd.js',
      format: 'umd',
      name: 'RecSysTracker',
      sourcemap: true,
      exports: 'named',
    },
    // IIFE build - for direct <script> tag with auto-execution
    {
      file: 'dist/recsys-tracker.iife.js',
      format: 'iife',
      name: 'RecSysTracker',
      sourcemap: true,
      exports: 'named',
    },
    // ESM build - for modern import/export
    {
      file: 'dist/recsys-tracker.esm.js',
      format: 'es',
      sourcemap: true,
      exports: 'named',
    },
    // CommonJS build - for Node.js require()
    {
      file: 'dist/recsys-tracker.cjs.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
  ],
  plugins: [
    replace({
      preventAssignment: true,
      'process.env.API_URL': JSON.stringify(process.env.API_URL || 'http://localhost:3000'),
    }),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: './dist',
      exclude: ['**/*.test.ts', 'node_modules/**'],
    }),
  ],
  external: [],
});
