const { readdir, writeFile } = require('node:fs/promises');
const { join, relative, sep } = require('node:path');

const ROOT = __dirname;
const FACT_DIR = join(ROOT, 'images', 'facts');
const THUMBNAIL_DIR = join(ROOT, 'images', 'thumbs');

async function collectWebp(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) return collectWebp(fullPath);
    return /\.webp$/i.test(entry.name) ? [fullPath] : [];
  }));
  return paths.flat();
}

async function main() {
  const images = (await collectWebp(FACT_DIR)).map((path) => ({
    absolutePath: path,
    relativePath: relative(FACT_DIR, path).split(sep).join('/')
  }));
  const thumbnails = new Map((await collectWebp(THUMBNAIL_DIR)).map((path) => [
    relative(THUMBNAIL_DIR, path).split(sep).join('/').toLowerCase(),
    path
  ]));

  const missingThumbnails = images
    .map(({ relativePath }) => relativePath)
    .filter((path) => !thumbnails.has(path.toLowerCase()));
  const imageNames = new Set(images.map(({ relativePath }) => relativePath.toLowerCase()));
  const orphanThumbnails = [...thumbnails.keys()].filter((path) => !imageNames.has(path));
  if (missingThumbnails.length) throw new Error(`Obrazy bez miniatur: ${missingThumbnails.join(', ')}`);
  if (orphanThumbnails.length) throw new Error(`Miniatury bez obrazów: ${orphanThumbnails.join(', ')}`);

  const items = images
    .map(({ absolutePath, relativePath }) => ({
      image: relative(ROOT, absolutePath).split(sep).join('/'),
      thumbnail: relative(ROOT, thumbnails.get(relativePath.toLowerCase())).split(sep).join('/')
    }))
    .sort((a, b) => a.image.localeCompare(b.image, 'pl'));

  const manifest = { generatedAt: new Date().toISOString(), count: items.length, items };
  await writeFile(join(ROOT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Zapisano manifest.json: ${items.length} obrazów z miniaturami.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
