const signupForm = document.querySelector("#signup-form");
const loginForm = document.querySelector("#login-form");
const authStatus = document.querySelector("#auth-status");

signupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = signupForm.querySelector("button[type=submit]");
  button.disabled = true;
  goodsUi.message(authStatus, "계정을 만들고 있습니다…");
  const form = new FormData(signupForm);
  const { data, error } = await goodsShop.auth.signUp({
    email: String(form.get("email")).trim(),
    password: String(form.get("password")),
    options: { data: { display_name: String(form.get("display_name")).trim() } }
  });
  button.disabled = false;
  if (error) {
    goodsUi.message(authStatus, error.message, "error");
    return;
  }
  signupForm.reset();
  if (data.session) {
    goodsUi.message(authStatus, "회원가입이 완료되었습니다. 상품을 둘러보세요.", "success");
    setTimeout(() => { location.href = "index.html"; }, 700);
  } else {
    goodsUi.message(authStatus, "가입 요청을 받았습니다. 이메일 확인이 켜져 있다면 메일 확인 후 로그인하세요.", "success");
  }
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector("button[type=submit]");
  button.disabled = true;
  goodsUi.message(authStatus, "로그인하고 있습니다…");
  const form = new FormData(loginForm);
  const { error } = await goodsShop.auth.signInWithPassword({
    email: String(form.get("email")).trim(),
    password: String(form.get("password"))
  });
  button.disabled = false;
  if (error) {
    goodsUi.message(authStatus, "로그인할 수 없습니다. 이메일 확인 설정과 입력 정보를 확인해 주세요.", "error");
    return;
  }
  location.href = "index.html";
});
