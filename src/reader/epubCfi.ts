import { EpubCFI } from 'epubjs';
import type { CfiComparator } from '../services/highlights';

const cfi = new EpubCFI();

/** Ordre de lecture entre deux positions EPUB. */
export const compareCfi: CfiComparator = (a, b) => cfi.compare(a, b);
