/**
 * parse-mcqs.js  –  Final Version
 * 
 *  npm install mammoth cheerio uuid
 */

const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const cheerio = require("cheerio");
const { v4: uuid } = require("uuid");

/* Paths */
const DOCX_FILE = "./testing.docx";
const JSON_FILE = "./mcqs.json";
const IMG_DIR   = "./uploads/images";

/* Ensure image folder exists */
if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

/* Helpers */
/* 1) Strict prefix matching: Q:) or Q) only */
const prefixRE = (ch) => new RegExp(`^${ch}(?:\\)|:\\))\\s*`);

/* 2) Clean leading/trailing <br> */
const cleanEdgeBr = (s) =>
  s.replace(/^(?:<br\s*\/?>\s*)+/i, "")
   .replace(/(?:<br\s*\/?>\s*)+$/i, "")
   .trim();

/* 3) Extract <img> from HTML, save to disk, update src */
const extractImages = (htmlFragment) => {
  if (!htmlFragment) return htmlFragment;
  const $frag = cheerio.load(htmlFragment, null, false);

  $frag("img[src^='data:image/']").each((_, img) => {
    const $img = $frag(img);
    const dataUri = $img.attr("src");
    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUri);
    if (!match) return;

    const mime = match[1];
    const ext = mime.split("/")[1];
    const fileName = `${uuid()}.${ext}`;
    const outPath = path.join(IMG_DIR, fileName);

    fs.writeFileSync(outPath, Buffer.from(match[2], "base64"));
    $img.attr("src", path.join(IMG_DIR.replace(/^\.\//, ""), fileName)); // relative src
  });

  return $frag.html();
};

/* 4) Smart field appender */
const pushText = (target, htmlText, cur) => {
  if (!cur || !target) return;
  const cleaned = cleanEdgeBr(extractImages(htmlText));
  if (!cleaned) return;
  const add = (prev) => (prev ? prev + "<br>" + cleaned : cleaned);

  switch (target) {
    case "question":       cur.questionText       = add(cur.questionText); break;
    case "A":              cur.options.A           = add(cur.options.A); break;
    case "B":              cur.options.B           = add(cur.options.B); break;
    case "C":              cur.options.C           = add(cur.options.C); break;
    case "D":              cur.options.D           = add(cur.options.D); break;
    case "gen":            cur.explanationGeneral  = add(cur.explanationGeneral); break;
    case "Aexp":           cur.explanationA        = add(cur.explanationA); break;
    case "Bexp":           cur.explanationB        = add(cur.explanationB); break;
    case "Cexp":           cur.explanationC        = add(cur.explanationC); break;
    case "Dexp":           cur.explanationD        = add(cur.explanationD); break;
  }
};

/* Main Script */
(async () => {
  try {
    /* 1. Convert DOCX to HTML */
    const { value: html } = await mammoth.convertToHtml(
      { path: DOCX_FILE },
      { styleMap: ["sup => sup", "sub => sub"] }
    );

    /* 2. Parse paragraphs */
    const $ = cheerio.load(html);
    const lines = $("p")
      .map((_, p) => $(p).html().replace(/&nbsp;/gi, " ").trim())
      .get()
      .filter(Boolean);

    /* 3. Walk through lines */
    const mcqs = [];
    let cur = null;
    let part = null;

    for (let raw of lines) {
      if (/^Q(?:\)|:\))\s*/.test(raw)) {
        if (cur) mcqs.push(cur);
        cur = {
          questionText: "",
          options: { A: "", B: "", C: "", D: "" },
          correctAnswer: "",
          explanationGeneral: "",
          explanationA: "",
          explanationB: "",
          explanationC: "",
          explanationD: ""
        };
        raw = raw.replace(prefixRE("Q"), "");
        part = "question";
        pushText(part, raw, cur);
        continue;
      }

      if (/^A(?:\)|:\))\s*/.test(raw)) { part = "A"; raw = raw.replace(prefixRE("A"), ""); pushText(part, raw, cur); continue; }
      if (/^B(?:\)|:\))\s*/.test(raw)) { part = "B"; raw = raw.replace(prefixRE("B"), ""); pushText(part, raw, cur); continue; }
      if (/^C(?:\)|:\))\s*/.test(raw)) { part = "C"; raw = raw.replace(prefixRE("C"), ""); pushText(part, raw, cur); continue; }
      if (/^D(?:\)|:\))\s*/.test(raw)) { part = "D"; raw = raw.replace(prefixRE("D"), ""); pushText(part, raw, cur); continue; }

      if (/^:Correct:/i.test(raw)) { cur.correctAnswer = raw.replace(/^:Correct:\s*/, "").trim(); part = null; continue; }
      if (/^:Explanation:/i.test(raw))  { part = "gen";  raw = raw.replace(/^:Explanation:\s*/, ""); pushText(part, raw, cur); continue; }
      if (/^:ExplanationA:/i.test(raw)) { part = "Aexp"; raw = raw.replace(/^:ExplanationA:\s*/, ""); pushText(part, raw, cur); continue; }
      if (/^:ExplanationB:/i.test(raw)) { part = "Bexp"; raw = raw.replace(/^:ExplanationB:\s*/, ""); pushText(part, raw, cur); continue; }
      if (/^:ExplanationC:/i.test(raw)) { part = "Cexp"; raw = raw.replace(/^:ExplanationC:\s*/, ""); pushText(part, raw, cur); continue; }
      if (/^:ExplanationD:/i.test(raw)) { part = "Dexp"; raw = raw.replace(/^:ExplanationD:\s*/, ""); pushText(part, raw, cur); continue; }

      /* Otherwise: continue adding to current section */
      pushText(part, raw, cur);
    }
    if (cur) mcqs.push(cur);

    /* 4. Save output */
    fs.writeFileSync(JSON_FILE, JSON.stringify(mcqs, null, 2), "utf8");
    console.log(`✅ Parsed ${mcqs.length} MCQs successfully → ${JSON_FILE}`);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
