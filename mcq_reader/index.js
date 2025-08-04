// mcq-parser.js
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const { DOMParser } = require('xmldom');
// Hello Just Cheking New PC
/**
#  * Parses a Word document containing MCQs and converts them to JSON format
#  * @param {string} docxPath - Path to the Word document
#  * @returns {Promise<Array>} - Array of MCQ objects
#  */
async function parseMCQsFromDocument(docxPath) {
  try {
    // Extract HTML content with styles from the document
    const result = await mammoth.convertToHtml({
      path: docxPath,
      transformDocument: mammoth.transforms.paragraph(transformParagraph)
    });
    
    const htmlContent = result.value;
    console.log("HTML extraction complete. Parsing MCQs...");
    
    // Parse the HTML content into MCQ objects
    const mcqs = parseMCQsFromHtml(htmlContent);
    
    return mcqs;
  } catch (error) {
    console.error("Error parsing MCQs from document:", error);
    throw error;
  }
}

 /**
#  * Transform function to preserve superscript and subscript in the document
#  */
function transformParagraph(paragraph) {
  // Preserve runs with special formatting
  paragraph.content = paragraph.content.map(run => {
    if (run.vertAlign === 'superscript') {
      return { ...run, type: 'superscript' };
    } else if (run.vertAlign === 'subscript') {
      return { ...run, type: 'subscript' };
    }
    return run;
  });
  return paragraph;
}

/**
#  * Parse MCQs from HTML content
#  * @param {string} htmlContent - HTML content extracted from Word document
#  * @returns {Array} - Array of MCQ objects
#  */
function parseMCQsFromHtml(htmlContent) {
  const mcqs = [];
  let currentMCQ = null;
  
  // Split content by question markers
  const parts = htmlContent.split(/Q:\)|Q:&#x29;/);
  
  // Skip the first part as it's usually empty
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;
    
    // Create a new MCQ object
    currentMCQ = {
      questionText: '',
      options: {
        A: '',
        B: '',
        C: '',
        D: ''
      },
      correctOption: '',
      explanation: ''
    };
    
    // Split content into sections (question, options, correct, explanation)
    const questionAndOptions = part.split(/(:Correct:)|(:Correct:&#x29;)/)[0];
    const correctAndExplanation = part.split(/(:Correct:)|(:Correct:&#x29;)/)[2] || '';
    
    // Process question and options
    const optionParts = questionAndOptions.split(/([A-D]:\)|[A-D]:&#x29;)/);
    
    // Extract question text
    currentMCQ.questionText = formatText(optionParts[0].trim());
    
    // Extract options
    let currentOption = '';
    for (let j = 1; j < optionParts.length; j++) {
      const optPart = optionParts[j].trim();
      
      if (optPart.match(/[A-D]:\)|[A-D]:&#x29;/)) {
        currentOption = optPart.charAt(0);
      } else if (currentOption && optPart) {
        currentMCQ.options[currentOption] = formatText(optPart);
      }
    }
    
    // Process correct answer and explanation
    if (correctAndExplanation) {
      const explParts = correctAndExplanation.split(/(:Explanation:)|(:Explanation:&#x29;)/);
      
      // Extract correct option
      if (explParts[0]) {
        currentMCQ.correctOption = explParts[0].trim();
      }
      
      // Extract explanation
      if (explParts.length > 1 && explParts[2]) {
        currentMCQ.explanation = formatText(explParts[2].trim());
      }
    }
    
    mcqs.push(currentMCQ);
  }
  
  return mcqs;
}

/**
 * Format text to handle HTML entities and special formatting
 * @param {string} text - Text to format
 * @returns {string} - Formatted text
 */
function formatText(text) {
  // Clean up HTML entities
  let formatted = text.replace(/&[a-z0-9]+;/gi, match => {
    switch(match) {
      case '&lt;': return '<';
      case '&gt;': return '>';
      case '&amp;': return '&';
      case '&quot;': return '"';
      case '&apos;': return "'";
      case '&nbsp;': return ' ';
      default: return match;
    }
  });
  
  // Replace HTML tags for superscript and subscript
  formatted = formatted.replace(/<sup>(.*?)<\/sup>/g, '<sup>$1</sup>');
  formatted = formatted.replace(/<sub>(.*?)<\/sub>/g, '<sub>$1</sub>');
  
  return formatted;
}

/**
 * Main function to read MCQs from a document and save as JSON
 * @param {string} inputFile - Path to the Word document
 * @param {string} outputFile - Path to save the JSON output
 */
async function convertMCQsToJson(inputFile, outputFile) {
  try {
    console.log(`Reading MCQs from: ${inputFile}`);
    const mcqs = await parseMCQsFromDocument(inputFile);
    
    console.log(`Found ${mcqs.length} MCQs in the document`);
    
    // Save MCQs to JSON file
    fs.writeFileSync(
      outputFile,
      JSON.stringify(mcqs, null, 2),
      'utf8'
    );
    
    console.log(`MCQs successfully saved to: ${outputFile}`);
    return mcqs;
  } catch (error) {
    console.error('Error converting MCQs to JSON:', error);
    throw error;
  }
}

// Example usage
const inputFile = './testing.docx';  // Replace with your input file path
const outputFile = './mcqs1.json';              // Output JSON file path

// Only run if called directly (not imported)
if (require.main === module) {
  convertMCQsToJson(inputFile, outputFile)
    .then(mcqs => {
      console.log('MCQ conversion complete!');
    })
    .catch(err => {
      console.error('Failed to convert MCQs:', err);
      process.exit(1);
    });
}

module.exports = {
  parseMCQsFromDocument,
  convertMCQsToJson
};