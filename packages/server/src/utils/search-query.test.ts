import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchQuery } from './search-query.js';

function q(
  artist: string,
  title: string,
  opts: { originalArtist?: string; label?: string | null } = {},
) {
  return buildSearchQuery({
    artist,
    originalArtist: opts.originalArtist ?? artist,
    title,
    label: opts.label ?? null,
  });
}

describe('buildSearchQuery', () => {
  describe('premiere prefixes', () => {
    it('strips "PREMIERE:" prefix', () => {
      assert.equal(
        q('Involve Records', 'PREMIERE: AcidBoy - Automatic Control [ Involve Records  ]'),
        'AcidBoy Automatic Control',
      );
    });

    it('strips "TRACK PREMIERE:" prefix', () => {
      assert.equal(
        q('Monnom Black', 'TRACK PREMIERE: Lars Huismann - Claws [MONNOM BLACK 037]'),
        'Lars Huismann Claws',
      );
    });

    it('strips "Premiere:" prefix', () => {
      assert.equal(q('DLV', 'Premiere: DLV - Rave Instructor'), 'DLV Rave Instructor');
    });

    it('strips "PREMIERE |" prefix', () => {
      assert.equal(
        q('Subios Records', 'PREMIERE | SWART - Power Lust Greed Fame'),
        'SWART Power Lust Greed Fame',
      );
    });

    it('strips "[PREMIERE]" prefix', () => {
      assert.equal(q('RR', '[PREMIERE] DRVSH - Grandis & Deviens [RR010]', { label: 'RR' }), 'DRVSH Grandis & Deviens');
    });

    it('strips "MOTZ Premiere:" prefix', () => {
      assert.equal(
        q('MOTZ', 'MOTZ Premiere: Dersee - Numéro Uno (DICA Remix) [SYNDIG009]'),
        'Dersee Numéro Uno (DICA Remix)',
      );
    });

    it('strips "!!! PREMIERE!!!:" prefix', () => {
      assert.equal(
        q('SomeLabel', '!!! PREMIERE!!!: Mex Calito - Contact High (APHE Remix)'),
        'Mex Calito Contact High (APHE Remix)',
      );
    });
  });

  describe('free download markers', () => {
    it('strips [FREE DOWNLOAD]', () => {
      assert.equal(q('Artist', 'Bass Check [FREE DOWNLOAD]'), 'Artist Bass Check');
    });

    it('strips **FREE DOWNLOAD**', () => {
      assert.equal(
        q('AlpaKa MuziK', 'Psidn & Mark Valsecchi - Magentic Planes (Original Mix) **FREE DOWNLOAD**'),
        'Psidn & Mark Valsecchi Magentic Planes',
      );
    });

    it('strips | Free Download |', () => {
      assert.equal(
        q('Label', 'Poumtica - Leave Me Alone [DSD019] | Free Download |', { label: 'Label' }),
        'Poumtica Leave Me Alone',
      );
    });

    it('strips trailing Free Download', () => {
      assert.equal(
        q('CR3WFX', 'CR3WFX - All For You (Original Mix) Free Download'),
        'CR3WFX All For You',
      );
    });

    it('strips trailing FREE DL WAV', () => {
      assert.equal(q('CR3WFX', 'Vibes (Original Mix) Free Dl WAV'), 'CR3WFX Vibes');
    });

    it('strips (Free Download)', () => {
      assert.equal(q('Artist', 'Never Let Go (Free Download)'), 'Artist Never Let Go');
    });
  });

  describe('preview markers', () => {
    it('strips **PREVIEW**', () => {
      assert.equal(
        q('AlpaKa MuziK', 'Jai - Funk (Original Mix) **PREVIEW**'),
        'Jai Funk',
      );
    });
  });

  describe('label/catalog brackets', () => {
    it('strips bracket matching uploader name', () => {
      assert.equal(
        q('AlpaKa MuziK', 'Greenwolve x Unknown Concept - Squid (Original Mix) [AlpaKa MuziK]'),
        'Greenwolve Unknown Concept Squid',
      );
    });

    it('strips catalog codes like [MONNOM BLACK 035]', () => {
      assert.equal(
        q('Stef Mendesidis', 'Stef Mendesidis - Magma [MONNOM BLACK 035]', {
          originalArtist: 'Monnom Black',
          label: 'Monnom Black',
        }),
        'Stef Mendesidis Magma',
      );
    });

    it('strips catalog codes like [COM024]', () => {
      assert.equal(q('Label', '[COM024] Arkane - GT85', { label: 'Label' }), 'Arkane GT85');
    });

    it('keeps remix credits in brackets', () => {
      assert.equal(
        q('Torsten Kanzler', 'Torsten Kanzler - Raven (Freak Unique Remix)'),
        'Torsten Kanzler Raven (Freak Unique Remix)',
      );
    });

    it('strips brackets with spaces like [ FLASH Recordings ]', () => {
      assert.equal(
        q('FLASH Recordings', 'Anml Mthr - Serious Drops [ FLASH Recordings ]'),
        'Anml Mthr Serious Drops',
      );
    });
  });

  describe('out now / trailing noise', () => {
    it('strips "Out now!"', () => {
      assert.equal(
        q('MAXX ROSSI', 'MAXX ROSSI - Anomaly [Polymeric 9] Out now!', {
          originalArtist: 'Polymeric Records',
        }),
        'MAXX ROSSI Anomaly',
      );
    });

    it('strips "| Released on Label"', () => {
      assert.equal(
        q('Airi', 'Airi - Sooner | Released on Padang Records'),
        'Airi Sooner',
      );
    });
  });

  describe('mix suffixes', () => {
    it('strips (Original Mix)', () => {
      assert.equal(q('Artist', 'Track (Original Mix)'), 'Artist Track');
    });

    it('strips (Extended Mix)', () => {
      assert.equal(q('Artist', 'Track (Extended Mix)'), 'Artist Track');
    });
  });

  describe('feat/ft removal', () => {
    it('strips feat. in parens', () => {
      assert.equal(q('Artist', 'Track (feat. Someone)'), 'Artist Track');
    });

    it('strips ft. without parens', () => {
      assert.equal(q('Artist', 'Track ft. Someone'), 'Artist Track');
    });
  });

  describe('artist-in-title extraction', () => {
    it('extracts artist from title when uploader is a label (no publisher_metadata)', () => {
      assert.equal(
        q('Involve Records', 'ACIDBOY - Energy Circuit'),
        'ACIDBOY Energy Circuit',
      );
    });

    it('uses publisher_metadata artist and strips title artist part to avoid duplication', () => {
      assert.equal(
        q('ACIDBOY', 'ACIDBOY - Energy Circuit', {
          originalArtist: 'Involve Records',
          label: 'Involve Records',
        }),
        'ACIDBOY Energy Circuit',
      );
    });

    it('handles en-dash separator', () => {
      assert.equal(
        q('Groove Magazin', 'Hadone & Anetha – 4pm Snacks'),
        'Hadone & Anetha 4pm Snacks',
      );
    });
  });

  describe('collaboration normalization', () => {
    it('normalizes "x" separator in artist', () => {
      assert.equal(
        q('AlpaKa MuziK', 'Greenwolve x Unknown Concept - Squid [AlpaKa MuziK]'),
        'Greenwolve Unknown Concept Squid',
      );
    });
  });

  describe('complex real-world cases', () => {
    it('handles full label + premiere + catalog', () => {
      assert.equal(
        q('Monnom Black', 'TRACK PREMIERE: Lars Huismann - Claws [MONNOM BLACK 037]'),
        'Lars Huismann Claws',
      );
    });

    it('handles label with free download and original mix', () => {
      assert.equal(
        q('AlpaKa MuziK', 'Smooth Criminal & DiFaZ - Aftermath (Original Mix) **FREE DOWNLOAD**'),
        'Smooth Criminal & DiFaZ Aftermath',
      );
    });

    it('handles artist who uploads own tracks (no dash in title)', () => {
      assert.equal(q('ECZODIA', 'ECZODIA - Smash It'), 'ECZODIA Smash It');
    });

    it('handles simple title with no noise', () => {
      assert.equal(q('CR3WFX', 'Move Your Body'), 'CR3WFX Move Your Body');
    });

    it('handles | Premiere at end', () => {
      assert.equal(
        q('SomeLabel', 'MOES & Samoh - Emergence [VAGUE009 | Premiere]', { label: 'SomeLabel' }),
        'MOES & Samoh Emergence',
      );
    });
  });
});
