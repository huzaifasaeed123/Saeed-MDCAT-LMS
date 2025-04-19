const JSZip = require("jszip");
const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const SftpClient = require("ssh2-sftp-client");

const uploadImages = async () => {
    const sftp = new SftpClient();
  try {
    
    const localDir = path.join(__dirname, "extracted_images");

    const serverConfig = {
      host: "139.59.23.198",
      port: "22",
      username: "huzaifa",
      password: "R#Sxy775a<6",
    };
    console.log("Connecting to server...");
    await sftp.connect(serverConfig);
    console.log("Connected to server");

    const imageUrls = [];
    const files = fs.readdirSync(localDir);

    if (!files.length) {
      console.log("No files found in the local directory.");
      return;
    }

    for (const file of files) {
      if (file.match(/\.(jpg|jpeg|png)$/)) {
        console.log(`Uploading ${file}...`);
        const remoteFilePath = `/home/huzaifa/LMS/QImage/${file}`;
        await sftp.put(path.join(localDir, file), remoteFilePath);
        imageUrls.push(`/QImage/${file}`);
        console.log(`${file} uploaded.`);
      }
    }

    console.log("Upload completed. Image URLs:", imageUrls);
  } catch (err) {
    console.error("Error during file upload:", err);
  } finally {
    sftp.end();
    console.log("Connection closed.");
  }
};

uploadImages();

async function extractImage(docxPath) {
  try {
    const zip = new JSZip();
    // Read the .docx file as a zip
    const content = await zip.loadAsync(fs.readFileSync(docxPath));
    const imageFolderPath = path.join(__dirname, "extracted_images");
    if (!fs.existsSync(imageFolderPath)) {
      fs.mkdirSync(imageFolderPath);
    }

    // Search for image files in the zip content
    const imageFiles = Object.keys(content.files).filter((fileName) => /^word\/media\//.test(fileName)
    );

    if (imageFiles.length === 0) {
      console.log("No images found in the document.");
      return;
    }
    let count=1000;
    // Extract and save each image
    for (const imageFile of imageFiles) {
      count++;
      const imageData = await content.files[imageFile].async("nodebuffer");
      const imageName = path.basename(imageFile);
      console.log(imageName);
      const imagePath = path.join(imageFolderPath, (count)+".jpeg");
      fs.writeFileSync(imagePath, imageData);
      console.log(`Image extracted: ${imagePath}`);
    }
  } catch (error) {
    console.error("Error extracting image:", error);
  }
}

async function extractText(docxPath) {
  try {
    // Convert .docx to plain text
    const result = await mammoth.extractRawText({ path: docxPath });
    const text = result.value;

    // Regular expression to match text between :Correct: and :MsgCorrect:
    const regex = /:Correct:(.*?):MsgCorrect:/g;
    const matches = [...text.matchAll(regex)];

    // Create an array to store extracted text
    const extractedTexts = matches.map((match) => match[1].trim());

    // Return the array of extracted text
    return extractedTexts;
  } catch (error) {
    console.error("Error extracting text:", error);
    return [];
  }
}
//Example usage
// extractImage('testing.docx');
// extractText('testing.docx').then(extractedTexts => {
//     console.log('Extracted Texts:', extractedTexts);
// });
