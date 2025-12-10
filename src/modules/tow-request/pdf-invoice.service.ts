import { ITowRequestDoc } from './tow-request.interfaces';
import { IUserDoc } from '../user/user.interfaces';
import { format } from 'date-fns';
import puppeteer from 'puppeteer';
import { userService } from '../user';

/**
 * Get company user (tow company owner/manager) for invoice generation
 * This is a shared helper used by both email service and download controller
 */
export const getCompanyUserForInvoice = async (towCompanyId: any): Promise<IUserDoc | undefined> => {
  try {
    // Get tow company owner/manager for company info
    const towManagers = await userService.getTowManagersByTowCompanyId(towCompanyId);
    if (towManagers.length > 0) {
      return towManagers[0];
    } else {
      const owner = await userService.getUserById(towCompanyId.toString());
      return owner || undefined;
    }
  } catch (error) {
    console.error('Error getting company user for invoice:', error);
    return undefined;
  }
};

/**
 * Generate HTML invoice for a tow request (Professional Towing Receipt Format)
 * @param {ITowRequestDoc} towRequest - The tow request document
 * @param {IUserDoc} companyUser - The company user (for company info)
 * @returns {string} - HTML string
 */
function generateInvoiceHTML(towRequest: ITowRequestDoc, companyUser?: IUserDoc): string {
  const invoiceNumber = towRequest.invoiceNumber || towRequest.id || towRequest._id;
  const printedDate = format(new Date(), 'M/d/yyyy');
  
  // Company info
  const companyName = companyUser?.company?.companyName || 'Tow Company';
  const companyAddress = companyUser?.company?.businessAddress || '';
  const companyPhone = companyUser?.phoneNumber || '';
  const companyFax = ''; // Add if available
  
  // Date/Time formatting
  const requestedDateTime = towRequest.createdAt 
    ? format(new Date(towRequest.createdAt), 'M/d/yyyy @ h:mm a')
    : 'N/A';
  const completedDateTime = towRequest.completedAt
    ? format(new Date(towRequest.completedAt), 'M/d/yyyy @ h:mm a')
    : 'N/A';
  
  // Requester info
  const requesterName = towRequest.requesterName || 'N/A';
  const requesterPhone = towRequest.requesterPhoneNumber || 'N/A';
  
  // Location info
  const towFrom = towRequest.location?.address || 'N/A';
  const towTo = towRequest.destination?.address || 'N/A';
  
  // Vehicle info
  const vehicleYear = towRequest.vehicleYear || '';
  const vehicleMake = towRequest.vehicleMake || '';
  const vehicleModel = towRequest.vehicleModel || '';
  const vehicleColor = towRequest.vehicleColor || '';
  const vehicleVin = towRequest.vin || '-';
  const vehiclePlate = towRequest.licensePlates?.[0]?.plateText || '-';
  const vehicleOdometer = towRequest.odometer || '-';
  
  // Driver/Operator info (if assigned)
  const driverName = (towRequest as any).assignedToName || 'N/A';
  const truckNumber = (towRequest as any).truckNumber || '';
  
  // Generate charges rows
  type ChargeRow = { description: string; quantity: number; price: number; lineTotal: number; isMileage: boolean };
  let chargeRows: ChargeRow[] = [];
  let subtotal = 0;
  
  // Check if this is a consent-based tow
  const isConsentTow = (towRequest as any).towType === 'Consent';
  
  if (towRequest.charges) {
    const charges = towRequest.charges;
    
    if (isConsentTow) {
      // For consent-based tows, only show the consentTowFee
      const consentFee = charges.consentTowFee ?? 0;
      if (consentFee > 0) {
        chargeRows.push({ 
          description: 'Tow/Hook Fee', 
          quantity: 1, 
          price: consentFee, 
          lineTotal: consentFee, 
          isMileage: false 
        });
      }
      subtotal = consentFee;
    } else {
      // For PPI and other tow types, show all charges
    
    // Mileage charges use quantity only (not quantity × price)
    const mileageCharges = [
      { label: 'Unloaded Enroute Mileage', charge: charges.unloadedEnrouteMileage },
      { label: 'Loaded Hooked Mileage', charge: charges.loadedHookedMileage },
    ];
    
    // Other charges use quantity × price
    const otherCharges = [
      { label: 'Tow/Hook Fee', charge: charges.privatePropertyTowFee },
      { label: 'Impound Fee', charge: charges.impoundFee },
      { label: 'Notification Fee', charge: charges.notificationFee },
      { label: 'Daily Impound Rate', charge: charges.dailyImpoundRate },
    ];
    
    // Process mileage charges (quantity only - displayed as miles)
    mileageCharges.forEach(({ label, charge }) => {
      if (charge && ((charge.quantity ?? 0) > 0)) {
        const qty = charge.quantity ?? 0;
        chargeRows.push({ description: label, quantity: qty, price: 0, lineTotal: qty, isMileage: true });
      }
    });
    
    // Process other charges (quantity × price)
    otherCharges.forEach(({ label, charge }) => {
      if (charge && ((charge.quantity ?? 0) > 0 || (charge.price ?? 0) > 0)) {
        const qty = charge.quantity ?? 1;
        const price = charge.price ?? 0;
        const lineTotal = qty * price;
        chargeRows.push({ description: label, quantity: qty, price, lineTotal, isMileage: false });
      }
    });
    
    subtotal = charges.subTotal || chargeRows.filter(r => !r.isMileage).reduce((sum, row) => sum + row.lineTotal, 0);
    }
  }
  
  const taxes = 0; // Add tax calculation if needed
  const grandTotal = subtotal + taxes;
  const amountPaid = grandTotal; // Assuming paid in full
  const amountDue = 0;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #000;
      background: #fff;
      padding: 20px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
    }
    
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #000;
    }
    .company-header {
      flex: 1;
    }
    .company-name {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    .company-address {
      font-size: 10px;
      color: #333;
    }
    .receipt-header {
      text-align: right;
    }
    .receipt-title {
      font-size: 28px;
      font-weight: normal;
      color: #333;
      margin-bottom: 2px;
    }
    .invoice-number {
      font-size: 14px;
      font-weight: bold;
    }
    .printed-date {
      font-size: 10px;
      color: #666;
      margin-top: 4px;
    }
    
    /* Two Column Info Section */
    .info-section {
      display: flex;
      gap: 40px;
      margin-bottom: 20px;
    }
    .info-column {
      flex: 1;
    }
    .info-row {
      display: flex;
      margin-bottom: 6px;
    }
    .info-label {
      font-weight: bold;
      min-width: 130px;
      color: #333;
    }
    .info-value {
      flex: 1;
    }
    
    /* Vehicle Table */
    .vehicle-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .vehicle-table th,
    .vehicle-table td {
      border: 1px solid #000;
      padding: 6px 8px;
      text-align: left;
    }
    .vehicle-table th {
      background-color: #f5f5f5;
      font-weight: bold;
      font-size: 10px;
    }
    .vehicle-table td {
      font-size: 11px;
    }
    
    /* Charges Table */
    .charges-section {
      margin-bottom: 20px;
    }
    .charges-table {
      width: 100%;
      border-collapse: collapse;
    }
    .charges-table th,
    .charges-table td {
      border: 1px solid #000;
      padding: 8px 10px;
    }
    .charges-table th {
      background-color: #e8e8e8;
      font-weight: bold;
      text-align: left;
      font-size: 10px;
    }
    .charges-table td {
      font-size: 11px;
    }
    .charges-table .qty,
    .charges-table .price,
    .charges-table .total {
      text-align: right;
      width: 80px;
    }
    .charges-table .description {
      text-align: left;
    }
    
    /* Totals Section */
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 10px;
    }
    .totals-box {
      width: 280px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid #ddd;
    }
    .total-row.grand-total {
      font-weight: bold;
      border-bottom: 2px solid #000;
    }
    .total-row.amount-due {
      font-weight: bold;
      font-size: 13px;
    }
    .payment-note {
      font-size: 11px;
      font-weight: bold;
      text-align: center;
      margin: 15px 0;
      padding: 8px;
      background-color: #f9f9f9;
      border: 1px solid #ddd;
    }
    
    /* Footer */
    .footer-note {
      font-size: 10px;
      color: #333;
      margin-bottom: 20px;
      padding: 10px;
      background-color: #f9f9f9;
    }
    .signature-section {
      margin: 25px 0;
    }
    .signature-line {
      border-bottom: 1px solid #000;
      width: 300px;
      margin-top: 30px;
    }
    .signature-label {
      font-size: 10px;
      margin-top: 4px;
    }
    
    .regulatory-info {
      font-size: 9px;
      color: #666;
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
    }
    .regulatory-info p {
      margin-bottom: 6px;
    }
    .powered-by {
      font-size: 9px;
      color: #999;
      text-align: left;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="company-header">
        <div class="company-name">${companyName}</div>
        <div class="company-address">
          ${companyAddress ? `${companyAddress}<br>` : ''}
          ${companyPhone ? `Phone: ${companyPhone}` : ''}${companyFax ? ` | Fax: ${companyFax}` : ''}
        </div>
      </div>
      <div class="receipt-header">
        <div class="receipt-title">Receipt</div>
        <div class="invoice-number">Invoice #${invoiceNumber}</div>
        <div class="printed-date">Printed ${printedDate}</div>
      </div>
    </div>
    
    <!-- Two Column Info -->
    <div class="info-section">
      <div class="info-column">
        <div class="info-row">
          <span class="info-label">Call #</span>
          <span class="info-value">${invoiceNumber}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Tow Reason</span>
          <span class="info-value">${(towRequest as any).towReason || 'Tow'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Driver</span>
          <span class="info-value">${driverName}</span>
        </div>
        ${truckNumber ? `
        <div class="info-row">
          <span class="info-label">Truck</span>
          <span class="info-value">${truckNumber}</span>
        </div>
        ` : ''}
        <div class="info-row">
          <span class="info-label">Date/Time Requested</span>
          <span class="info-value">${requestedDateTime}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Date/Time Completed</span>
          <span class="info-value">${completedDateTime}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Contact</span>
          <span class="info-value">${requesterName}, ${requesterPhone}</span>
        </div>
      </div>
      <div class="info-column">
        <div class="info-row">
          <span class="info-label">Authorized by</span>
          <span class="info-value">${requesterName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Tow From</span>
          <span class="info-value">${towFrom}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Tow To</span>
          <span class="info-value">${towTo}</span>
        </div>
      </div>
    </div>
    
    <!-- Vehicle Table -->
    <table class="vehicle-table">
      <thead>
        <tr>
          <th>Year</th>
          <th>Make</th>
          <th>Model</th>
          <th>Color</th>
          <th>VIN</th>
          <th>Plate</th>
          <th>Odometer</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${vehicleYear}</td>
          <td>${vehicleMake}</td>
          <td>${vehicleModel}</td>
          <td>${vehicleColor}</td>
          <td>${vehicleVin}</td>
          <td>${vehiclePlate}</td>
          <td>${vehicleOdometer}</td>
        </tr>
      </tbody>
    </table>
    
    <!-- Charges Table -->
    ${chargeRows.length > 0 ? `
    <div class="charges-section">
      <table class="charges-table">
        <thead>
          <tr>
            <th class="description">Charge Description</th>
            <th class="qty">Quantity</th>
            <th class="price">Price</th>
            <th class="total">Line Total</th>
          </tr>
        </thead>
        <tbody>
          ${chargeRows.map(row => row.isMileage ? `
          <tr>
            <td class="description">${row.description}</td>
            <td class="qty">${row.quantity} miles</td>
            <td class="price">-</td>
            <td class="total">${row.quantity} miles</td>
          </tr>
          ` : `
          <tr>
            <td class="description">${row.description}</td>
            <td class="qty">${row.quantity}</td>
            <td class="price">$${row.price.toFixed(2)}</td>
            <td class="total">$${row.lineTotal.toFixed(2)}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <!-- Totals -->
    <div class="totals-section">
      <div class="totals-box">
        <div class="total-row">
          <span>Subtotal</span>
          <span>$${subtotal.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>Taxes</span>
          <span>$${taxes.toFixed(2)}</span>
        </div>
        <div class="total-row grand-total">
          <span>Grand Total</span>
          <span>$${grandTotal.toFixed(2)}</span>
        </div>
        <div class="total-row amount-due">
          <span>Amount Due:</span>
          <span>$${amountDue.toFixed(2)}</span>
        </div>
      </div>
    </div>
    
    ${amountPaid > 0 ? `
    <div class="payment-note">
      Payment of $${amountPaid.toFixed(2)} applied on ${printedDate}
    </div>
    ` : ''}
    ` : ''}
    
    <!-- Footer Note -->
    <div class="footer-note">
      ${companyName} appreciates your business; if you have any questions regarding this invoice, please contact us${companyPhone ? ` at ${companyPhone}` : ''}.
    </div>
    
    <!-- Signature -->
    <div class="signature-section">
      <div class="signature-line"></div>
      <div class="signature-label">Signature</div>
    </div>
    
    <!-- Regulatory Info -->
    <div class="regulatory-info">
      <p>You may direct all complaints to your local Department of Licensing & Regulation or through the towing company's official contact channels.</p>
    </div>
    
    <!-- Powered By -->
    <div class="powered-by">
      Created with Hits Towing Manager | www.hitstowingmanager.com
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate PDF invoice for a tow request using HTML template
 * @param {ITowRequestDoc} towRequest - The tow request document
 * @param {IUserDoc} companyUser - The company user (for company info)
 * @returns {Promise<Buffer>} - PDF buffer
 */
export const generateInvoicePDF = async (towRequest: ITowRequestDoc, companyUser?: IUserDoc): Promise<Buffer> => {
  let browser;
  try {
    // Generate HTML
    const html = generateInvoiceHTML(towRequest, companyUser);

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
    await page.setContent(html, {
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
    console.error('Error generating invoice PDF:', error);
    throw new Error(`Failed to generate invoice PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

