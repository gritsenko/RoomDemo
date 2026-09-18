import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/**
 * Bundles the whole build into ONE self-contained index.html:
 *  - JS chunks and CSS are inlined into the document
 *  - every file from the public dir (assets/) becomes a data: URI, exposed to
 *    the runtime as window.__INLINE_ASSETS__ (see src/atlas/assetLoader.ts)
 *  - references to those files inside index.html (@font-face, preload, img)
 *    are rewritten to the same data: URIs
 *
 * Result runs from file:// with no network and no sibling files.
 */

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.json': 'application/json',
  '.txt': 'text/plain'
};

export interface SingleFileOptions {
  /** Directory whose files are inlined as data: URIs. Default: 'assets'. */
  publicDir?: string;
  /** Files to skip (posix paths as they appear in the map, e.g. '/sprites_metadata.json'). */
  exclude?: string[];
  /** Drop <link rel=preconnect|stylesheet> pointing at remote hosts (offline build). Default: true. */
  stripRemoteLinks?: boolean;
}

function walk(dir: string, base = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, base);
    return ['/' + path.relative(base, full).split(path.sep).join('/')];
  });
}

function toDataUri(file: string): string {
  const mime = MIME_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

export function singleFile(options: SingleFileOptions = {}): Plugin {
  const { publicDir = 'assets', exclude = [], stripRemoteLinks = true } = options;
  let root = process.cwd();

  return {
    name: 'room-demo:single-file',
    apply: 'build',
    enforce: 'post',

    config() {
      return {
        base: './',
        build: {
          // Everything ends up in the HTML, so nothing may be split out.
          assetsInlineLimit: Number.MAX_SAFE_INTEGER,
          cssCodeSplit: false,
          copyPublicDir: false,
          modulePreload: { polyfill: false },
          rollupOptions: {
            output: { inlineDynamicImports: true }
          }
        }
      };
    },

    configResolved(resolved) {
      root = resolved.root;
    },

    generateBundle(_options, bundle) {
      const htmlName = Object.keys(bundle).find((name) => name.endsWith('.html'));
      if (!htmlName) {
        this.error('single-file: no HTML entry found in the bundle');
        return;
      }
      const htmlAsset = bundle[htmlName];
      if (htmlAsset.type !== 'asset') return;
      let html = htmlAsset.source.toString();

      // 1. Inline every runtime asset from the public dir.
      const assetsRoot = path.resolve(root, publicDir);
      const assetMap: Record<string, string> = {};
      for (const key of walk(assetsRoot)) {
        if (exclude.includes(key)) continue;
        assetMap[key] = toDataUri(path.join(assetsRoot, key.slice(1)));
      }

      // Rewrite references inside the HTML: "/fonts/pixel.ttf" plus the "./fonts/…"
      // and "fonts/…" forms Vite rewrites them to under base './'.
      // The reference must open right after a quote or paren, so that a bare "cover.jpg"
      // cannot match the tail of an unrelated absolute URL (…/RoomDemo/og-cover.jpg).
      for (const [key, uri] of Object.entries(assetMap)) {
        const name = key.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        html = html.replace(new RegExp(`(["'(])(?:\\.?/)?${name}`, 'g'), (_match, open: string) => open + uri);
      }

      // A preload of an already inlined data: URI only earns a console warning.
      html = html.replace(/[^\S\n]*<link\b[^>]*\srel="preload"[^>]*>\n?/gi, '');

      if (stripRemoteLinks) {
        html = html.replace(/[^\S\n]*<link\b[^>]*href="https?:\/\/[^"]*"[^>]*>\n?/gi, '');
      }

      // 2. Collect the JS and CSS emitted by Vite, then drop them from the bundle.
      const scripts: string[] = [];
      const styles: string[] = [];
      for (const [name, output] of Object.entries(bundle)) {
        if (name === htmlName) continue;
        if (output.type === 'chunk') {
          scripts.push(output.code);
          delete bundle[name];
        } else if (name.endsWith('.css')) {
          styles.push(output.source.toString());
          delete bundle[name];
        }
      }

      // Their <script src>/<link href> tags are no longer needed.
      html = html
        .replace(/[^\S\n]*<script\b[^>]*\ssrc="[^"]*"[^>]*><\/script>\n?/gi, '')
        .replace(/[^\S\n]*<link\b[^>]*\srel="(?:stylesheet|modulepreload)"[^>]*>\n?/gi, '');

      const escape = (code: string) => code.replace(/<\/script>/gi, '<\\/script>');
      const head = [
        styles.length ? `<style>\n${styles.join('\n')}\n</style>` : '',
        `<script>window.__INLINE_ASSETS__ = ${JSON.stringify(assetMap)};</script>`
      ]
        .filter(Boolean)
        .join('\n');
      const body = scripts.map((code) => `<script type="module">\n${escape(code)}\n</script>`).join('\n');

      html = html.replace('</head>', `${head}\n</head>`).replace('</body>', `${body}\n</body>`);

      htmlAsset.source = html;

      const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
      this.info(`single-file: ${htmlName} — ${kb} KB, ${Object.keys(assetMap).length} inlined assets`);
    }
  };
}
