import {
  forwardRef,
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { pdfjs } from '../services/pdf';
import { pdfPercentage } from '../services/progress';
import { THEME_COLORS, type ReaderHandle, type TocItem, type ViewProps } from './types';
import './pdf-text-layer.css';

/** Largeur maximale d'une page à zoom 100 %, pour rester lisible sur grand écran. */
const MAX_PAGE_WIDTH = 900;

const THEME_FILTERS = {
  light: 'none',
  sepia: 'sepia(0.35) brightness(0.97)',
  dark: 'invert(0.88) hue-rotate(180deg)',
};

type OutlineNode = Awaited<ReturnType<PDFDocumentProxy['getOutline']>>[number];

async function resolvePage(pdf: PDFDocumentProxy, dest: OutlineNode['dest']): Promise<number | null> {
  try {
    const explicit = typeof dest === 'string' ? await pdf.getDestination(dest) : dest;
    if (!Array.isArray(explicit) || explicit.length === 0) return null;
    const ref = explicit[0];
    if (typeof ref === 'number') return ref + 1;
    return (await pdf.getPageIndex(ref)) + 1;
  } catch {
    return null;
  }
}

async function buildToc(pdf: PDFDocumentProxy, nodes: OutlineNode[], prefix = 'pdf'): Promise<TocItem[]> {
  const items = await Promise.all(
    nodes.map(async (node, i) => ({
      id: `${prefix}-${i}`,
      label: node.title,
      target: await resolvePage(pdf, node.dest),
      children: await buildToc(pdf, node.items ?? [], `${prefix}-${i}`),
    })),
  );
  return items;
}

/** Titre de la dernière entrée de sommaire qui commence avant ou sur cette page. */
function chapterForPage(toc: TocItem[], page: number): string | undefined {
  let best: { label: string; page: number } | undefined;
  const visit = (items: TocItem[]) => {
    for (const item of items) {
      const target = item.target as number | null;
      if (target !== null && target <= page && (!best || target >= best.page)) {
        best = { label: item.label, page: target };
      }
      visit(item.children);
    }
  };
  visit(toc);
  return best?.label;
}

const PdfView = forwardRef<ReaderHandle, ViewProps>(function PdfView(props, ref) {
  const { file, settings, initialPosition } = props;

  // Fonctions appelées depuis les effets, sans en être des dépendances.
  const onReady = useEffectEvent((toc: TocItem[]) => props.onReady(toc));
  const onLocationChange = useEffectEvent((...args: Parameters<ViewProps['onLocationChange']>) =>
    props.onLocationChange(...args),
  );
  const onError = useEffectEvent((message: string) => props.onError(message));

  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const tocRef = useRef<TocItem[]>([]);

  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [pageNumber, setPageNumber] = useState(() =>
    initialPosition?.format === 'pdf' ? Math.max(1, Math.floor(initialPosition.page)) : 1,
  );
  const [availableWidth, setAvailableWidth] = useState(0);
  const [pageSize, setPageSize] = useState<{ width: number; height: number; scale: number }>();

  useImperativeHandle(
    ref,
    () => ({
      next: () => setPageNumber((n) => (pdf ? Math.min(n + 1, pdf.numPages) : n)),
      prev: () => setPageNumber((n) => Math.max(n - 1, 1)),
      goTo: (item) => {
        if (typeof item.target === 'number') setPageNumber(item.target);
      },
    }),
    [pdf],
  );

  // Chargement du document et de son sommaire.
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof pdfjs.getDocument> | undefined;
    (async () => {
      const data = new Uint8Array(await file.arrayBuffer());
      if (cancelled) return;
      task = pdfjs.getDocument({ data });
      const doc = await task.promise;
      const toc = await buildToc(doc, (await doc.getOutline()) ?? []);
      if (cancelled) return;
      tocRef.current = toc;
      // Une position enregistrée peut dépasser la fin si le fichier a changé.
      setPageNumber((n) => Math.min(n, doc.numPages));
      setPdf(doc);
      onReady(toc);
    })().catch((error) => {
      if (cancelled) return;
      console.error(error);
      onError('Impossible d’ouvrir ce PDF.');
    });

    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [file]);

  // Largeur disponible, pour ajuster la page à l'écran.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Rendu de la page courante : image (canvas) + couche de texte sélectionnable.
  useEffect(() => {
    if (!pdf || availableWidth === 0) return;
    let cancelled = false;
    let renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    let textLayer: InstanceType<typeof pdfjs.TextLayer> | undefined;

    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const fitWidth = Math.min(availableWidth - 32, MAX_PAGE_WIDTH);
      const scale = (fitWidth / base.width) * settings.pdfZoom;
      const viewport = page.getViewport({ scale });
      const ratio = window.devicePixelRatio || 1;

      const canvas = canvasRef.current!;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      setPageSize({ width: viewport.width, height: viewport.height, scale });

      renderTask = page.render({
        canvas,
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
      });

      const container = textLayerRef.current!;
      container.replaceChildren();
      textLayer = new pdfjs.TextLayer({
        textContentSource: page.streamTextContent(),
        container,
        viewport,
      });
      await Promise.all([renderTask.promise, textLayer.render()]);
    })().catch((error) => {
      if (cancelled || error?.name === 'RenderingCancelledException') return;
      console.error(error);
      onError('Impossible d’afficher cette page.');
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [pdf, pageNumber, availableWidth, settings.pdfZoom]);

  // Changement de page : retour en haut et signalement de la nouvelle position
  // (séparé du rendu, qui se relance aussi au zoom).
  useEffect(() => {
    if (!pdf) return;
    scrollRef.current?.scrollTo({ top: 0 });
    onLocationChange({
      position: { format: 'pdf', page: pageNumber },
      percentage: pdfPercentage(pageNumber, pdf.numPages),
      chapter: chapterForPage(tocRef.current, pageNumber),
      label: `Page ${pageNumber} / ${pdf.numPages}`,
    });
  }, [pdf, pageNumber]);

  const pageStyle = {
    width: pageSize?.width,
    height: pageSize?.height,
    '--total-scale-factor': pageSize?.scale ?? 1,
    '--scale-round-x': '1px',
    '--scale-round-y': '1px',
  } as CSSProperties;

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-auto py-4"
      style={{ background: THEME_COLORS[settings.theme].background }}
    >
      <div className="relative mx-auto shadow-lg" style={pageStyle}>
        <canvas ref={canvasRef} className="block h-full w-full" style={{ filter: THEME_FILTERS[settings.theme] }} />
        <div ref={textLayerRef} className="textLayer" />
      </div>
    </div>
  );
});

export default PdfView;
