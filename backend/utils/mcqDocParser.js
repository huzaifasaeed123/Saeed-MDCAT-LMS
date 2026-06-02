// backend/utils/mcqDocParser.js
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const JSZip = require('jszip');
const { saveImageBuffer } = require('../services/storageService');

/**
 * Extract and parse MCQs from a Word document
 * @param {string} docxPath - Path to the Word document
 * @param {string} imageDir - Directory to save extracted images
 * @returns {Promise<Array>} - Array of parsed MCQs
 */
async function extractMCQsFromDoc(docxPath, imageDir = 'uploads/images') {
  try {
    // Create image directory if it doesn't exist
    ensureDirectoryExists(imageDir);
    
    // Extract images from docx file
    // await extractDocImages(docxPath, imageDir);
    
    // Convert Word document to HTML with preserved formatting
    const result = await mammoth.convertToHtml({
      path: docxPath,
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "r[style-name='Strong'] => strong",
        "r[style-name='Emphasis'] => em",
        "sup => sup",
        "sub => sub"
      ]
    });
    
    // Process the HTML content to extract MCQs
    const html = result.value;
    
    // Use cheerio to parse HTML
    const $ = cheerio.load(html);
    const lines = $("p")
      .map((_, p) => $(p).html().replace(/&nbsp;/gi, " ").trim())
      .get()
      .filter(Boolean);
      
    // Parse MCQs from lines. Pass 1 collects embedded image buffers into
    // `imageCollector` and leaves placeholder markers in the HTML.
    const imageCollector = [];
    const mcqs = parseMCQsFromLines(lines, imageCollector);

    // Pass 2: upload every collected image (to S3 or local via storageService)
    // and swap the markers for the real public URLs across all MCQ fields.
    await finalizeImages(mcqs, imageCollector);

    console.log(`Successfully extracted ${mcqs.length} MCQs from document.`);
    return mcqs;
  } catch (error) {
    console.error('Error extracting MCQs from document:', error);
    throw error;
  }
}

/**
 * Helper for strict prefix matching: Q:) or Q) only
 */
const prefixRE = (ch) => new RegExp(`^${ch}(?:\\)|:\\))\\s*`);

/**
 * Clean leading/trailing <br>
 */
const cleanEdgeBr = (s) =>
    s.replace(/^(?:<br\s*\/?>\s*)+/i, "")
     .replace(/(?:<br\s*\/?>\s*)+$/i, "")
     .trim();
  
/**
 * Process embedded images in an HTML fragment.
 *
 * Two-pass design so images can go to S3 (async) without making the whole sync
 * parser async: here (pass 1, sync) we extract each <img>'s bytes into the
 * shared `collector` and replace its src with a unique placeholder marker. After
 * all parsing, finalizeImages() (pass 2, async) uploads every collected buffer
 * via the storage service and swaps the markers for the real URLs across all MCQ
 * HTML. `imageDir` is kept for signature compatibility but no longer used to
 * write inline (storageService owns where bytes land).
 *
 * @param {string} htmlFragment
 * @param {Array}  collector  shared array: { marker, buffer, filename, contentType }
 */
const processImages = (htmlFragment, collector) => {
  if (!htmlFragment) return htmlFragment;
  const $ = cheerio.load(htmlFragment, null, false);

  $("img").each((_, img) => {
    const $img = $(img);
    const src = $img.attr("src") || '';
    try {
      let buffer = null;
      let ext = '.png';
      if (src.startsWith('data:image/')) {
        const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(src);
        if (match) {
          buffer = Buffer.from(match[2], 'base64');
          const sub = match[1].split('/')[1];
          if (sub) ext = `.${sub.replace('+xml', '')}`;
        }
      } else if (src.includes('word/media/')) {
        if (fs.existsSync(src)) {
          buffer = fs.readFileSync(src);
          const e = path.extname(src);
          if (e) ext = e;
        } else {
          console.warn(`⚠️ Original image not found: ${src}`);
        }
      }

      if (buffer) {
        const filename = `${uuidv4()}${ext}`;
        const marker = `__MCQIMG_${collector.length}_${uuidv4()}__`;
        collector.push({ marker, buffer, filename, contentType: undefined });
        $img.attr('src', marker);
      }
    } catch (err) {
      console.error(`⚠️ Failed to process image: ${src}`, err);
    }
  });

  return $.html();
};

