import { Image } from 'react-native';
import type { Material } from '@/types';

/**
 * Sample board photos for the offline demo, so notes can be traced back to an original
 * without any upload. Only mock mode reads these; real notebooks use stored photos.
 */
const photos: Record<string, unknown[]> = {
  'binary-search-trees': [
    require('../../assets/demo/bst-board-1.jpg'),
    require('../../assets/demo/bst-board-2.jpg'),
  ],
};
const PREFIX = 'demo:';

export function demoMaterials(lectureId: string): Material[] {
  return (photos[lectureId] ?? []).map((_, index) => ({
    id: `demo-${lectureId}-${index + 1}`,
    lectureId,
    type: 'photo',
    filePath: `${PREFIX}${lectureId}:${index}`,
  }));
}

export function demoPhotoUrl(material: Material): string | null {
  if (!material.filePath.startsWith(PREFIX)) return null;
  const [lectureId, index] = material.filePath.slice(PREFIX.length).split(':');
  return assetUri(photos[lectureId]?.[Number(index)]);
}

/** Native bundles give a module number; the web bundle gives a URL string or object. */
function assetUri(asset: unknown): string | null {
  if (typeof asset === 'string') return asset;
  if (asset && typeof asset === 'object' && 'uri' in asset && typeof asset.uri === 'string')
    return asset.uri;
  if (typeof asset === 'number' && typeof Image.resolveAssetSource === 'function')
    return Image.resolveAssetSource(asset)?.uri ?? null;
  return null;
}
