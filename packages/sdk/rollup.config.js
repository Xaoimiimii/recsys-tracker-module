import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';
import { defineConfig } from 'rollup';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Plugin to generate loader.js after build
function generateLoader() {
  return {
    name: 'generate-loader',
    writeBundle() {
      const loaderContent = `(function(d,w){
  // Create stub to queue calls before SDK loads
  w.RecSysTracker = w.RecSysTracker || function(){
    (w.RecSysTracker.q = w.RecSysTracker.q || []).push(arguments);
  };
  
  // Store domain key from global variable
  w.RecSysTracker.domainKey = w.__RECSYS_DOMAIN_KEY__;

  // Load the IIFE bundle
  var s = d.createElement("script");
  s.async = true;
  s.src = (d.currentScript && d.currentScript.src) 
    ? d.currentScript.src.replace('loader.js', 'recsys-tracker.iife.js')
    : "recsys-tracker.iife.js";
  d.head.appendChild(s);
})(document, window);

  // <script>window.__RECSYS_DOMAIN_KEY__ = "";</script>
  // <script src="https://tracking-sdk.s3-ap-southeast-2.amazonaws.com/dist/loader.js"></script>
`;

      const distPath = path.resolve('dist', 'loader.js');
      fs.writeFileSync(distPath, loaderContent, 'utf8');
      console.log('Generated loader.js');
    }
  };
}

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
      'process.env.API_URL': JSON.stringify(process.env.API_URL || 'https://recsys-tracker-module.onrender.com'),
    }),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: './dist',
      exclude: ['**/*.test.ts', 'node_modules/**'],
    }),
    generateLoader(),
  ],
  external: [],
});
