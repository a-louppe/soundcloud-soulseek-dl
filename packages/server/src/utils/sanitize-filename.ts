export function sanitizeFilename(artist: string, title: string, ext: string): string {
  const sanitize = (s: string) =>
    s
      .replace(/[\/\\:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();

  return `${sanitize(artist)} - ${sanitize(title)}.${ext}`;
}
