const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/webview/index.tsx'],
  bundle: true,
  outfile: 'out/webview.js',
  platform: 'browser',
  format: 'iife',
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  external: ['vscode'],
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.css': 'css',
  },
  define: {
    'process.env.NODE_ENV': watch ? '"development"' : '"production"',
  },
  inject: ['./react-shim.js'],
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
};

async function build() {
  try {
    if (watch) {
      const context = await esbuild.context(buildOptions);
      await context.watch();
      console.log('👀 Watching webview files...');
    } else {
      await esbuild.build(buildOptions);
      console.log('✅ Webview built successfully');
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
