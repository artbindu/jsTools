jsTools

A collection of JavaScript utilities for working with PDF documents and automating common file-processing tasks.

Features
PDF Compression — Reduce PDF file sizes using Ghostscript.
PDF Merging — Combine PDF documents using the repository's PDF merge utility.
Command-line Utilities — Run supported tools from the terminal using Node.js.
Prerequisites
Node.js
npm
Ghostscript for PDF compression

Install Ghostscript using the package manager appropriate for your operating system, and ensure its executable is available on your system's PATH.

Installation

Clone the repository and install its dependencies:

bash
git clone https://github.com/artbindu/jsTools.git
cd jsTools
npm install

Usage
1. PDF Compression

Compress a PDF by specifying the input file and desired percentage reduction.

bash
node pdf/pdfcompress.js input.pdf 25


Specify a custom output filename:

bash
node pdf/pdfcompress.js input.pdf 25 output.pdf


Parameters

input.pdf — Path to the source PDF.
25 — Target percentage reduction in file size.
output.pdf — Optional destination filename.

If no output filename is provided, the utility generates a compressed filename based on the input file.

Note: The requested reduction is a target, not a guarantee. Stronger compression may reduce image quality. Review the output before distributing important documents.

2. PDF Merging

Run the PDF merge utility using the configured npm script:

bash
npm run pdfmerge


Refer to the merge implementation for its input directory, file selection, and output requirements.

Project Structure
```text
jsTools/
├── pdf/
│   └── pdfcompress.js
├── package.json
└── README.md
```

Additional utilities may be added as the project grows.

Error Handling and Limitations
Ensure the input PDF exists and is accessible.
Verify that Ghostscript is installed before running PDF compression.
Ensure the destination directory is writable.
Back up important files before compression.
Check the generated PDF for readability, page completeness, and image quality.
Compression results depend on the document's contents and existing optimization.
Contributing

Contributions and improvements are welcome.

Create a branch for your change.
Make the changes and test the affected utility.
Update documentation when command-line behavior changes.
Submit a pull request describing the change.
License

Refer to the repository's license file, if present, for applicable terms.