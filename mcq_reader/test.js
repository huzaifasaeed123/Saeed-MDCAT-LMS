// robust-mcq-parser.js
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const JSZip = require('jszip');
const { v4: uuidv4 } = require('uuid');

/**
 * Main function to parse MCQs from a Word document
 * @param {string} docxPath - Path to the Word document
 * @param {string} outputJsonPath - Path to save the parsed MCQs as JSON
 * @param {string} imageOutputDir - Directory to save extracted images
 */
async function parseMCQsFromDoc(docxPath, outputJsonPath, imageOutputDir = './extracted_images') {
  try {
    console.log(`Parsing MCQs from ${docxPath}...`);
    
    // Create output directories
    if (!fs.existsSync(imageOutputDir)) {
      fs.mkdirSync(imageOutputDir, { recursive: true });
    }
    
    // First, extract the raw text - useful for structure
    const rawTextResult = await mammoth.extractRawText({ path: docxPath });
    const rawText = rawTextResult.value;
    
    // Save raw text for debugging
    fs.writeFileSync('raw-text.txt', rawText, 'utf8');
    
    // Create a custom style map to preserve formatting
    const styleMap = [
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "r[style-name='Strong'] => strong",
      "r[style-name='Emphasis'] => em"
    ];
    
    // Convert the document to HTML with carefully preserved formatting
    const result = await mammoth.convertToHtml({
      path: docxPath,
      transformDocument: transformDocumentWithVertAlign,
      styleMap: styleMap,
      ignoreEmptyParagraphs: false,
      convertImage: mammoth.images.dataUri
    });
    
    const html = result.value;
    
    // Save HTML for debugging
    fs.writeFileSync('extracted-html.html', html, 'utf8');
    
    // Extract images from the document
    const imageMap = await extractImages(docxPath, imageOutputDir);
    
    // Parse the MCQs using both raw text (for structure) and HTML (for formatting)
    const mcqs = parseMCQs(rawText, html, imageMap);
    
    // Save the parsed MCQs to JSON
    fs.writeFileSync(outputJsonPath, JSON.stringify(mcqs, null, 2), 'utf8');
    
    return mcqs;
  } catch (error) {
    console.error('Error parsing MCQs:', error);
    throw error;
  }
}

/**
 * Custom transform function to carefully preserve superscript and subscript
 */
function transformDocumentWithVertAlign(document) {
  const transformRuns = (element) => {
    if (!element) return element;
    
    // Process children recursively
    if (element.children) {
      element.children = element.children.map(transformRuns);
    }
    
    // Handle superscript
    if (element.type === 'run' && element.verticalAlignment === 'superscript') {
      return {
        type: 'element',
        tag: 'sup',
        children: element.children || []
      };
    }
    
    // Handle subscript
    if (element.type === 'run' && element.verticalAlignment === 'subscript') {
      return {
        type: 'element',
        tag: 'sub',
        children: element.children || []
      };
    }
    
    // Handle bold text
    if (element.type === 'run' && element.bold) {
      return {
        type: 'element',
        tag: 'strong',
        children: element.children || []
      };
    }
    
    // Handle italic text
    if (element.type === 'run' && element.italic) {
      return {
        type: 'element',
        tag: 'em',
        children: element.children || []
      };
    }
    
    return element;
  };
  
  return transformRuns(document);
}

/**
 * Extract images from the Word document
 * @param {string} docxPath - Path to the document
 * @param {string} outputDir - Directory to save extracted images
 * @returns {Promise<Object>} - Map of image paths
 */
