document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const loginBtn = document.getElementById("login-btn");
  const errorMsg = document.getElementById("error-msg");

  // Check if usage is already authenticated
  chrome.storage.local.get(["auth"], (result) => {
    if (result.auth && result.auth.accessToken) {
      window.location.href = "popup.html";
    }
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      showError("Please fill in all fields");
      return;
    }

    startLoading();

    try {
      const response = await fetch(
        `${process.env.API_DOMAIN}/api/v3/auth/authenticate-extension`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        },
      );

      const data = await response.json();

      if (data.success && data.accessToken) {
        // Success
        const authData = {
          email: email,
          // password: password, // Ideally, avoid storing plaintext passwords if possible, but requested in prompt.
          // For security, usually we only store tokens. I will store it as requested.
          password: password,
          accessToken: data.accessToken,
          lastAuthTime: new Date().toISOString(),
        };

        await chrome.storage.local.set({ auth: authData });
        showSuccess();
        setTimeout(() => {
          window.location.href = "popup.html";
        }, 500);
      } else {
        // Failure
        showError(data.message || data.error || "Authentication failed");
      }
    } catch (err) {
      console.error(err);
      showError("Network error. Please try again.");
    } finally {
      stopLoading();
    }
  });

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.color = "#ef4444";
  }

  function showSuccess() {
    errorMsg.textContent = "Login Successful!";
    errorMsg.style.color = "#10b981";
  }

  function startLoading() {
    loginBtn.disabled = true;
    loginBtn.textContent = "Signing in...";
    errorMsg.textContent = "";
  }

  function stopLoading() {
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign In";
  }
});
