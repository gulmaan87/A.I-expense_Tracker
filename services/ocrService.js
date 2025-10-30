const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');
const { fromPath } = require('pdf2pic');
const pdfParse = require('pdf-parse');

// OCR service for receipt processing
class OCRService {
  constructor() {
    this.worker = null;
  }

  async initializeWorker() {
    if (!this.worker) {
      // Tesseract.js v5: createWorker without language arg; then loadLanguage + initialize
      this.worker = await Tesseract.createWorker();
      await this.worker.loadLanguage('eng');
      await this.worker.initialize('eng');
    }
    return this.worker;
  }

  async extractText(imagePath) {
    try {
      const ext = path.extname(imagePath).toLowerCase();
      if (ext === '.pdf') {
        const buffer = fs.readFileSync(imagePath);
        const result = await pdfParse(buffer);
        return result.text || '';
      }
      const worker = await this.initializeWorker();
      const imageBuffer = fs.readFileSync(imagePath);
      const { data: { text } } = await worker.recognize(imageBuffer);
      return text;
    } catch (error) {
      logger.error('OCR text extraction failed:', error);
      throw error;
    }
  }

  // Parse extracted text to find structured data
  parseReceiptData(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let merchant = '';
    let amount = 0;
    let date = '';
    let items = [];
    
    // Common patterns for receipt parsing
    const amountPattern = /(\$|₹|€|£)?\s*(\d+\.?\d*)/g;
    const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/;
    const totalPattern = /(total|subtotal|amount|sum|balance)/i;
    
    // Find merchant name (usually first line or line with common business words)
    const businessWords = ['restaurant', 'cafe', 'store', 'shop', 'market', 'pharmacy', 'gas', 'station'];
    for (const line of lines.slice(0, 5)) {
      if (businessWords.some(word => line.toLowerCase().includes(word)) || 
          line.length > 5 && line.length < 50) {
        merchant = line;
        break;
      }
    }
    
    // Find amount (look for numbers with currency symbols)
    let amounts = [];
    for (const line of lines) {
      const matches = line.match(amountPattern);
      if (matches) {
        matches.forEach(match => {
          const num = parseFloat(match.replace(/[^\d.]/g, ''));
          if (num > 0) amounts.push(num);
        });
      }
    }
    
    // Get the largest amount (usually the total)
    if (amounts.length > 0) {
      amount = Math.max(...amounts);
    }
    
    // Find date
    for (const line of lines) {
      const dateMatch = line.match(datePattern);
      if (dateMatch) {
        date = dateMatch[0];
        break;
      }
    }
    
    // Extract items (lines that look like product descriptions)
    for (const line of lines) {
      // Skip lines that are clearly not items
      if (line.match(/^(total|subtotal|tax|discount|amount|date|time|receipt|thank|you)/i)) {
        continue;
      }
      
      // Skip lines that are just numbers or currency
      if (line.match(/^[\d\s\$₹€£\.]+$/)) {
        continue;
      }
      
      // Skip very short lines
      if (line.length < 3) {
        continue;
      }
      
      // Add as item if it looks like a product
      if (line.length > 3 && line.length < 100) {
        items.push(line);
      }
    }
    
    return {
      merchant: merchant || 'Unknown Merchant',
      amount: amount,
      date: date || new Date().toISOString().split('T')[0],
      items: items.slice(0, 10), // Limit to 10 items
      rawText: text
    };
  }

  async processReceipt(imagePath) {
    try {
      logger.info(`Processing receipt: ${imagePath}`);
      
      // Extract text using OCR
      const text = await this.extractText(imagePath);
      logger.info(`OCR extracted ${text.length} characters`);
      
      // Parse structured data
      const parsedData = this.parseReceiptData(text);
      
      logger.info(`Parsed receipt data:`, {
        merchant: parsedData.merchant,
        amount: parsedData.amount,
        itemsCount: parsedData.items.length
      });
      
      return parsedData;
    } catch (error) {
      logger.error('Receipt processing failed:', error);
      throw error;
    }
  }

  async cleanup() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

const ocrService = new OCRService();

// Export functions
async function extractReceiptData(imagePath) {
  return await ocrService.processReceipt(imagePath);
}

// Cleanup on process exit
process.on('exit', async () => {
  await ocrService.cleanup();
});

process.on('SIGINT', async () => {
  await ocrService.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await ocrService.cleanup();
  process.exit(0);
});

module.exports = {
  extractReceiptData
};
