document.addEventListener("DOMContentLoaded", () => {
  // Check Authentication
  chrome.storage.local.get(["auth"], (result) => {
    if (!result.auth || !result.auth.accessToken) {
      window.location.href = "login.html";
      return;
    } else {
      // Only load data if authenticated
      loadData();
    }
  });

  const list = document.getElementById("activity-list");
  const countBadge = document.getElementById("click-count");
  const clearBtn = document.getElementById("clear-btn");

  function renderList(history) {
    if (!history || history.length === 0) {
      list.innerHTML =
        '<div class="empty-state">No events recorded yet. Start clicking!</div>';
      countBadge.innerText = "0 Events";
      return;
    }

    countBadge.innerText = `${history.length} Events`;
    list.innerHTML = "";

    // Group history by URL (ignoring hash/fragments if needed, but using full href is safest for unique pages)
    // We will use the URL as the unique key
    const groups = {};

    // Sort history by time (newest first) - assuming input is already sorted as per content.js logic

    history.forEach((item) => {
      // Use URL as the grouping key.
      // Fallback to title if URL is missing for some reason.
      const key = item.url || item.pageTitle || "Unknown Group";

      if (!groups[key]) {
        groups[key] = {
          title: item.pageTitle || "Unknown Page",
          url: item.url,
          items: [],
        };
      }

      // If we encounter a better title (not empty/generic) for the same URL, update it.
      if (item.pageTitle && groups[key].title === "Unknown Page") {
        groups[key].title = item.pageTitle;
      }

      groups[key].items.push(item);
    });

    // Render groups
    // Since 'groups' is an object, order is keys insertion order roughly.
    // Ideally we want to show the group with the most recent click first.
    // But since we built it iterating through history (latest first), the keys should be in order of appearance (latest).

    Object.keys(groups).forEach((key) => {
      const group = groups[key];
      const items = group.items;

      const groupDiv = document.createElement("div");
      groupDiv.className = "activity-group";

      const groupHeader = document.createElement("div");
      groupHeader.className = "group-header";

      // Display Title, but we can also show domain/truncated URL for clarity
      let domainInfo = "";
      try {
        if (group.url) {
          const urlObj = new URL(group.url);
          domainInfo = `<span style="font-weight:400; color:#64748b; margin-left:6px; font-size:11px;">${urlObj.hostname}</span>`;
        }
      } catch (e) {}

      groupHeader.innerHTML = `
        <div style="display:flex; align-items:center; overflow:hidden;">
            <span class="group-title" title="${group.title}">${group.title}</span>
            ${domainInfo}
        </div>
        <span class="group-count">${items.length}</span>
      `;
      groupDiv.appendChild(groupHeader);

      items.forEach((item) => {
        const date = new Date(item.timestamp);
        const timeStr = date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        const itemDiv = document.createElement("div");
        itemDiv.className = "activity-item";

        // Gmail Details HTML
        let gmailHtml = "";
        if (item.gmail) {
          gmailHtml = '<div class="gmail-details">';
          if (item.gmail.subject)
            gmailHtml += `<div class="gmail-field"><strong>Subject:</strong> ${item.gmail.subject}</div>`;
          if (item.gmail.body)
            gmailHtml += `<div class="gmail-field gmail-body"><strong>Body:</strong> ${item.gmail.body}</div>`;
          if (item.gmail.to)
            gmailHtml += `<div class="gmail-field"><strong>To:</strong> ${item.gmail.to}</div>`;
          if (item.gmail.from)
            gmailHtml += `<div class="gmail-field"><strong>From:</strong> ${item.gmail.from}</div>`;
          if (item.gmail.cc)
            gmailHtml += `<div class="gmail-field"><strong>CC:</strong> ${item.gmail.cc}</div>`;
          if (item.gmail.bcc)
            gmailHtml += `<div class="gmail-field"><strong>BCC:</strong> ${item.gmail.bcc}</div>`;

          if (item.gmail.attachments && item.gmail.attachments.length > 0) {
            gmailHtml += `<div class="gmail-field"><strong>Attachments:</strong></div>`;
            gmailHtml += `<div class="gmail-attachments">`;
            item.gmail.attachments.forEach((att) => {
              // Handle both legacy string format and new object format
              const name = typeof att === "object" ? att.name : att;
              const content = typeof att === "object" ? att.content : null;

              if (content && !content.startsWith("File too large")) {
                // Create a download link
                gmailHtml += `<a href="${content}" download="${name}" class="gmail-tag" style="text-decoration:none; cursor:pointer;" title="Click to download">📎 ${name}</a>`;
              } else {
                const err =
                  typeof att === "object" && att.error ? ` (${att.error})` : "";
                gmailHtml += `<span class="gmail-tag">${name}${err}</span>`;
              }
            });
            gmailHtml += `</div>`;
          }
          gmailHtml += "</div>";
        }

        let displayPath = "";
        try {
          const urlObj = new URL(item.url);
          displayPath = urlObj.pathname + urlObj.hash;
          if (displayPath.length > 40)
            displayPath = displayPath.substring(0, 40) + "...";
        } catch (e) {}

        itemDiv.innerHTML = `
            <div class="item-header">
              <span class="item-element" title="${item.elementTag} - ${item.elementId}">${item.label}</span>
              <span class="item-time">${timeStr}</span>
            </div>
            ${gmailHtml}
            <div class="item-url" title="${item.url}">
            ${displayPath}
            </div>
          `;

        groupDiv.appendChild(itemDiv);
      });

      list.appendChild(groupDiv);
    });
  }

  function loadData() {
    chrome.storage.local.get(["clickHistory"], (result) => {
      renderList(result.clickHistory || []);
    });
  }

  // Initial Load handled in auth check

  // Handle Clear
  clearBtn.addEventListener("click", () => {
    chrome.storage.local.remove("clickHistory", () => {
      loadData();
    });
  });

  // Listen for changes in storage (if user clicks while popup is open)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.clickHistory) {
      renderList(changes.clickHistory.newValue || []);
    }
  });
});
