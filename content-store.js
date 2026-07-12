let contentByImage = new Map();

export async function loadContent(url = 'content.json') {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const content = await response.json();
    contentByImage = new Map(
      Object.entries(content).map(([filename, fact]) => [filename.toLowerCase(), fact])
    );
  } catch (error) {
    console.warn('Ciekawostki nie zostały wczytane — zostanie użyty tekst zastępczy.', error);
    contentByImage = new Map();
  }
  return contentByImage.size;
}

export function getContentForImage(imagePath) {
  const filename = decodeURIComponent(imagePath).split('/').pop().toLowerCase();
  return contentByImage.get(filename) ?? null;
}
