import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ArrowRight } from "lucide-react";

const PaymentAlreadyConfirmed = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const invoiceNo = params.get("invoice") || "N/A";

  return (
    <div className="h-[100svh] overflow-hidden bg-gradient-to-b from-emerald-50 via-white to-teal-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-7 border border-emerald-100 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9 text-emerald-600" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">
          Transaction Already Confirmed
        </h1>
        <p className="text-gray-500 mt-2 text-sm leading-relaxed">
          This invoice has already been paid. No further payment action is
          required.
        </p>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mt-5 mb-6 text-left">
          <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold mb-1">
            Invoice Number
          </p>
          <p className="text-sm font-mono text-emerald-900 break-all">
            {invoiceNo}
          </p>
        </div>

        <button
          onClick={() => navigate("/patient/appointments", { replace: true })}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          Go to My Appointments <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default PaymentAlreadyConfirmed;
