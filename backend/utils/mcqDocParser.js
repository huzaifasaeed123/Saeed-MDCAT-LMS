// backend/utils/mcqDocParser.js
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const JSZip = require('jszip');
const { v4: uuidv4 } = require('uuid');

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
    
    // Extract images from docx and store their mapping
    const imageMap = await extractImages(docxPath, imageDir);
    
    // Convert Word document to HTML with preserved formatting
    const result = await mammoth.convertToHtml({
      path: docxPath,
      transformDocument: transformDocumentElement,
      ignoreEmptyParagraphs: true,
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "r[style-name='Strong'] => strong",
        "r[style-name='Emphasis'] => em",
        "r[vertAlign='superscript'] => sup",
        "r[vertAlign='subscript'] => sub"
      ]
    });
    
    // Process the HTML content to extract MCQs
    const htmlContent = result.value;
    
    // Replace image references in HTML with actual image paths
    const htmlWithImages = replaceImageReferences(htmlContent, imageMap);
    
    // Parse MCQs from the HTML content
    const mcqs = parseMCQsFromHTML(htmlWithImages);
    
    console.log(`Successfully extracted ${mcqs.length} MCQs from document.`);
    return mcqs;
  } catch (error) {
    console.error('Error extracting MCQs from document:', error);
    throw error;
  }
}

/**
 * Transform document elements to preserve formatting
 */
function transformDocumentElement(document) {
  // Handle vertical alignment for superscript and subscript
  const transformRun = run => {
    if (run.verticalAlignment === 'superscript') {
      return {
        ...run,
        children: [{ type: 'element', tag: 'sup', children: run.children }]
      };
    } else if (run.verticalAlignment === 'subscript') {
      return {
        ...run,
        children: [{ type: 'element', tag: 'sub', children: run.children }]
      };
    }
    return run;
  };

  // Handle bold and italic text
  const transformParagraph = paragraph => {
    const children = paragraph.children.map(child => {
      if (child.type === 'run') {
        const run = transformRun(child);
        
        // Handle bold text
        if (run.isBold) {
          return {
            ...run,
            children: [{ type: 'element', tag: 'strong', children: run.children }]
          };
        }
        
        // Handle italic text
        if (run.isItalic) {
          return {
            ...run,
            children: [{ type: 'element', tag: 'em', children: run.children }]
          };
        }
        
        return run;
      }
      return child;
    });
    
    return { ...paragraph, children };
  };

  // Apply transformations to paragraphs
  const transformChildrenRecursively = element => {
    if (element.type === 'paragraph') {
      element = transformParagraph(element);
    }
    
    if (element.children) {
      element.children = element.children.map(transformChildrenRecursively);
    }
    
    return element;
  };

  return transformChildrenRecursively(document);
}

/**
 * Extract images from Word document
 * @param {string} docxPath - Path to the Word document
 * @param {string} outputDir - Directory to save images
 * @returns {Promise<Object>} - Map of rId to image info
 */
async function extractImages(docxPath, outputDir) {
  try {
    const imageMap = {};
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
      return imageMap;
    }
    
    console.log(`Found ${mediaFiles.length} images in the document.`);
    
    // Extract and save each image
    for (let i = 0; i < mediaFiles.length; i++) {
      const fileName = mediaFiles[i];
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
      
      // Store mapping from rId to path
      // In Word docs, rIds are usually named sequentially like rId1, rId2, etc.
      const rId = `rId${i+1}`;
      const relativePath = path.join('/uploads/images', uniqueFileName).replace(/\\/g, '/');
      
      imageMap[rId] = {
        path: relativePath,
        originalName: path.basename(fileName)
      };
      
      console.log(`Extracted image: ${uniqueFileName}`);
    }
    
    return imageMap;
  } catch (error) {
    console.error('Error extracting images:', error);
    return {};
  }
}

/**
 * Replace image references in HTML with actual image paths
 * @param {string} html - HTML content
 * @param {Object} imageMap - Map of rId to image info
 * @returns {string} - HTML with image paths
 */
function replaceImageReferences(html, imageMap) {
  // Mammoth outputs image references as spans with relationship IDs
  let processedHtml = html;
  
  // Replace each image reference
  Object.keys(imageMap).forEach(rId => {
    const imagePath = imageMap[rId].path;
    const pattern = new RegExp(`<img([^>]*)r:id="${rId}"([^>]*)>`, 'g');
    
    processedHtml = processedHtml.replace(pattern, `<img$1src="${imagePath}"$2>`);
  });
  
  return processedHtml;
}

/**
 * Parse MCQs from HTML content
 * @param {string} html - HTML content
 * @returns {Array} - Array of MCQ objects
 */
