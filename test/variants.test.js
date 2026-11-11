import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseVariants,
  photoExtension,
  photoUrl,
  pickVariant,
  qualityLabel,
} from '../src/features/media/variants.js';

const videoInfo = {
  variants: [
    { content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/pl.m3u8' },
    {
      content_type: 'video/mp4',
      url: 'https://video.twimg.com/640x360/abc.mp4',
      bitrate: 256000,
    },
    {
      content_type: 'video/mp4',
      url: 'https://video.twimg.com/1280x720/def.mp4',
      bitrate: 2_176_000,
    },
    { content_type: 'video/mp4', url: 'https://video.twimg.com/unknown.mp4', bitrate: 0 },
  ],
};

test('parseVariants keeps mp4 only and sorts by bitrate', () => {
  const variants = parseVariants(videoInfo);
  assert.equal(variants.length, 3);
  assert.deepEqual(
    variants.map((variant) => variant.bitrate),
    [2_176_000, 256_000, 0],
  );
  assert.equal(variants[0].quality, 720);
  assert.equal(variants[1].quality, 360);
  assert.equal(variants[2].quality, 0, 'size unknown without a WxH segment');
});

test('parseVariants falls back to the tweet size', () => {
  const [variant] = parseVariants(
    { variants: [{ content_type: 'video/mp4', url: 'https://video.twimg.com/abc.mp4' }] },
    { width: 1920, height: 1080 },
  );
  assert.equal(variant.width, 1920);
  assert.equal(variant.height, 1080);
  assert.equal(variant.quality, 1080);
});

test('pickVariant honours best / lowest / caps', () => {
  const variants = parseVariants(videoInfo);
  assert.equal(pickVariant(variants, 'best').bitrate, 2_176_000);
  assert.equal(pickVariant(variants, 'lowest').bitrate, 0);
  assert.equal(pickVariant(variants, '1080').quality, 720);
  const noFit = parseVariants({
    variants: [{ content_type: 'video/mp4', url: 'https://video.twimg.com/1920x1080/x.mp4', bitrate: 1 }],
  });
  assert.equal(pickVariant(noFit, '480').quality, 1080, 'falls back to the smallest available');
  assert.equal(pickVariant([], 'best'), null);
});

test('photo URLs and extensions', () => {
  assert.equal(
    photoUrl('https://pbs.twimg.com/media/abc.jpg'),
    'https://pbs.twimg.com/media/abc?format=jpg&name=orig',
  );
  assert.equal(
    photoUrl('https://pbs.twimg.com/media/abc.png', 'large'),
    'https://pbs.twimg.com/media/abc?format=png&name=large',
  );
  assert.equal(photoUrl('nonsense'), 'nonsense');
  assert.equal(photoExtension('https://pbs.twimg.com/media/a.JPEG'), 'jpg');
  assert.equal(photoExtension('unknown'), 'jpg');
  assert.equal(qualityLabel({ quality: 720 }), '720p');
  assert.equal(qualityLabel({ quality: 0 }), '');
});
