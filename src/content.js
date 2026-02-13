// Click Tracker Content Script

// New global to hold file data until sent
let pendingAttachments = {};

// Helper to check auth and trigger popup if needed
async function checkAuthAndOpen() {
  // Check if extension context is still valid
  if (!chrome.runtime || !chrome.runtime.id) return;

  try {
    const result = await chrome.storage.local.get(["auth"]);
    if (!result.auth || !result.auth.accessToken) {
      chrome.runtime.sendMessage({ type: "CHECK_AUTH_OPEN" });
    }
  } catch (err) {
    // Ignore context invalidated errors (happens when extension reloads/updates)
    if (!err.message.includes("Extension context invalidated")) {
      console.error("Auth check failed:", err);
    }
  }
}

// Check auth on load
checkAuthAndOpen();

let lastProcessedGmailId = null;

async function checkGmailReceivedEmail() {
  if (!window.location.hostname.includes("mail.google.com")) return;

  const hash = window.location.hash;
  // Gmail message IDs in hash can be 16 hex characters or longer alphanumeric strings
  const msgMatch = hash.match(/[#\/]([a-zA-Z0-9]{16,})\b/);

  if (!msgMatch) return;

  const msgId = msgMatch[1];
  if (msgId === lastProcessedGmailId) return;

  // Use a small delay to ensure the DOM is populated
  setTimeout(async () => {
    try {
      if (!window.location.hash.includes(msgId)) return;

      const subjectEl = document.querySelector("h2.hP");
      const bodyEl = document.querySelector("div.a3s.aiL");
      const senderEl = document.querySelector("span.gD");

      if (subjectEl && bodyEl && senderEl) {
        lastProcessedGmailId = msgId;

        const parseGmailDetails = () => {
          const details = { from: "", to: "", cc: "", bcc: "" };

          // Strategy 1: Look for the details table (most reliable for current Gmail)
          const detailsTable = document.querySelector("table.ajc");
          if (detailsTable) {
            const rows = Array.from(detailsTable.querySelectorAll("tr"));
            rows.forEach((row) => {
              // The label is specifically in td.gG
              const labelCell = row.querySelector("td.gG");
              if (!labelCell) return;

              const label = labelCell.innerText.toLowerCase().trim();
              // The value is specifically in td.gL
              const valueCell = row.querySelector("td.gL");
              if (!valueCell) return;

              const emails = Array.from(valueCell.querySelectorAll("[email]"))
                .map((el) => el.getAttribute("email"))
                .filter(Boolean);

              const emailString = [...new Set(emails)].join(", ");

              if (label.includes("from:")) details.from = emailString;
              else if (label.includes("to:")) details.to = emailString;
              else if (label.includes("cc:")) details.cc = emailString;
              else if (label.includes("bcc:")) details.bcc = emailString;
            });

            // If we found any recipient data, return it
            if (details.from || details.to || details.cc || details.bcc)
              return details;
          }

          // Strategy 2: Fallback to the span.hb strategy
          const detailsSpan = document.querySelector("span.hb");
          if (detailsSpan) {
            let currentField = "to";
            const toList = [];
            const ccList = [];
            const bccList = [];

            Array.from(detailsSpan.childNodes).forEach((node) => {
              if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.toLowerCase();
                if (text.includes("cc:")) currentField = "cc";
                else if (text.includes("bcc:")) currentField = "bcc";
              } else if (
                node.nodeType === Node.ELEMENT_NODE &&
                node.tagName === "SPAN"
              ) {
                const email = node.getAttribute("email") || node.innerText;
                if (email) {
                  if (currentField === "to") toList.push(email);
                  else if (currentField === "cc") ccList.push(email);
                  else if (currentField === "bcc") bccList.push(email);
                }
              }
            });
            details.to = toList.join(", ");
            details.cc = ccList.join(", ");
            details.bcc = bccList.join(", ");
          }

          return details;
        };

        const recipients = parseGmailDetails();

        const emailData = {
          timestamp: new Date().toISOString(),
          pageTitle: document.title,
          url: window.location.href,
          label: "Received email",
          eventType: 0, // 0 - Gmail Event
          gmail: {
            from:
              recipients.from ||
              senderEl.getAttribute("email") ||
              senderEl.innerText,
            subject: subjectEl.innerText,
            body: bodyEl.innerText,
            to: recipients.to,
            cc: recipients.cc,
            bcc: recipients.bcc,
          },
        };

        if (chrome.runtime && chrome.runtime.id) {
          chrome.runtime.sendMessage({
            type: "SAVE_LOG",
            data: emailData,
          });
        }
      }
    } catch (err) {
      console.error("Error extracting received email:", err);
    }
  }, 2000);
}

// Watch for navigation within Gmail
// window.addEventListener("hashchange", checkGmailReceivedEmail);
// checkGmailReceivedEmail(); // Also check on initial load

// Listener for file selections
document.addEventListener(
  "change",
  (e) => {
    if (e.target.type === "file" && e.target.files) {
      processFiles(e.target.files);
    }
  },
  true,
); // Capture phase

// Listener for drag and drop
document.addEventListener(
  "drop",
  (e) => {
    if (e.dataTransfer && e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  },
  true,
);

function processFiles(fileList) {
  Array.from(fileList).forEach((file) => {
    // Safety check for size (e.g. skip > 3MB to avoid storage quota errors)
    if (file.size > 3 * 1024 * 1024) {
      console.warn(`File ${file.name} too large to store locally.`);
      pendingAttachments[file.name] = {
        name: file.name,
        type: file.type,
        content: null, // Too large
        error: "File too large (>3MB)",
        size: file.size,
        timestamp: Date.now(),
      };
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      pendingAttachments[file.name] = {
        name: file.name,
        type: file.type,
        content: e.target.result, // Base64 string
        size: file.size,
        timestamp: Date.now(),
      };
      console.log("Captured attachment:", file.name);
    };
    reader.readAsDataURL(file);
  });
}

document.addEventListener(
  "click",
  async (event) => {
    // Check auth on every click as well
    await checkAuthAndOpen();

    const target = event.target;

    // Cleanup old pending attachments (optional, strict logic omitted for simplicity)

    // Try to get the most meaningful label
    let label =
      target.innerText ||
      target.value ||
      target.getAttribute("aria-label") ||
      target.alt ||
      target.name ||
      "Unknown Element";

    // Clean up label
    label = label.trim();
    if (!label) {
      // If no text, try to find a parent with text (like a button with an icon inside)
      const distinctParent = target.closest('button, a, [role="button"]');
      if (distinctParent) {
        label =
          distinctParent.innerText ||
          distinctParent.getAttribute("aria-label") ||
          "Interactive Element";
      }
    }

    const clickData = {
      timestamp: new Date().toISOString(),
      pageTitle: document.title,
      url: window.location.href,
      // elementTag: target.tagName,
      // elementId: target.id || "",
      // elementClass: target.className || "",
      label: label,
      // x: event.clientX,
      // y: event.clientY,
      eventType: 1, // 1 - Default Click
    };

    // --- Gmail Specific Logic ---
    // Only run if on Gmail
    if (window.location.hostname.includes("mail.google.com")) {
      // Check if "Send" button was clicked
      const button = target.closest('[role="button"]') || target;
      const buttonText = (button.innerText || "").toLowerCase();
      const buttonLabel = (
        button.getAttribute("aria-label") || ""
      ).toLowerCase();

      // Check for Send button action (text 'send' or aria-label starting with 'send')
      const isSendAction =
        buttonText === "send" || buttonLabel.startsWith("send");

      // The button must be inside a compose dialog/container
      const composeWindow =
        button.closest('[role="dialog"]') ||
        button.closest("table") ||
        button.closest(".M9");

      if (isSendAction && composeWindow) {
        clickData.label = "Sent Email";
        clickData.eventType = 0; // 0 - Gmail Event
        clickData.gmail = {};

        const extractRecipients = (fieldName) => {
          // ... (same as before) ...
          // 1. Try hidden input first - usually reliable for comma-separated emails
          const hiddenInput = composeWindow.querySelector(
            `input[name="${fieldName}"]`,
          );
          if (hiddenInput && hiddenInput.value) {
            return hiddenInput.value;
          }

          // 2. Try parsing chips from the visible container
          const container = composeWindow.querySelector(
            `div[name="${fieldName}"]`,
          );
          if (container) {
            // Look for chips with email data
            const chips = container.querySelectorAll(
              "[data-hovercard-id], [email]",
            );
            if (chips.length > 0) {
              const emails = Array.from(chips)
                .map(
                  (chip) =>
                    chip.getAttribute("data-hovercard-id") ||
                    chip.getAttribute("email"),
                )
                .filter(Boolean);
              // Deduplicate and join
              return [...new Set(emails)].join(", ");
            }
            // 3. Fallback to innerText but try to clean it
            return container.innerText.replace(/\n/g, ", ").trim();
          }
          return null;
        };

        const to = extractRecipients("to");
        const cc = extractRecipients("cc");
        const bcc = extractRecipients("bcc");
        const subject = composeWindow.querySelector(
          'input[name="subjectbox"]',
        )?.value;

        // Extract Body
        const bodyEl = composeWindow.querySelector(
          'div[aria-label="Message Body"], div[role="textbox"]',
        );
        const body = bodyEl ? bodyEl.innerText : null;

        if (to) clickData.gmail.to = to;
        if (cc) clickData.gmail.cc = cc;
        if (bcc) clickData.gmail.bcc = bcc;
        if (subject) clickData.gmail.subject = subject;
        if (body) clickData.gmail.body = body;

        // Attachments
        // Strategy: look for elements with aria-label starting with "Attachment:"
        const attachments = [];
        const attachEls = composeWindow.querySelectorAll(
          '[aria-label^="Attachment:"]',
        );
        attachEls.forEach((el) => {
          // Get the full label which often contains "filename.ext. Press enter to view..."
          const rawLabel = el
            .getAttribute("aria-label")
            .replace(/^Attachment:\s*/, "");

          // Clean the filename: simpler heuristic - take potential filename at the start
          // Gmail often formats it as "filename.ext. Press enter..." or similar.
          // Let's try to match this label against our captured keys.

          let matchedContent = null;
          let matchedName = rawLabel;

          // Find a matching file in pendingAttachments
          // We check if the rawLabel *starts with* the captured filename (most likely scenario)
          // or if the captured filename is contained within the label.

          const pendingKeys = Object.keys(pendingAttachments);
          for (const key of pendingKeys) {
            if (rawLabel.includes(key)) {
              matchedContent = pendingAttachments[key];
              matchedName = key; // Use the clean filename from the file input
              break;
            }
          }

          if (matchedContent) {
            attachments.push(matchedContent);
          } else {
            // Fallback: just store the name we found on UI, no content
            // Try to clean "Press enter..." garbage if possible, though exact format varies
            // E.g. "image.png. Press enter to view the attachment and delete to remove it"
            // split by ". Press" might be safe enough for English locale
            const cleanName = rawLabel.split(". Press")[0];
            attachments.push({ name: cleanName, content: null });
          }
        });

        if (attachments.length > 0) {
          clickData.gmail.attachments = attachments;
        }

        console.log("Detected Gmail Send:", clickData.gmail);
      }
    }
    // ----------------------------

    // --- Gmail Specific Logic ---
    // ... (rest of the check exists) ...
    // Send to background for storage and API logging
    // Send to background for storage and API logging
    try {
      if (chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({
          type: "SAVE_LOG",
          data: clickData,
        });
      }
    } catch (err) {
      if (!err.message.includes("Extension context invalidated")) {
        console.error("Error sending log to background:", err);
      }
    }
  },
  true,
);
