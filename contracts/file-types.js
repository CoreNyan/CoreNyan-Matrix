export const IMAGE_TYPES = Object.freeze({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.bmp': 'image/bmp', '.svg': 'image/svg+xml' });
export const isImageFile = name => Object.hasOwn(IMAGE_TYPES, '.' + String(name).split('.').pop().toLowerCase());
export const isBinaryFile = name => isImageFile(name) || /\.(exe|dll|pdb|rdb|aof|zip|gz|woff2?|ttf|mp[34]|pdf|bin)$/i.test(name);