/**
 * Pass 2: upload all collected image buffers and replace their placeholder
 * markers with the real public URLs across every MCQ's HTML fields. Mutates the
 * mcqs array in place. Safe to call with an empty collector (no-op).
 */
const finalizeImages = async (mcqs, collector) => {
  if (!collector || collector.length === 0) return mcqs;

  // Upload each buffer; map marker → final URL.
  const markerToUrl = {};
  for (const item of collector) {
    const url = await saveImageBuffer(item.buffer, {
      folder: 'images',
      filename: item.filename,
      contentType: item.contentType,
    });
    markerToUrl[item.marker] = url;
  }

  const swapStr = (s) => {
    if (typeof s !== 'string') return s;
    let out = s;
    for (const [marker, url] of Object.entries(markerToUrl)) {
      if (out.includes(marker)) out = out.split(marker).join(url);
    }
    return out;
  };

  // Shape-agnostic: walk every value of each MCQ object (the parser's
  // intermediate shape has options as a nested {A,B,C,D} object plus several
  // explanation/metadata string fields) and swap any placeholder markers in
  // string values. Handles strings, arrays, and nested objects.
  const deepSwap = (val) => {
    if (typeof val === 'string') return swapStr(val);
    if (Array.isArray(val)) return val.map(deepSwap);
    if (val && typeof val === 'object') {
      for (const k of Object.keys(val)) val[k] = deepSwap(val[k]);
      return val;
    }
    return val;
  };

  for (const mcq of mcqs) deepSwap(mcq);
  return mcqs;
};


/**
 * Smart field appender
 */
const pushText = (target, htmlText, cur, collector) => {
  if (!cur || !target) return;
  const cleaned = cleanEdgeBr(processImages(htmlText, collector));
  if (!cleaned) return;
  const add = (prev) => (prev ? prev + "<br>" + cleaned : cleaned);

  switch (target) {
    case "question": cur.questionText = add(cur.questionText); break;
    case "A": cur.options.A = add(cur.options.A); break;
    case "B": cur.options.B = add(cur.options.B); break;
    case "C": cur.options.C = add(cur.options.C); break;
    case "D": cur.options.D = add(cur.options.D); break;
    case "gen": cur.explanationGeneral = add(cur.explanationGeneral); break;
    case "Aexp": cur.explanationA = add(cur.explanationA); break;
    case "Bexp": cur.explanationB = add(cur.explanationB); break;
    case "Cexp": cur.explanationC = add(cur.explanationC); break;
    case "Dexp": cur.explanationD = add(cur.explanationD); break;
    // Optional metadata markers — same continuation behaviour as the
    // explanation fields above. Order-independent; admins can place them
    // anywhere between Q:) and the next Q:), or skip them entirely.
    case "univ": cur.university = add(cur.university); break;
    case "year": cur.year       = add(cur.year);       break;
  }
};

/**
 * Parse MCQs from HTML lines
 * @param {Array} lines - Array of HTML lines
 * @param {Array} collector - shared array for extracted image buffers (pass 2)
 * @returns {Array} - Array of MCQ objects
 */
