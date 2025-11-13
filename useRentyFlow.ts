// =============================
// Super Advanced RentyFlowUI Component with Progress Indicator
// =============================

import { useState } from "react";

export function RentyFlowUI({ step: initialStep = 1, nextStep, prevStep, confirmBooking, loading, error }: any) {
  const [step, setStep] = useState(initialStep);

  const handleNext = () => {
    if (nextStep) nextStep();
    setStep(prev => prev + 1);
  };

  const handlePrev = () => {
    if (prevStep) prevStep();
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleConfirm = async () => {
    if (!confirmBooking) return;
    try {
      await confirmBooking();
      setStep(3);
    } catch (e) {
      console.error(e);
    }
  };

  const renderProgress = () => {
    const steps = ["Booking", "Confirm", "Success"];
    return (
      <div className="flex justify-center gap-4 mb-6">
        {steps.map((s, idx) => (
          <div key={idx} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center border-2 font-semibold transition-all ${
                step === idx + 1 ? 'border-blue-600 text-blue-600' : idx + 1 < step ? 'border-green-600 text-green-600' : 'border-gray-300 text-gray-300'
              }`}
            >
              {idx + 1 < step ? '✓' : idx + 1}
            </div>
            {idx < steps.length - 1 && <div className={`flex-1 h-1 ${idx + 1 < step ? 'bg-green-600' : 'bg-gray-300'} transition-all`}></div>}
          </div>
        ))}
      </div>
    );
  };

  const renderStep1 = () => (
    <div className="p-6 text-center border rounded-lg shadow-lg">
      {renderProgress()}
      <h2 className="text-2xl font-bold mb-2">Booking Details</h2>
      <p className="text-gray-600 mb-4">Need this item for a short time? Book it quickly!</p>
      <button
        onClick={handleNext}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition"
      >
        Rent Now
      </button>
    </div>
  );

  const renderStep2 = () => (
    <div className="p-6 text-center border rounded-lg shadow-lg">
      {renderProgress()}
      <h3 className="text-xl font-semibold mb-2">Confirm Your Booking</h3>
      <p className="text-gray-500 mb-3">Please verify your details before confirming.</p>
      {error && <p className="text-red-500 mb-3">{error}</p>}
      <div className="flex justify-center gap-4">
        <button
          onClick={handlePrev}
          className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded transition"
        >
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="animate-pulse">Processing...</span>
          ) : (
            "Confirm & Pay"
          )}
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="p-6 text-center border rounded-lg shadow-lg">
      {renderProgress()}
      <h2 className="text-2xl font-bold text-green-600 mb-3">Booking Successful ✅</h2>
      <p className="text-gray-600 mb-4">We’ll notify you once the owner accepts your rental request.</p>
      <button
        onClick={() => setStep(1)}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition"
      >
        Make Another Booking
      </button>
    </div>
  );

  switch (step) {
    case 1:
      return renderStep1();
    case 2:
      return renderStep2();
    case 3:
      return renderStep3();
    default:
      return <div>Invalid Step</div>;
  }
}
