export function buildSearchQuery(artist: string, title: string): string {
  let cleanTitle = title
    // Remove common mix/version suffixes
    .replace(/\s*[\(\[](?:Original|Extended|Radio|Club|Dub|Instrumental)\s*Mix[\)\]]/gi, '')
    // Remove promo/marketing tags
    .replace(/\s*[\(\[](?:Free\s*(?:Download|DL)|Out\s*Now|Premiere|Exclusive)[\)\]]/gi, '')
    // Remove media type tags
    .replace(/\s*[\(\[](?:Official\s*(?:Audio|Video|Music\s*Video|Visualizer))[\)\]]/gi, '')
    // Remove feat./ft. from title for cleaner search
    .replace(/\s*[\(\[]?(?:feat\.?|ft\.?)\s+[^\)\]]+[\)\]]?/gi, '')
    .trim();

  // Remove any double spaces
  cleanTitle = cleanTitle.replace(/\s{2,}/g, ' ');

  return `${artist} ${cleanTitle}`;
}