async function extractImages(docxPath, outputDir) {
  const imageMap = {};
  
  try {
    // Read the document as a zip file
    const docxBuffer = fs.readFileSync(docxPath);
    const zip = await JSZip.loadAsync(docxBuffer);
    
    // Find image files in the document
    const mediaFiles = Object.keys(zip.files).filter(name => 
      name.startsWith('word/media/')
    );
    
    console.log(`Found ${mediaFiles.length} images in the document`);
    
    // Process each image
    for (let i = 0; i < mediaFiles.length; i++) {
      const imagePath = mediaFiles[i];
      const imageFileName = path.basename(imagePath);
      const extension = path.extname(imageFileName);
      
      // Generate unique filename
      const uniqueFileName = `image_${i+1}${extension}`;
      const outputPath = path.join(outputDir, uniqueFileName);
      
      // Extract and save the image
      const imageData = await zip.files[imagePath].async('nodebuffer');
      fs.writeFileSync(outputPath, imageData);
      
      // Add to imageMap with both basename and full path as keys
      // This improves our chances of matching images correctly
      const webPath = `/uploads/images/${uniqueFileName}`;
      
      imageMap[imageFileName] = webPath;
      imageMap[imagePath] = webPath;
      imageMap[`image${i+1}`] = webPath;
      
      // Also map the "media/image1.png" format commonly used in Word docs
      imageMap[`media/${imageFileName}`] = webPath;
      imageMap[`media/image${i+1}${extension}`] = webPath;
      
      console.log(`Extracted image: ${uniqueFileName}`);
    }
  } catch (error) {
    console.error('Error extracting images:', error);
  }
  
  return imageMap;
}

/**
 * Parse MCQs from raw text and HTML content
 * @param {string} rawText - Raw text content
 * @param {string} html - HTML content with formatting
 * @param {Object} imageMap - Map of image paths
 * @returns {Array} - Array of MCQ objects
 */
function parseMCQs(rawText, html, imageMap) {
  const mcqs = [];
  
  // Build paragraphs map for formatted content lookup
  const paragraphMap = buildParagraphMap(html);
  
  // Split the raw text into MCQ blocks
  const mcqBlocks = splitIntoMCQBlocks(rawText);
  console.log(`Found ${mcqBlocks.length} potential MCQ blocks`);
  
  // Process each MCQ block
  mcqBlocks.forEach((block, index) => {
    try {
      // Initialize MCQ object
      const mcq = {
        questionText: '',
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
        hasImages: false
      };
      
      // Check if this MCQ contains an image
      if (block.includes('![') || block.includes('media/image') || block.includes(':Type: S')) {
        mcq.hasImages = true;
      }
      
      // Extract question text
      extractQuestionText(block, mcq, paragraphMap, imageMap);
      
      // Extract options
      extractOptions(block, mcq, paragraphMap);
      
      // Extract correct answer
      extractCorrectOption(block, mcq);
      
      // Extract explanations
      extractExplanations(block, mcq, paragraphMap);
      
      // Add the MCQ to the result array
      mcqs.push(mcq);
    } catch (error) {
      console.error(`Error processing MCQ block ${index + 1}:`, error);
    }
  });
  
  return mcqs;
}

/**
 * Split raw text into MCQ blocks
 * @param {string} text - Raw text
 * @returns {Array} - Array of MCQ blocks
 */
function splitIntoMCQBlocks(text) {
  // Replace all types of newlines with standard ones
  const normalizedText = text.replace(/\r\n/g, '\n');
  
  // Split by Q:) or Q) pattern, looking for the marker at the start of a line
  const pattern = /(?:^|\n)Q[:)]/;
  const parts = normalizedText.split(pattern);
  
  // Skip the first part if it doesn't start with a question
  const blocks = parts.slice(1).map(part => `Q:)${part.trim()}`);
  
  return blocks;
}

/**
 * Build a map of plain text to formatted HTML from paragraphs
 * @param {string} html - HTML content
 * @returns {Map} - Map of text to formatted HTML
 */
function buildParagraphMap(html) {
  const map = new Map();
  
  // Extract paragraphs
  const paragraphRegex = /<p[^>]*>(.*?)<\/p>/gs;
  let match;
  
  while ((match = paragraphRegex.exec(html)) !== null) {
    const htmlContent = match[1];
    // Extract plain text
    const plainText = htmlContent.replace(/<[^>]+>/g, '').trim();
    
    if (plainText && htmlContent !== plainText) {
      map.set(plainText, htmlContent);
      
      // Also add variations without specific formatting
      // This helps with partial matches
      map.set(plainText.replace(/\s+/g, ' '), htmlContent);
    }
  }
  
  return map;
}

