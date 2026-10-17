import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import pkg from './package.json' with { type: 'json' };

const RAW_BASE = 'https://raw.githubusercontent.com/NemoKing1210/x-plus/main';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: { passes: 2, pure_getters: true },
      mangle: true,
      format: { comments: false },
    },
    cssMinify: true,
    target: 'es2020',
    reportCompressedSize: true,
  },
  esbuild: {
    legalComments: 'none',
  },
  plugins: [
    monkey({
      entry: 'src/main.js',
      userscript: {
        name: {
          '': 'X Plus',
          ru: 'X Plus',
          'zh-CN': 'X Plus',
          es: 'X Plus',
          'pt-BR': 'X Plus',
          de: 'X Plus',
          fr: 'X Plus',
          ja: 'X Plus',
        },
        namespace: 'https://github.com/NemoKing1210/x-plus',
        version: pkg.version,
        description: {
          '': 'Translation, video download and many improvements for X (x.com)',
          ru: 'Перевод, скачивание видео и множество улучшений для X (x.com)',
          'zh-CN': '为 X (x.com) 提供翻译、视频下载和众多增强功能',
          es: 'Traducción, descarga de vídeos y muchas mejoras para X (x.com)',
          'pt-BR': 'Tradução, download de vídeos e muitas melhorias para o X (x.com)',
          de: 'Übersetzung, Video-Download und viele Verbesserungen für X (x.com)',
          fr: 'Traduction, téléchargement de vidéos et nombreuses améliorations pour X (x.com)',
          ja: 'X (x.com) に翻訳・動画ダウンロードなど多数の改善を追加',
        },
        author: 'NemoKing1210',
        tag: ['x', 'twitter', 'translate', 'video', 'download'],
        homepageURL: 'https://github.com/NemoKing1210/x-plus',
        supportURL: 'https://github.com/NemoKing1210/x-plus/issues',
        updateURL: `${RAW_BASE}/x-plus.user.js`,
        downloadURL: `${RAW_BASE}/x-plus.user.js`,
        license: 'MIT',
        icon: 'https://abs.twimg.com/favicons/twitter.3.ico',
        match: [
          'https://x.com/*',
          'https://www.x.com/*',
          'https://twitter.com/*',
          'https://www.twitter.com/*',
        ],
        connect: [
          'x.com',
          'twitter.com',
          'cdn.syndication.twimg.com',
          'video.twimg.com',
          'pbs.twimg.com',
          'translate.googleapis.com',
          'api-free.deepl.com',
          'api.deepl.com',
          'api.cognitive.microsofttranslator.com',
          'api.openai.com',
          'translate.api.cloud.yandex.net',
          'libretranslate.com',
          '*',
        ],
        'run-at': 'document-idle',
        noframes: true,
      },
      server: {
        prefix: 'dev:',
      },
      build: {
        fileName: 'x-plus.user.js',
        metaFileName: true,
      },
    }),
  ],
});