function parseMCQsFromHTML(html) {
  const mcqs = [];
  
  // Match Q:) or Q) to find questions - handle both formats
  const questionPattern = /<p[^>]*>\s*(Q[:\)])\s*([^<]+(?:<[^>]+>[^<]*<\/[^>]+>[^<]*)*)(?:<\/p>)/g;
  let startIndex = 0;
  let match;
  
  while ((match = questionPattern.exec(html)) !== null) {
    if (match.index < startIndex) continue;
    
    try {
      const questionStart = match.index;
      const questionText = cleanHtml(match[2]); // Text after Q:) or Q)
      
      // Find the start of the next question or end of content
      const nextQuestionMatch = findNextQuestionStart(html, questionStart + match[0].length);
      const nextQuestionIndex = nextQuestionMatch ? nextQuestionMatch.index : html.length;
      
      // Extract the content from current question to next question
      const mcqContent = html.substring(questionStart, nextQuestionIndex);
      
      // Parse the MCQ
      const mcq = parseSingleMCQ(mcqContent, questionText);
      
      if (mcq) {
        mcqs.push(mcq);
      }
      
      // Update start index to avoid re-processing
      startIndex = nextQuestionIndex;
    } catch (error) {
      console.error('Error parsing MCQ:', error);
    }
  }
  
  return mcqs;
}

/**
 * Find the next question marker
 * @param {string} html - HTML content
 * @param {number} startIndex - Index to start searching from
 * @returns {Object|null} - Match object or null
 */
function findNextQuestionStart(html, startIndex) {
  // Look for both Q:) and Q) formats
  const questionPattern = /<p[^>]*>\s*(Q[:\)])\s*/g;
  questionPattern.lastIndex = startIndex;
  
  return questionPattern.exec(html);
}

/**
 * Parse a single MCQ
 * @param {string} content - MCQ content
 * @param {string} questionText - Already extracted question text
 * @returns {Object|null} - MCQ object
 */
function parseSingleMCQ(content, questionText) {
  try {
    // Initial MCQ structure
    const mcq = {
      questionText: questionText,
      options: {
        A: '',
        B: '',
        C: '',
        D: ''
      },
      correctOption: '',
      explanation: '',
      optionExplanations: {
        A: '',
        B: '',
        C: '',
        D: ''
      },
      hasImages: content.includes('<img')
    };
    
    // Extract options (A:), B:), C:), D:) or A), B), C), D))
    for (const option of ['A', 'B', 'C', 'D']) {
      // Support both A:) and A) formats
      const optionPattern = new RegExp(`<p[^>]*>\\s*(${option}[:\\)])\\s*([^<]+(?:<[^>]+>[^<]*<\\/[^>]+>[^<]*)*)(?:<\\/p>)`, 'i');
      const optionMatch = content.match(optionPattern);
      
      if (optionMatch) {
        mcq.options[option] = cleanHtml(optionMatch[2]);
      }
    }
    
    // Extract correct answer (:Correct: X)
    const correctPattern = /:Correct:\s*([A-D])/i;
    const correctMatch = content.match(correctPattern);
    
    if (correctMatch) {
      mcq.correctOption = correctMatch[1];
    }
    
    // Extract general explanation (:Explanation:)
    const explanationPattern = /:Explanation:\s*([^<:]+(?:<[^>]+>[^<:]*<\/[^>]+>[^<:]*)*)(?=:|\n|<\/p>|$)/i;
    const explanationMatch = content.match(explanationPattern);
    
    if (explanationMatch) {
      mcq.explanation = cleanHtml(explanationMatch[1]);
    }
    
    // Extract option-specific explanations (:ExplanationA:, :ExplanationB:, etc.)
    for (const option of ['A', 'B', 'C', 'D']) {
      const optExplanationPattern = new RegExp(`:Explanation${option}:\\s*([^<:]+(?:<[^>]+>[^<:]*<\\/[^>]+>[^<:]*)*)(?=:|\\n|<\\/p>|$)`, 'i');
      const optExplanationMatch = content.match(optExplanationPattern);
      
      if (optExplanationMatch) {
        mcq.optionExplanations[option] = cleanHtml(optExplanationMatch[1]);
      }
    }
    
    return mcq;
  } catch (error) {
    console.error('Error parsing single MCQ:', error);
    return null;
  }
}

/**
 * Clean HTML content
 * @param {string} html - HTML content to clean
 * @returns {string} - Cleaned HTML
 */
function cleanHtml(html) {
  if (!html) return '';
  
  let cleaned = html.trim()
    // Fix HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
  
  return cleaned;
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
    const options = Object.keys(mcq.options).map(key => {
      return {
        optionLetter: key,
        optionText: mcq.options[key],
        isCorrect: key === mcq.correctOption,
        explanationText: mcq.optionExplanations[key] || ''
      };
    });
    
    // Create MCQ object for the database
    return {
      questionText: mcq.questionText,
      options,
      explanationText: mcq.explanation,
      hasImages: mcq.hasImages,
      author: defaultValues.author || 'System Import',
      published: defaultValues.published !== undefined ? defaultValues.published : false,
      testId,
      subject: defaultValues.subject || '',
      unit: defaultValues.unit || '',
      topic: defaultValues.topic || '',
      subTopic: defaultValues.subTopic || '',
      session: defaultValues.session || '',
      difficulty: defaultValues.difficulty || 'Medium',
      isPublic: defaultValues.isPublic !== undefined ? defaultValues.isPublic : true
    };
  });
}

module.exports = {
  extractMCQsFromDoc,
  convertToBackendFormat
};