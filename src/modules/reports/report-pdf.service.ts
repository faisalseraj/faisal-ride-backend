import { ReportResult } from './report-generator.service';
import puppeteer from 'puppeteer';

/**
 * Generate PDF from HTML report
 * @param report - The report result containing HTML
 * @returns Buffer containing the PDF data
 */
export async function generateReportPDF(report: ReportResult): Promise<Buffer> {
  let browser;
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();

    // Set content
    await page.setContent(report.html, {
      waitUntil: 'networkidle0',
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generate PDF filename based on report type and span
 */
export function generatePDFFilename(report: ReportResult, reportType: 'admin' | 'company' = 'admin'): string {
  const date = new Date().toISOString().split('T')[0];
  const span = report.subject.includes('Weekly') ? 'weekly' : report.subject.includes('Monthly') ? 'monthly' : 'yearly';
  const type = reportType === 'admin' ? 'admin' : 'company';
  return `${type}-report-${span}-${date}.pdf`;
}

