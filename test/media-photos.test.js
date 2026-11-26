import assert from 'node:assert/strict';
import test from 'node:test';
import { feedPhotoImages, PHOTO_IMG, photoAt } from '../src/features/media/photos.js';

function image(id) {
  return { id };
}

test('feedPhotoImages upgrades only the images of post photos', () => {
  const root = {};
  const article = {};
  const photo = image('photo');
  const videoPoster = image('video');
  const photoHost = { querySelectorAll: (selector) => (selector === PHOTO_IMG ? [photo] : []) };
  const videoHost = { querySelectorAll: () => [videoPoster] };
  const api = {
    getArticles: (node) => (node === root ? [article] : []),
    getMediaHosts: (node) =>
      node === article
        ? [
            { el: photoHost, kind: 'photo', owner: 'main' },
            { el: videoHost, kind: 'video', owner: 'main' },
          ]
        : [],
  };

  assert.deepEqual(feedPhotoImages(root, api), [photo]);
});

test('feedPhotoImages returns an image once when two articles report it', () => {
  const shared = image('shared');
  const host = { querySelectorAll: () => [shared] };
  const hosts = (node) => [{ el: host, kind: 'photo', owner: 'main' }];
  const api = {
    getArticles: () => [{}, {}],
    getMediaHosts: hosts,
  };

  assert.deepEqual(feedPhotoImages({}, api), [shared]);
});

test('photoAt picks the photo the click landed on inside a media grid', () => {
  const overlay = {};
  const first = { parentElement: { contains: () => false } };
  const second = { parentElement: { contains: (node) => node === overlay } };
  const host = { querySelectorAll: () => [first, second] };

  assert.equal(photoAt(host, overlay), second);
});

test('photoAt falls back to the only photo of a single-photo host', () => {
  const only = { parentElement: { contains: () => false } };
  const host = { querySelectorAll: () => [only] };

  assert.equal(photoAt(host, {}), only);
});

test('photoAt returns null when a media host holds no photo', () => {
  assert.equal(photoAt({ querySelectorAll: () => [] }, {}), null);
});
