const merge = require('easy-pdf-merge');
const path = require('path');
const fs = require('fs');

// Read all files from the input directory
const inputDir = path.join(__dirname, 'input');
const source_files = fs.readdirSync(inputDir)
    .filter(file => file.toLowerCase().endsWith('.pdf'))
    .map(file => path.join(inputDir, file));

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

// Define output file path
const dest_file_path = path.join(outputDir, 'merged.pdf');

// Merge PDFs
merge(source_files, dest_file_path, function (err) {
    if (err) {
        console.error('Error merging PDFs:', err);
        return;
    }
    console.log('PDFs merged successfully!');
    console.log('Output file:', dest_file_path);
});