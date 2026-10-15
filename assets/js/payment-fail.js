const failureStatus = document.querySelector("#payment-fail-status");
const failureParams = new URLSearchParams(location.search);
const failureMessage = failureParams.get("message");
goodsUi.message(failureStatus, failureMessage ? `결제가 완료되지 않았습니다: ${failureMessage}` : "결제가 완료되지 않았습니다. 실제 금액은 청구되지 않았습니다.", "error");