/**
 * Extract question text from an MCQ block
 * @param {string} block - MCQ block
 * @param {Object} mcq - MCQ object to update
 * @param {Map} paragraphMap - Map of text to formatted HTML
 * @param {Object} imageMap - Map of image paths
 */
function extractQuestionText(block, mcq, paragraphMap, imageMap) {
  // Match everything from the start until first option marker
  const questionRegex = /^Q[:)]\s*(.+?)(?=A[:)]|B[:)]|C[:)]|D[:)]|$)/s;
  const match = block.match(questionRegex);
  
  if (match && match[1]) {
    let questionText = match[1].trim();
    
    // Check for images
    if (mcq.hasImages) {
      // Look for markdown image syntax
      const imageMatch = questionText.match(/!\[(.*?)\]\((.*?)\)/);
      if (imageMatch && imageMatch[2]) {
        const imagePath = imageMatch[2];
        if (imageMap[imagePath]) {
          mcq.questionText = `<img src="${imageMap[imagePath]}" alt="Question Image">`;
          return;
        }
      }
      
      // If no markdown image, check for :Type: S marker
      if (block.includes(':Type: S')) {
        // Find the first available image
        const firstImageKey = Object.keys(imageMap).find(key => key.startsWith('image'));
        if (firstImageKey) {
          mcq.questionText = `<img src="${imageMap[firstImageKey]}" alt="Question Image">`;
          return;
        }
      }
    }
    
    // Look for formatted version in paragraphMap
    const formattedText = findFormattedText(questionText, paragraphMap);
    if (formattedText) {
      // Remove any "Q:)" or "Q)" prefix from the formatted text
      mcq.questionText = formattedText.replace(/^Q[:)]\s*/, '');
    } else {
      // If no formatted version found, manually process tildes for sub/superscript
      mcq.questionText = processTildes(questionText);
    }
  }
}

/**
 * Extract options from an MCQ block
 * @param {string} block - MCQ block
 * @param {Object} mcq - MCQ object to update
 * @param {Map} paragraphMap - Map of text to formatted HTML
 */
function extractOptions(block, mcq, paragraphMap) {
  for (const option of ['A', 'B', 'C', 'D']) {
    // Match both A:) and A) formats
    const optionRegex = new RegExp(`${option}[:)]\\s*(.+?)(?=[A-D][:)]|:Correct:|:Explanations|$)`, 's');
    const match = block.match(optionRegex);
    
    if (match && match[1]) {
      const optionText = match[1].trim();
      
      // Look for formatted version in paragraphMap
      const formattedText = findFormattedText(optionText, paragraphMap);
      if (formattedText) {
        mcq.options[option] = formattedText;
      } else {
        // If no formatted version found, manually process tildes for sub/superscript
        mcq.options[option] = processTildes(optionText);
      }
    }
  }
}

/**
 * Extract correct option from an MCQ block
 * @param {string} block - MCQ block
 * @param {Object} mcq - MCQ object to update
 */
function extractCorrectOption(block, mcq) {
  const correctRegex = /:Correct:\s*([A-D])/;
  const match = block.match(correctRegex);
  
  if (match && match[1]) {
    mcq.correctOption = match[1];
  }
}

/**
 * Extract explanations from an MCQ block
 * @param {string} block - MCQ block
 * @param {Object} mcq - MCQ object to update
 * @param {Map} paragraphMap - Map of text to formatted HTML
 */
