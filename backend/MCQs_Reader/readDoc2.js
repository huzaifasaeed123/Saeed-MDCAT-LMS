const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');
const scpClient = require('scp2');
const util = require('util');
const scpAsync = util.promisify(scpClient.scp);

async function uploadImage(localImagePath, imageName, serverPath) {
    return new Promise(async (resolve, reject) => {
        try {
            await scpAsync(localImagePath, {
                host: '139.59.23.198',
                username: 'root',
                password: 'jArRmM.hD55gUN',  // or use privateKey for SSH keys
                path: serverPath + imageName
            });
            resolve(`http://139.59.23.198/${serverPath}${imageName}`);
        } catch (error) {
            reject(error);
        }
    });
}

async function uploadImagesToServer(docxPath) {
    try {
        const zip = new JSZip();
        const content = await zip.loadAsync(fs.readFileSync(docxPath));

        const imageFiles = Object.keys(content.files).filter(fileName => /^word\/media\//.test(fileName));
        if (imageFiles.length === 0) {
            console.log('No images found in the document.');
            return;
        }

        // Temporary directory for storing images
        const tempDirectory = path.join(__dirname, 'temp_images');
        if (!fs.existsSync(tempDirectory)) {
            fs.mkdirSync(tempDirectory);
        }

        const serverPath = '/home/huzaifa/LMS/QImage'; // Server path where images will be uploaded

        const uploadPromises = imageFiles.map(async (imageFile) => {
            const imageData = await content.files[imageFile].async("nodebuffer");
            const imageName = path.basename(imageFile);
            const localImagePath = path.join(tempDirectory, imageName);
            fs.writeFileSync(localImagePath, imageData);

            const uploadedUrl = await uploadImage(localImagePath, imageName, serverPath);
            fs.unlinkSync(localImagePath); // Delete the temporary file
            return uploadedUrl;
        });

        const imageUrls = await Promise.all(uploadPromises);
        console.log('Uploaded Image URLs:', imageUrls);
        return imageUrls; // This array contains all the image URLs in sequence
    } catch (error) {
        console.error('Error:', error);
    }
}

uploadImagesToServer('testing.docx');
