import React from "react";
import { SaleItem, SaleProductItem } from "../types";
import { formatCurrency, formatDate } from "../utils/formatters";
import { Printer, Download, X, CheckCircle2, Clock, Building2, Phone, Mail, FileText } from "lucide-react";

interface InvoiceModalProps {
  sale: SaleItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ sale, isOpen, onClose }) => {
  if (!isOpen || !sale) return null;

  const invoiceNo = sale.invoice_no || `INV-${sale.id}`;
  const saleDate = formatDate(sale.sale_date);

  // If sale.items exists use them, otherwise fallback to single item
  const items: SaleProductItem[] =
    sale.items && sale.items.length > 0
      ? sale.items
      : [
          {
            product_name: sale.product_name,
            quantity: sale.quantity,
            unit_price: (sale.subtotal || sale.total_amount) / Math.max(1, sale.quantity),
            discount: sale.discount || 0,
            tax_rate: 18,
            total_price: sale.total_amount,
          },
        ];

  const subtotal = sale.subtotal !== undefined ? sale.subtotal : items.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);
  const discount = sale.discount !== undefined ? sale.discount : items.reduce((acc, it) => acc + (it.discount || 0), 0);
  const taxAmount = sale.tax_amount !== undefined ? sale.tax_amount : (sale.total_amount - (subtotal - discount));
  const totalAmount = sale.total_amount;
  const isPaid = (sale.payment_status || "Paid").toLowerCase() === "paid";

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // Generates a self-contained printable HTML document
    const invoiceContent = document.getElementById("printable-invoice-content");
    if (!invoiceContent) return;

    try {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        window.print();
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Invoice - ${invoiceNo}</title>
            <meta charset="utf-8" />
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @media print {
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }
            </style>
          </head>
          <body class="bg-white p-8">
            ${invoiceContent.innerHTML}
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white">
      {/* Modal Card */}
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Top Action Header (Hidden in Print) */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight text-white">
                Tax Invoice &bull; {invoiceNo}
              </h3>
              <p className="text-[11px] text-slate-400">
                Issued on {saleDate} &bull; {sale.payment_method || "Cash"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-colors border border-slate-700 cursor-pointer"
              title="Print Invoice"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-2xs cursor-pointer"
              title="Download Invoice"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Body */}
        <div id="printable-invoice-content" className="p-6 sm:p-8 overflow-y-auto space-y-6 print:p-0 print:overflow-visible">
          
          {/* Header & Company Brand */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">Smart Business Manager</h1>
                  <p className="text-xs text-slate-500">Retail &amp; Enterprise Solutions</p>
                </div>
              </div>
              <div className="text-xs text-slate-600 space-y-0.5 pt-2">
                <p>108 Tech Hub, Commercial District</p>
                <p>New Delhi, DL 110001, India</p>
                <p className="text-slate-500">GSTIN: <span className="font-mono font-medium text-slate-700">07AAAAA0000A1Z5</span></p>
                <p className="text-slate-500">Contact: +91 (011) 4567-8900 &bull; billing@smartbiz.in</p>
              </div>
            </div>

            {/* Invoice Meta */}
            <div className="sm:text-right space-y-1">
              <div className="inline-block px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs uppercase tracking-wider rounded-md">
                Original Tax Invoice
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono tracking-tight pt-1">
                {invoiceNo}
              </div>
              <div className="text-xs text-slate-600">
                <span className="font-semibold text-slate-800">Invoice Date:</span> {saleDate}
              </div>
              <div className="text-xs text-slate-600 flex sm:justify-end items-center gap-1.5 pt-1">
                <span className="font-semibold text-slate-800">Payment:</span>
                <span className="font-medium text-slate-700">{sale.payment_method || "Cash"}</span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    isPaid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {isPaid ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {isPaid ? "PAID" : "PENDING"}
                </span>
              </div>
            </div>
          </div>

          {/* Billed To / Customer Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Billed To (Customer)
              </div>
              <div className="text-base font-bold text-slate-900">{sale.customer_name}</div>
              {sale.customer_phone ? (
                <div className="text-xs text-slate-600 flex items-center gap-1.5 mt-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-mono">{sale.customer_phone}</span>
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic mt-0.5">Phone not specified</div>
              )}
            </div>
            <div className="sm:text-right flex flex-col justify-end">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Transaction Reference
              </div>
              <div className="text-xs text-slate-700 font-mono">
                TXN-ID: #SB-{sale.id.toString().padStart(5, "0")}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Place of Supply: Delhi (07)
              </div>
            </div>
          </div>

          {/* Products & Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Item &amp; Description</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4 text-right">Unit Price</th>
                  <th className="py-3 px-4 text-right">Discount</th>
                  <th className="py-3 px-4 text-right">Tax (GST)</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {items.map((item, index) => {
                  const lineGross = item.quantity * item.unit_price;
                  const lineNet = lineGross - (item.discount || 0);
                  const rate = item.tax_rate !== undefined ? item.tax_rate : 18;
                  const lineTax = (lineNet * rate) / 100;
                  const lineTotal = item.total_price || lineNet + lineTax;

                  return (
                    <tr key={index} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 text-center text-slate-400 font-mono">{index + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{item.product_name}</div>
                        {item.sku && (
                          <div className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-medium">{item.quantity}</td>
                      <td className="py-3 px-4 text-right font-mono">{formatCurrency(item.unit_price)}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">
                        {item.discount ? `- ${formatCurrency(item.discount)}` : "₹0.00"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">
                        {rate}% ({formatCurrency(lineTax)})
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                        {formatCurrency(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals Breakdown */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 pt-2">
            {/* Notes / Terms */}
            <div className="w-full sm:w-1/2 space-y-3">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Terms &amp; Bank Details
                </div>
                <div className="text-xs text-slate-600 space-y-0.5">
                  <p>Bank: HDFC Bank Ltd &bull; Branch: Connaught Place</p>
                  <p>Account No: <span className="font-mono font-medium">50200012345678</span></p>
                  <p>IFSC: <span className="font-mono font-medium">HDFC0000123</span> &bull; UPI: smartbiz@upi</p>
                  <p className="text-[11px] text-slate-400 italic pt-1">
                    * Goods once sold can be returned or exchanged within 7 business days with this tax invoice.
                  </p>
                </div>
              </div>

              {sale.notes && (
                <div className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Order Notes: </span>
                  {sale.notes}
                </div>
              )}
            </div>

            {/* Calculations Card */}
            <div className="w-full sm:w-5/12 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 font-medium text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal (Before Tax)</span>
                <span className="font-mono font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Total Discount</span>
                <span className="font-mono text-rose-600 font-semibold">
                  {discount > 0 ? `- ${formatCurrency(discount)}` : "₹0.00"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>GST / Tax Amount</span>
                <span className="font-mono font-semibold text-slate-800">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="pt-2 border-t border-slate-300 flex items-center justify-between text-slate-900">
                <span className="text-sm font-bold">Grand Total</span>
                <span className="text-lg font-black text-blue-700 font-mono">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
              <div className="text-right text-[11px] text-slate-500 font-medium">
                Amount in Words: All amounts in INR (₹)
              </div>
            </div>
          </div>

          {/* Footer Signatures */}
          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              Thank you for doing business with <span className="font-semibold text-slate-700">Smart Business Manager</span>!
            </div>
            <div className="text-center sm:text-right">
              <div className="h-10"></div>
              <div className="border-t border-slate-300 pt-1 font-semibold text-slate-700">
                Authorized Signatory
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
