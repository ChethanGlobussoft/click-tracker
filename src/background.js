// Helper to refresh authentication if more than 5 hours have passed
async function checkAndRefreshAuth() {
  try {
    const { auth } = await chrome.storage.local.get(["auth"]);
    if (!auth || !auth.email || !auth.password || !auth.lastAuthTime)
      return auth;

    const lastAuth = new Date(auth.lastAuthTime);
    const now = new Date();
    const hoursElapsed = (now - lastAuth) / (1000 * 60 * 60);

    if (hoursElapsed >= 5) {
      // console.log("Auth expired (5h+), refreshing...");
      const response = await fetch(
        `${process.env.API_DOMAIN}/api/v3/auth/authenticate-extension`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: auth.email, password: auth.password }),
        },
      );

      const data = await response.json();

      if (data.success && data.accessToken) {
        const updatedAuth = {
          ...auth,
          accessToken: data.accessToken,
          lastAuthTime: new Date().toISOString(),
        };
        await chrome.storage.local.set({ auth: updatedAuth });
        console.log("Auth refreshed successfully");
        return updatedAuth;
      } else {
        console.error(
          "Auth refresh failed, logging out:",
          data.message || data.error,
        );
        await chrome.storage.local.remove(["auth"]);
        return null;
      }
    }
    return auth;
  } catch (err) {
    console.error("Error checking/refreshing auth:", err);
    return null;
  }
}

// Helper to send log to the backend API
async function sendLogToApi(visitData) {
  try {
    const auth = await checkAndRefreshAuth();
    // Auth validation
    if (!auth?.accessToken) return;

    // Label validation
    const label = visitData?.label?.trim();
    if (!label || label === "Unknown Element") return;

    const formData = new FormData();

    // ... (rest of form data logic) ...
    formData.append("timestamp", visitData.timestamp);
    formData.append("pageTitle", visitData.pageTitle);
    formData.append("url", visitData.url);
    formData.append("label", visitData.label);
    formData.append("eventType", visitData.eventType);

    if (visitData.gmail) {
      // ... existing gmail logic ...
      if (visitData.gmail.from) formData.append("from", visitData.gmail.from);
      if (visitData.gmail.to) formData.append("to", visitData.gmail.to);
      if (visitData.gmail.cc) formData.append("cc", visitData.gmail.cc);
      if (visitData.gmail.bcc) formData.append("bcc", visitData.gmail.bcc);
      if (visitData.gmail.subject)
        formData.append("subject", visitData.gmail.subject);
      if (visitData.gmail.body) formData.append("body", visitData.gmail.body);

      if (
        visitData.gmail.attachments &&
        visitData.gmail.attachments.length > 0
      ) {
        for (const att of visitData.gmail.attachments) {
          if (
            att.content &&
            typeof att.content === "string" &&
            (att.content.startsWith("data:") ||
              att.content.startsWith("http") ||
              att.content.startsWith("blob:"))
          ) {
            try {
              const resp = await fetch(att.content);
              const blob = await resp.blob();
              formData.append("attachments", blob, att.name);
            } catch (e) {
              console.warn(`Failed to fetch attachment ${att.name}:`, e);
            }
          }
        }
      }
    }

    const response = await fetch(
      `${process.env.API_DOMAIN}/api/v3/user/save-email-monitoring-log`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
        body: formData,
      },
    );

    if (response.status === 401) {
      console.warn("API returned 401, clearing auth data");
      await chrome.storage.local.remove(["auth"]);
      return;
    }

    const result = await response.json();
    // console.log("Log API response:", result);
  } catch (err) {
    console.error("Error sending log to API:", err);
  }
}

// Background storage handler
async function saveToStorageAndApi(visitData) {
  try {
    const data = await chrome.storage.local.get(["clickHistory"]);
    const history = data.clickHistory || [];

    // Avoid Duplicate for page visits
    if (visitData.label === "Page Visit" && history.length > 0) {
      const last = history[0];
      if (
        last.label === "Page Visit" &&
        last.url === visitData.url &&
        new Date() - new Date(last.timestamp) < 5000
      ) {
        return;
      }
    }

    history.unshift(visitData);

    // Filter only events from the last 24 hours
    const now = new Date();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const filteredHistory = history.filter(
      (item) => new Date(item.timestamp) > oneDayAgo,
    );

    // Provide a larger max limit for safety (e.g. 1000 items)
    const trimmedHistory = filteredHistory.slice(0, 1000);

    await chrome.storage.local.set({ clickHistory: trimmedHistory });

    // Send to API
    await sendLogToApi(visitData);
  } catch (err) {
    console.error("Error saving visit/click:", err);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  // console.log("Click Tracker installed.");
  await checkAuthAndOpenPopup();
});

// Listener for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SAVE_LOG" && message.data) {
    saveToStorageAndApi(message.data);
  } else if (message.type === "CHECK_AUTH_OPEN") {
    checkAuthAndOpenPopup();
  }
  return true;
});

// Sync badge status on storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.auth) {
    const newAuth = changes.auth.newValue;
    if (newAuth && newAuth.accessToken) {
      chrome.action.setBadgeText({ text: "" });
    } else {
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
    }
  }
});

// Helper to check auth and open popup if missing
async function checkAuthAndOpenPopup() {
  try {
    const { auth } = await chrome.storage.local.get(["auth"]);
    if (!auth || !auth.accessToken) {
      console.log("No auth detected, indicating through badge...");

      // Set a visual cue on the icon
      if (chrome.action.setBadgeText) {
        await chrome.action.setBadgeText({ text: "!" });
        await chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
      }

      // Attempt to open popup (will fail without user gesture, but keep as best effort)
      if (chrome.action && chrome.action.openPopup) {
        try {
          await chrome.action.openPopup();
        } catch (e) {
          // Ignore "Failed to open popup" error as it is a known Chrome security restriction
        }
      }
    } else {
      // Clear badge if authenticated
      if (chrome.action.setBadgeText) {
        await chrome.action.setBadgeText({ text: "" });
      }
    }
  } catch (err) {
    if (!err.message.includes("Extension context invalidated")) {
      console.error("Error in checkAuthAndOpenPopup:", err);
    }
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    (tab.url.startsWith("http") || tab.url.startsWith("https"))
  ) {
    // Check auth
    await checkAuthAndOpenPopup();

    const visitData = {
      timestamp: new Date().toISOString(),
      pageTitle: tab.title || "Unknown Page",
      url: tab.url,
      label: "Page Visit",
      eventType: 2, // 2 - Page Visit
    };

    await saveToStorageAndApi(visitData);
  }
});

// When user switches tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);

    if (
      tab.url &&
      (tab.url.startsWith("http") || tab.url.startsWith("https"))
    ) {
      // Check auth
      await checkAuthAndOpenPopup();

      const visitData = {
        timestamp: new Date().toISOString(),
        pageTitle: tab.title || "Unknown Page",
        url: tab.url,
        label: "Page Visit",
        eventType: 2, // 2 - Page Visit
      };

      await saveToStorageAndApi(visitData);
    }
  } catch (err) {
    console.error("Tab switch error:", err);
  }
});
