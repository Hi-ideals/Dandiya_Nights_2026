const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let loading;

export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Razorpay unavailable')));
    script.onerror = () => {
      loading = undefined;
      script.remove();
      reject(new Error('Could not load the payment window. Please check your connection and try again.'));
    };
    document.body.appendChild(script);
  });
  return loading;
}
