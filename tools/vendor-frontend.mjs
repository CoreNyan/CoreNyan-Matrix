import { copyFile, mkdir } from 'node:fs/promises';
const vendor = 'frontend/web/vendor';
await mkdir(vendor, { recursive: true });
const files = {
  'codemirror/addon/dialog/dialog.js':'dialog.js',
  'codemirror/addon/search/searchcursor.js':'searchcursor.js',
  'codemirror/addon/search/search.js':'search.js',
  'codemirror/addon/fold/foldcode.js': 'foldcode.js',
  'codemirror/addon/fold/foldgutter.js': 'foldgutter.js',
  'codemirror/addon/fold/brace-fold.js': 'brace-fold.js',
  'codemirror/addon/runmode/runmode.js': 'runmode.js',
  'codemirror/lib/codemirror.js': 'codemirror.js',
  'codemirror/lib/codemirror.css': 'codemirror.css',
  'codemirror/LICENSE': 'codemirror-LICENSE.txt',
  'dompurify/dist/purify.min.js': 'purify.min.js',
  'dompurify/LICENSE': 'dompurify-LICENSE.txt',
  '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2': 'inter-latin.woff2',
  '@fontsource-variable/inter/LICENSE': 'inter-LICENSE.txt',
  '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2': 'jetbrains-mono-latin.woff2',
  '@fontsource-variable/jetbrains-mono/LICENSE': 'jetbrains-mono-LICENSE.txt',
};
for (const mode of ['javascript', 'markdown', 'xml', 'css', 'htmlmixed', 'yaml', 'shell']) files[`codemirror/mode/${mode}/${mode}.js`] = `${mode}.js`;
for (const [source, destination] of Object.entries(files)) await copyFile(`node_modules/${source}`, `${vendor}/${destination}`);
console.log('Local editor, sanitizer and font assets synchronized.');
