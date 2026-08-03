import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

const PaymentFailed = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const reason = params.get("reason") || "error";

    const nextParams = new URLSearchParams();
    nextParams.set("payment", "failed");
    nextParams.set("reason", reason);

    navigate(`/patient/appointments?${nextParams.toString()}`, {
      replace: true,
    });
  }, [navigate, params]);

  return (
    <div className="h-[100svh] overflow-hidden bg-gradient-to-b from-rose-50 via-white to-red-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-7 border border-rose-100 text-center">
        <h1 className="app-page-title">Processing payment result...</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Redirecting to your appointments.
        </p>
      </div>
    </div>
  );
};

export default PaymentFailed;
