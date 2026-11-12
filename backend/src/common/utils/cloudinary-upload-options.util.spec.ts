import { buildCloudinaryUploadOptions } from './cloudinary-upload-options.util';

describe('buildCloudinaryUploadOptions', () => {
  it('builds responsive image transforms and eager thumbnails', () => {
    const options = buildCloudinaryUploadOptions({
      folder: 'profile-pictures',
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 'auto:good',
      thumbnailWidth: 200,
      thumbnailHeight: 200,
    });

    expect(options.folder).toBe('profile-pictures');
    expect(options.resource_type).toBe('image');
    expect(options.transformation).toEqual([
      { width: 1200, height: 1200, crop: 'limit' },
      { quality: 'auto:good' },
      { fetch_format: 'auto' },
    ]);
    expect(options.eager).toEqual([
      {
        width: 200,
        height: 200,
        crop: 'fill',
        quality: 'auto:good',
        fetch_format: 'auto',
      },
    ]);
  });

  it.each([
    ['maxWidth', 0],
    ['maxHeight', -1],
    ['thumbnailWidth', 1.5],
    ['thumbnailHeight', Number.NaN],
  ] as const)('rejects an invalid %s', (name, value) => {
    expect(() => buildCloudinaryUploadOptions({ [name]: value })).toThrow(
      new RegExp(`${name} must be a positive integer`),
    );
  });

  it('rejects an unsupported resource type', () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      buildCloudinaryUploadOptions({ resourceType: 'pdf' as any }),
    ).toThrow(/Unsupported Cloudinary resource_type/);
  });
});