function extractExplanations(block, mcq, paragraphMap) {
  // Extract general explanation
  const explanationRegex = /:Explanations:\s*(.+?)(?=:Explanations[A-D]:|$)/s;
  const explanationMatch = block.match(explanationRegex);
  
  if (explanationMatch && explanationMatch[1]) {
    const explanationText = explanationMatch[1].trim();
    
    // Look for formatted version in paragraphMap
    const formattedText = findFormattedText(explanationText, paragraphMap);
    if (formattedText) {
      mcq.explanation = formattedText;
    } else {
      // If no formatted version found, manually process tildes for sub/superscript
      mcq.explanation = processTildes(explanationText);
    }
  }
  
  // Extract option-specific explanations
  for (const option of ['A', 'B', 'C', 'D']) {
    const optExplanationRegex = new RegExp(`:Explanations${option}:\\s*(.+?)(?=:Explanations[A-D]:|$)`, 's');
    const optExplanationMatch = block.match(optExplanationRegex);
    
    if (optExplanationMatch && optExplanationMatch[1]) {
      const explanationText = optExplanationMatch[1].trim();
      
      // Look for formatted version in paragraphMap
      const formattedText = findFormattedText(explanationText, paragraphMap);
      if (formattedText) {
        mcq.optionExplanations[option] = formattedText;
      } else {
        // If no formatted version found, manually process tildes for sub/superscript
        mcq.optionExplanations[option] = processTildes(explanationText);
      }
    }
  }
}

/**
 * Find formatted text from the paragraph map
 * @param {string} text - Plain text
 * @param {Map} paragraphMap - Map of text to formatted HTML
 * @returns {string|null} - Formatted HTML or null if not found
 */
function findFormattedText(text, paragraphMap) {
  // Exact match
  if (paragraphMap.has(text)) {
    return paragraphMap.get(text);
  }
  
  // Try simplified version (with normalized spaces)
  const simplifiedText = text.replace(/\s+/g, ' ');
  if (paragraphMap.has(simplifiedText)) {
    return paragraphMap.get(simplifiedText);
  }
  
  // Try to find partial matches
  for (const [key, value] of paragraphMap.entries()) {
    if (text.includes(key) && key.length > 5) {
      // Replace the matching part with the formatted version
      return text.replace(key, value);
    }
  }
  
  return null;
}

/**
 * Process tildes for superscript and subscript
 * @param {string} text - Text with tildes
 * @returns {string} - HTML with <sup> and <sub> tags
 */
function processTildes(text) {
  if (!text.includes('~')) {
    return text;
  }
  
  let result = text;
  let inSuperscript = false;
  let inSubscript = false;
  let superscriptContent = '';
  let subscriptContent = '';
  
  // First pass: handle superscript (x~y~ -> x<sup>y</sup>)
  result = result.replace(/([^~]*)~([^~]+)~([^~]*)/g, (match, before, content, after) => {
    // Check if this is likely subscript (based on context)
    if (before.match(/[A-Za-z0-9]$/)) {
      // If the character before the tilde is alphanumeric, it's likely subscript
      return `${before}<sub>${content}</sub>${after}`;
    } else {
      // Otherwise assume superscript
      return `${before}<sup>${content}</sup>${after}`;
    }
  });
  
  return result;
}

/**
 * Convert MCQs to backend format
 * @param {Array} mcqs - Array of parsed MCQs
 * @param {string} testId - Test ID
 * @param {Object} defaultValues - Default values for MCQs
 * @returns {Array} - MCQs in backend format
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

// If run directly
if (require.main === module) {
  // Get command line arguments
  const docxPath ="testing.docx";
  const outputJsonPath = process.argv[3] || './extracted-mcqs.json';
  const imageOutputDir = process.argv[4] || './extracted_images';
  
  if (!docxPath) {
    console.error('Please provide a path to a .docx file');
    console.log('Usage: node robust-mcq-parser.js <input-docx> [output-json] [image-dir]');
    process.exit(1);
  }
  
  // Run the parser
  parseMCQsFromDoc(docxPath, outputJsonPath, imageOutputDir)
    .then(mcqs => {
      console.log(`Successfully parsed ${mcqs.length} MCQs from ${docxPath}`);
    })
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = {
  parseMCQsFromDoc,
  convertToBackendFormat
};