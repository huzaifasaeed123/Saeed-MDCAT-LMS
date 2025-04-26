// backend/utils/mcqDocParser.js
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const JSZip = require('jszip');

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
    await extractDocImages(docxPath, imageDir);
    
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
      
    // Parse MCQs from lines
    const mcqs = parseMCQsFromLines(lines, imageDir);
    
    console.log(`Successfully extracted ${mcqs.length} MCQs from document.`);
    return mcqs;
  } catch (error) {
    console.error('Error extracting MCQs from document:', error);
    throw error;
  }
}

/**
 * Extract images from Word document
 * @param {string} docxPath - Path to the Word document
 * @param {string} outputDir - Directory to save images
 */
async function extractDocImages(docxPath, outputDir) {
  try {
    const zip = new JSZip();
    
    // Read the .docx file
    const content = fs.readFileSync(docxPath);
    const zipContent = await zip.loadAsync(content);
    
    // Find all image files in the document
    const mediaFiles = Object.keys(zipContent.files).filter(name => 
      name.startsWith('word/media/')
    );
    
    if (mediaFiles.length === 0) {
      console.log('No images found in the document.');
      return;
    }
    
    console.log(`Found ${mediaFiles.length} images in the document.`);
    
    // Extract and save each image
    for (const fileName of mediaFiles) {
      const extension = path.extname(fileName).toLowerCase();
      
      // Only process common image formats
      if (!['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(extension)) {
        continue;
      }
      
      // Generate unique filename to avoid collisions
      const uniqueFileName = `${uuidv4()}${extension}`;
      const outputPath = path.join(outputDir, uniqueFileName);
      
      // Extract image data
      const imageData = await zipContent.files[fileName].async('nodebuffer');
      fs.writeFileSync(outputPath, imageData);
      
      console.log(`Extracted image: ${uniqueFileName}`);
    }
  } catch (error) {
    console.error('Error extracting images:', error);
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
 * Process embedded images in HTML content
 */
const processImages = (htmlFragment, imageDir) => {
  if (!htmlFragment) return htmlFragment;
  
  const $ = cheerio.load(htmlFragment, null, false);
  
  // Process data URI images
  $("img[src^='data:image/']").each((_, img) => {
    const $img = $(img);
    const dataUri = $img.attr("src");
    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUri);
    if (!match) return;

    const mime = match[1];
    const ext = mime.split("/")[1];
    const fileName = `${uuidv4()}.${ext}`;
    const outPath = path.join(imageDir, fileName);

    fs.writeFileSync(outPath, Buffer.from(match[2], "base64"));
    
    // Update the src to a relative path
    const relativePath = `/uploads/images/${fileName}`;
    $img.attr("src", relativePath);
  });
  
  // Handle already extracted images (from extractDocImages)
  $("img").each((_, img) => {
    const $img = $(img);
    const src = $img.attr("src") || '';
    
    // If it's a Word media reference, replace with relative URL
    if (src.includes('word/media/') || src.includes('image')) {
      const uniqueFileName = `${uuidv4()}.png`;
      const relativePath = `/uploads/images/${uniqueFileName}`;
      $img.attr("src", relativePath);
    }
  });

  return $.html();
};

/**
 * Smart field appender
 */
const pushText = (target, htmlText, cur, imageDir) => {
  if (!cur || !target) return;
  const cleaned = cleanEdgeBr(processImages(htmlText, imageDir));
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
  }
};

/**
 * Parse MCQs from HTML lines
 * @param {Array} lines - Array of HTML lines
 * @param {string} imageDir - Directory for images
 * @returns {Array} - Array of MCQ objects
 */
function parseMCQsFromLines(lines, imageDir) {
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
      pushText(part, raw, cur, imageDir);
      continue;
    }

    if (/^A(?:\)|:\))\s*/.test(raw)) { part = "A"; raw = raw.replace(prefixRE("A"), ""); pushText(part, raw, cur, imageDir); continue; }
    if (/^B(?:\)|:\))\s*/.test(raw)) { part = "B"; raw = raw.replace(prefixRE("B"), ""); pushText(part, raw, cur, imageDir); continue; }
    if (/^C(?:\)|:\))\s*/.test(raw)) { part = "C"; raw = raw.replace(prefixRE("C"), ""); pushText(part, raw, cur, imageDir); continue; }
    if (/^D(?:\)|:\))\s*/.test(raw)) { part = "D"; raw = raw.replace(prefixRE("D"), ""); pushText(part, raw, cur, imageDir); continue; }

    if (/^:Correct:/i.test(raw)) { cur.correctAnswer = raw.replace(/^:Correct:\s*/, "").trim(); part = null; continue; }
    if (/^:MsgCorrect:/i.test(raw)) { part = null; continue; } // Just marking end of correct answer section
    if (/^:Explanation:/i.test(raw)) { part = "gen"; raw = raw.replace(/^:Explanation:\s*/, ""); pushText(part, raw, cur, imageDir); continue; }
    if (/^:ExplanationA:/i.test(raw)) { part = "Aexp"; raw = raw.replace(/^:ExplanationA:\s*/, ""); pushText(part, raw, cur, imageDir); continue; }
    if (/^:ExplanationB:/i.test(raw)) { part = "Bexp"; raw = raw.replace(/^:ExplanationB:\s*/, ""); pushText(part, raw, cur, imageDir); continue; }
    if (/^:ExplanationC:/i.test(raw)) { part = "Cexp"; raw = raw.replace(/^:ExplanationC:\s*/, ""); pushText(part, raw, cur, imageDir); continue; }
    if (/^:ExplanationD:/i.test(raw)) { part = "Dexp"; raw = raw.replace(/^:ExplanationD:\s*/, ""); pushText(part, raw, cur, imageDir); continue; }

    // Otherwise: continue adding to current section
    pushText(part, raw, cur, imageDir);
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
      lastRevised: null
    };
  }).filter(mcq => mcq.questionText && mcq.options.length >= 2); // Filter out invalid MCQs
}

module.exports = {
  extractMCQsFromDoc,
  convertToBackendFormat
};