export function beatportSearchUrl(artist: string, title: string): string {
  return `https://www.beatport.com/search?q=${encodeURIComponent(artist + ' ' + title)}`;
}

export function bandcampSearchUrl(artist: string, title: string): string {
  return `https://bandcamp.com/search?q=${encodeURIComponent(artist + ' ' + title)}`;
}
