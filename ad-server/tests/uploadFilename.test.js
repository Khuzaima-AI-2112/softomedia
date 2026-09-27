import { decodeUploadFilename } from '../src/utils/uploadFilename.js';

const asLatin1 = name => Buffer.from(name, 'utf8').toString('latin1');

describe('decodeUploadFilename', () => {
    it.each([
        '—Pngtree—up to 20 off price_8775259.png',
        '“quoted”.png',
        'Café Montréal.png',
    ])('recovers %s from its UTF-8 bytes read as Latin-1', name => {
        expect(decodeUploadFilename(asLatin1(name))).toBe(name);
    });

    it.each([
        ['plain ASCII', 'creative.png'],
        ['a name already decoded as UTF-8', '—Pngtree—.png'],
        ['a Latin-1 name whose bytes are not UTF-8', 'Café.png'],
    ])('leaves %s unchanged', (_, name) => {
        expect(decodeUploadFilename(name)).toBe(name);
    });

    it('passes a missing filename through', () => {
        expect(decodeUploadFilename(undefined)).toBeUndefined();
    });
});
