import { useEffect } from "react";
import { useParams } from "react-router-dom";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || `${window.location.origin}/api`;

const PaymentInvoiceGate = () => {
  const { invoiceNo } = useParams();

  useEffect(() => {
    const normalizedInvoice = (invoiceNo || "").trim();

    if (!normalizedInvoice) {
      window.location.replace("/payment/failed?reason=missing_transaction");
      return;
    }

    const gateUrl = `${API_BASE_URL}/payments/entry/${encodeURIComponent(normalizedInvoice)}`;
    window.location.replace(gateUrl);
  }, [invoiceNo]);

  return (
    <div className="h-[100svh] overflow-hidden bg-gradient-to-b from-emerald-50 via-white to-teal-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-7 border border-emerald-100 text-center">
        <h1 className="app-page-title">Checking transaction status...</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Please wait while we verify your invoice.
        </p>
      </div>
    </div>
  );
};

export default PaymentInvoiceGate;
