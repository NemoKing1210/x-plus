import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFileName, FILENAME_TOKENS } from '../src/features/media/filename.js';

test('buildFileName expands the documented tokens', () => {
  assert.deepEqual(FILENAME_TOKENS, [
    'user',
    'id',
    'date',
    'time',
    'n',
    'quality',
    'type',
    'text',
  ]);

  const name = buildFileName('{user}-{id}-{n}-{quality}-{type}', {
    user: 'alice',
    id: '123',
    n: 2,
    quality: '720p',
    type: 'video',
  });
  assert.equal(name, 'alice-123-2-720p-video');
});

test('buildFileName formats dates and strips URLs from the text', () => {
  const name = buildFileName('{date}_{time}_{text}', {
    createdAt: '2024-01-02T03:04:05',
    text: ' hello https://example.com/x world ',
  });
  assert.equal(name, '2024-01-02_030405_hello-world');
});

test('buildFileName never returns an empty or unsafe name', () => {
  assert.equal(buildFileName('', {}), 'file');
  assert.equal(buildFileName('{unknown}', {}), 'file');
  assert.equal(buildFileName('a/b', {}), 'a_b');
  assert.equal(buildFileName('{user}', { user: 'a'.repeat(200) }).length, 120);
});
