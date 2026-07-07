import JSZip from "jszip";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

/* ---------------------------------------------------------------- helpers */

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const xmlUnescape = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

export function stripJsonFences(raw: string): string {
  return raw.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
}

/* --------------------------------------------------------- docx surgery */

const P_RE = /<w:p[ >][\s\S]*?<\/w:p>/g;
const T_RE = /(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g;

export type DocxParagraph = { index: number; text: string };

/** Extract paragraph texts (index = position among ALL paragraphs) from document.xml. */
export function docxParagraphs(documentXml: string): DocxParagraph[] {
  const out: DocxParagraph[] = [];
  let m: RegExpExecArray | null;
  let i = 0;
  P_RE.lastIndex = 0;
  while ((m = P_RE.exec(documentXml))) {
    let text = "";
    let t: RegExpExecArray | null;
    T_RE.lastIndex = 0;
    while ((t = T_RE.exec(m[0]))) text += xmlUnescape(t[2]);
    out.push({ index: i, text });
    i++;
  }
  return out;
}

/**
 * Replace the text of selected paragraphs while keeping every bit of the
 * document's formatting XML intact. The new text goes into the paragraph's
 * first run; remaining runs are emptied (their formatting nodes stay).
 */
export function applyDocxReplacements(documentXml: string, replacements: Map<number, string>): string {
  let i = -1;
  return documentXml.replace(P_RE, (para) => {
    i++;
    const next = replacements.get(i);
    if (next === undefined) return para;
    let first = true;
    return para.replace(T_RE, (_all, open: string, _text: string, close: string) => {
      if (first) {
        first = false;
        const openPreserve = open.includes("xml:space")
          ? open
          : open.replace(/<w:t/, '<w:t xml:space="preserve"');
        return `${openPreserve}${xmlEscape(next)}${close}`;
      }
      return `${open}${close}`;
    });
  });
}

export async function editDocx(originalB64: string, replacements: Map<number, string>): Promise<Buffer> {
  const zip = await JSZip.loadAsync(Buffer.from(originalB64, "base64"));
  const doc = zip.file("word/document.xml");
  if (!doc) throw new Error("not a docx");
  const xml = await doc.async("string");
  zip.file("word/document.xml", applyDocxReplacements(xml, replacements));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }) as Promise<Buffer>;
}

/* ------------------------------------------------- clean docx from JSON */

export type CleanResume = {
  name: string;
  contact: string;
  sections: {
    heading: string;
    items: { title?: string; subtitle?: string; bullets?: string[]; text?: string }[];
  }[];
};

export async function buildCleanDocx(r: CleanResume): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: r.name, bold: true, size: 32 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: r.contact, size: 18, color: "444444" })],
    }),
  ];
  for (const sec of r.sections ?? []) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 80 },
        children: [new TextRun({ text: sec.heading.toUpperCase(), bold: true, size: 22 })],
        border: { bottom: { style: "single" as const, size: 6, space: 2, color: "999999" } },
      }),
    );
    for (const item of sec.items ?? []) {
      if (item.title) {
        children.push(
          new Paragraph({
            spacing: { before: 100, after: 20 },
            children: [
              new TextRun({ text: item.title, bold: true, size: 21 }),
              ...(item.subtitle ? [new TextRun({ text: `  —  ${item.subtitle}`, italics: true, size: 20, color: "555555" })] : []),
            ],
          }),
        );
      }
      if (item.text) {
        children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: item.text, size: 20 })] }));
      }
      for (const b of item.bullets ?? []) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 20 },
            children: [new TextRun({ text: b, size: 20 })],
          }),
        );
      }
    }
  }
  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri" } } } },
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children }],
  });
  return Packer.toBuffer(doc);
}
