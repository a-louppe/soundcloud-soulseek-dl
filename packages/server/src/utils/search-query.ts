export interface SearchQueryInput {
  artist: string;
  originalArtist: string;
  title: string;
  label: string | null;
}

export function buildSearchQuery(input: SearchQueryInput): string {
  const { artist, originalArtist, title, label } = input;

  let cleanTitle = title;

  // 1. Strip premiere/exclusive prefixes
  //    Handles: "PREMIERE:", "TRACK PREMIERE:", "Premiere:", "PREMIERE |",
  //    "[PREMIERE]", "MOTZ Premiere:", "!!! PREMIERE!!!:", "EXCLUSIVE:"
  cleanTitle = cleanTitle
    .replace(/^!*\s*(?:[\w\s]+\s)?TRACK\s+PREMIERE\s*!*\s*[:|\-]\s*/i, '')
    .replace(/^!*\s*(?:[\w\s]+\s)?PREMIERE\s*!*\s*[:|\-]\s*/i, '')
    .replace(/^\[PREMIERE\]\s*/i, '')
    .replace(/^EXCLUSIVE\s*[:|\-]\s*/i, '');

  // 2. Strip free download / preview markers in all their forms
  cleanTitle = cleanTitle
    // Bracketed: (Free Download), [FREE DL], [Free Download - artist], etc.
    .replace(/\s*[\(\[](?:Free\s*(?:Download|DL\b)[^\)\]]*|NOW\s+IN\s+FREE\s+DL)[\)\]]/gi, '')
    // Asterisk-wrapped: **FREE DOWNLOAD**, *FREE DOWNLOAD*
    .replace(/\s*\*{1,2}(?:FREE\s*(?:DOWNLOAD|DL)|PREVIEW)\*{1,2}/gi, '')
    // Pipe-separated: | Free Download |, | OUT NOW |, | Released on Label |
    .replace(/\s*\|\s*(?:Free\s*(?:Download|DL)|OUT\s*NOW|Released\s+on\s+[^|]+)\s*\|?\s*/gi, '')
    // Trailing plain text: Free Download, FREE DL WAV, Free Dl
    .replace(/\s+Free\s*(?:Download|DL)(?:\s+WAV)?\s*$/i, '')
    // Bracketed preview: [PREVIEW], (PREVIEW)
    .replace(/\s*[\(\[]PREVIEW[\)\]]/gi, '')
    // Comment-style: // snippet preview
    .replace(/\s*\/\/\s*snippet\s+preview\s*$/i, '');

  // 3. Strip label/catalog brackets — keep musical terms (Remix, VIP, Edit, etc.)
  const labelNames = [originalArtist, label]
    .filter((s): s is string => Boolean(s))
    .map((s) => s.toLowerCase().trim());

  cleanTitle = cleanTitle.replace(/\s*[\[\(]\s*([^\]\)]+)\s*[\]\)]/g, (match, content) => {
    const trimmed = content.trim();
    const lower = trimmed.toLowerCase();

    // Keep known musical terms
    if (
      /^(?:remix|vip|bootleg|edit|rework|dub|instrumental|radio|extended|club|original)\s*(?:mix)?$/i.test(
        trimmed,
      )
    ) {
      return match;
    }
    // Keep artist remix credits like "(Artist Remix)"
    if (/remix\s*\)?\s*$/i.test(trimmed)) {
      return match;
    }

    // Remove if contains premiere/exclusive
    if (/premiere|exclusive/i.test(trimmed)) {
      return '';
    }

    // Remove if matches label/uploader name
    if (labelNames.some((ln) => lower === ln || lower.includes(ln) || ln.includes(lower))) {
      return '';
    }

    // Remove if looks like a catalog code: "COM024", "MONNOM BLACK 037", "SYNDIG009", "VPFD8.8"
    if (/^[A-Z][A-Z\s\d.]*\d+[\s\d.]*$/i.test(trimmed)) {
      return '';
    }

    return match;
  });

  // 4. Strip trailing "Out now!" and similar noise
  cleanTitle = cleanTitle.replace(/\s+Out\s+Now\s*!?\s*$/i, '');

  // 5. Strip common mix/version suffixes
  cleanTitle = cleanTitle.replace(
    /\s*[\(\[](?:Original|Extended|Radio|Club|Dub|Instrumental)\s*Mix[\)\]]/gi,
    '',
  );

  // 6. Strip official media tags
  cleanTitle = cleanTitle.replace(
    /\s*[\(\[](?:Official\s*(?:Audio|Video|Music\s*Video|Visualizer))[\)\]]/gi,
    '',
  );

  // 7. Strip feat./ft.
  cleanTitle = cleanTitle.replace(/\s*[\(\[]?(?:feat\.?|ft\.?)\s+[^\)\]]+[\)\]]?/gi, '');

  // 8. Handle "Artist - Title" embedded in the title field
  //    When the uploader is a label, the title often contains "RealArtist - ActualTrackName"
  let searchArtist = artist;

  const dashMatch = cleanTitle.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (dashMatch) {
    const titleArtistPart = dashMatch[1].trim();
    const titleTrackPart = dashMatch[2].trim();

    if (artist.toLowerCase() === originalArtist.toLowerCase()) {
      // artist == uploader (no publisher_metadata) — extract real artist from title
      searchArtist = titleArtistPart;
      cleanTitle = titleTrackPart;
    } else {
      // publisher_metadata gave us a real artist — just use the track part to avoid duplication
      cleanTitle = titleTrackPart;
    }
  }

  // 9. Normalize collaboration separators: "A x B" → "A B", "A & B" stays (common in filenames)
  searchArtist = searchArtist.replace(/\s+x\s+/gi, ' ');

  // 10. Final cleanup
  cleanTitle = cleanTitle.replace(/\s{2,}/g, ' ').trim();
  searchArtist = searchArtist.replace(/\s{2,}/g, ' ').trim();

  return `${searchArtist} ${cleanTitle}`;
}
