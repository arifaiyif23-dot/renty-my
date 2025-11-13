// =============================
// Fix: Button Text English Version
// =============================

export function RentyFlowUI({ step, nextStep, prevStep, confirmBooking, loading, error }: any) {
  if (step === 1)
    return (
      <div className="p-4 text-center">
        <h2 className="text-xl font-bold">Booking Details</h2>
        <p className="text-gray-600">Need this item for a short time?</p>
        <button onClick={nextStep} className="bg-blue-600 text-white px-4 py-2 mt-3 rounded">
          Rent Now
        </button>
      </div>
    );

  if (step === 2)
    return (
      <div className="p-4 text-center">
        <h3 className="text-lg font-semibold mb-2">Confirm Your Booking</h3>
        <p className="text-gray-500 mb-3">Please make sure the details are correct before proceeding.</p>
        {error && <p className="text-red-500">{error}</p>}
        <div className="flex justify-center gap-3">
          <button onClick={prevStep} className="bg-gray-400 text-white px-4 py-2 rounded">
            Back
          </button>
          <button onClick={confirmBooking} disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded">
            {loading ? "Processing..." : "Confirm & Pay"}
          </button>
        </div>
      </div>
    );

  if (step === 3)
    return (
      <div className="p-4 text-center">
        <h2 className="text-2xl font-bold text-green-600 mb-3">Booking Successful ✅</h2>
        <p className="text-gray-600 mb-4">We’ll notify you once the owner accepts your rental request.</p>
        <button onClick={() => setStep(1)} className="bg-blue-600 text-white px-4 py-2 rounded">
          Make Another Booking
        </button>
      </div>
    );
}