function parseMCQsFromLines(lines, collector) {
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
        explanationD: "",
        // Optional metadata — stays as "" when the source doc omits the
        // matching marker(s), so importing a file without these is a no-op.
        university: "",
        year:       ""
      };
      raw = raw.replace(prefixRE("Q"), "");
      part = "question";
      pushText(part, raw, cur, collector);
      continue;
    }

    if (/^A(?:\)|:\))\s*/.test(raw)) { part = "A"; raw = raw.replace(prefixRE("A"), ""); pushText(part, raw, cur, collector); continue; }
    if (/^B(?:\)|:\))\s*/.test(raw)) { part = "B"; raw = raw.replace(prefixRE("B"), ""); pushText(part, raw, cur, collector); continue; }
    if (/^C(?:\)|:\))\s*/.test(raw)) { part = "C"; raw = raw.replace(prefixRE("C"), ""); pushText(part, raw, cur, collector); continue; }
    if (/^D(?:\)|:\))\s*/.test(raw)) { part = "D"; raw = raw.replace(prefixRE("D"), ""); pushText(part, raw, cur, collector); continue; }

    if (/^:Correct:/i.test(raw)) { cur.correctAnswer = raw.replace(/^:Correct:\s*/, "").trim(); part = null; continue; }
    if (/^:MsgCorrect:/i.test(raw)) { part = null; continue; } // Just marking end of correct answer section
    if (/^:Explanation:/i.test(raw)) { part = "gen"; raw = raw.replace(/^:Explanation:\s*/, ""); pushText(part, raw, cur, collector); continue; }
    if (/^:ExplanationA:/i.test(raw)) { part = "Aexp"; raw = raw.replace(/^:ExplanationA:\s*/, ""); pushText(part, raw, cur, collector); continue; }
    if (/^:ExplanationB:/i.test(raw)) { part = "Bexp"; raw = raw.replace(/^:ExplanationB:\s*/, ""); pushText(part, raw, cur, collector); continue; }
    if (/^:ExplanationC:/i.test(raw)) { part = "Cexp"; raw = raw.replace(/^:ExplanationC:\s*/, ""); pushText(part, raw, cur, collector); continue; }
    if (/^:ExplanationD:/i.test(raw)) { part = "Dexp"; raw = raw.replace(/^:ExplanationD:\s*/, ""); pushText(part, raw, cur, collector); continue; }

    // Optional MCQ metadata — same per-marker pattern as the explanation
    // branches above. Both are independent of each other and of every
    // other field; if a marker is missing the field stays "". Multi-line
    // continuations work the same way (subsequent paragraphs are
    // <br>-joined into the active field until another marker fires).
    if (/^:University:/i.test(raw)) { part = "univ"; raw = raw.replace(/^:University:\s*/, ""); pushText(part, raw, cur, collector); continue; }
    if (/^:Year:/i.test(raw))       { part = "year"; raw = raw.replace(/^:Year:\s*/, "");       pushText(part, raw, cur, collector); continue; }

    // Otherwise: continue adding to current section
    pushText(part, raw, cur, collector);
  }
  
  if (cur) mcqs.push(cur);
  
  return mcqs;
}

/**
 * Ensure a directory exists, create if needed
 * @param {string} dirPath - Directory path
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Convert MCQs to backend model format
 * @param {Array} mcqs - Parsed MCQs
 * @param {string} testId - Test ID
 * @param {Object} defaultValues - Default values for MCQs
 * @returns {Array} - MCQs in database format
 */
function convertToBackendFormat(mcqs, testId, defaultValues = {}) {
  return mcqs.map(mcq => {
    // Format options for the database
    const options = Object.keys(mcq.options)
      .filter(key => mcq.options[key]) // Only include options with content
      .map(key => {
        return {
          optionLetter: key,
          optionText: mcq.options[key],
          isCorrect: key === mcq.correctAnswer,
          explanationText: mcq[`explanation${key}`] || ''
        };
      });
    
    // Ensure we have at least 2 options
    if (options.length < 2) {
      console.warn('Warning: MCQ has less than 2 options');
      // Add empty options if needed
      while (options.length < 2) {
        const nextLetter = String.fromCharCode(65 + options.length); // A, B, C, D
        options.push({
          optionLetter: nextLetter,
          optionText: '',
          isCorrect: false,
          explanationText: ''
        });
      }
    }
    
    // Ensure one option is marked as correct
    const hasCorrectOption = options.some(opt => opt.isCorrect);
    if (!hasCorrectOption && options.length > 0) {
      // Default to first option if none is marked
      options[0].isCorrect = true;
    }
    
    // Create MCQ object for the database
    return {
      questionText: mcq.questionText,
      options,
      explanationText: mcq.explanationGeneral,
      author: defaultValues.author || 'System Import',
      testId,
      subject: defaultValues.subject || '',
      unit: defaultValues.unit || '',
      topic: defaultValues.topic || '',
      subTopic: defaultValues.subTopic || '',
      session: defaultValues.session || '',
      difficulty: defaultValues.difficulty || 'Medium',
      isPublic: defaultValues.isPublic !== undefined ? defaultValues.isPublic : true,
      revisionCount: 0,
      lastRevised: null,
      // Optional metadata parsed from :University: / :Year: markers in
      // the Word doc. Empty string when omitted — schema accepts both.
      university: mcq.university || '',
      year:       mcq.year       || '',
      // Question Bank linkage
      questionBankId: defaultValues.questionBankId || null,
      qbSubjectId:    defaultValues.qbSubjectId    || null,
      qbChapterId:    defaultValues.qbChapterId    || null,
      qbTopicId:      defaultValues.qbTopicId      || null,
    };
  }).filter(mcq => mcq.questionText && mcq.options.length >= 2); // Filter out invalid MCQs
}

module.exports = {
  extractMCQsFromDoc,
  convertToBackendFormat
};