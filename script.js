const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");

// Configure marked.js to prevent XSS and ensure proper code handling
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: false,
  mangle: false,
  sanitize: false, // We'll handle sanitization ourselves
  smartLists: true,
  smartypants: true,
  xhtml: false,
});

// Local storage keys
const STORAGE_KEY = "puter_chat_history";
const THEME_KEY = "puter_chat_theme";

// Chat history array
let chatHistory = [];

// Theme toggle functionality
function toggleTheme() {
  const body = document.body;
  const themeToggle = document.querySelector(".theme-toggle");
  const icon = themeToggle.querySelector(".icon");
  const text = themeToggle.querySelector(".text");

  if (body.classList.contains("dark-theme")) {
    body.classList.remove("dark-theme");
    icon.textContent = "🌙";
    text.textContent = "Dark";
    localStorage.setItem(THEME_KEY, "light");
  } else {
    body.classList.add("dark-theme");
    icon.textContent = "☀️";
    text.textContent = "Light";
    localStorage.setItem(THEME_KEY, "dark");
  }
}

// Load saved theme on page load
function loadTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
    document.body.classList.add("dark-theme");
    const themeToggle = document.querySelector(".theme-toggle");
    const icon = themeToggle.querySelector(".icon");
    const text = themeToggle.querySelector(".text");
    icon.textContent = "☀️";
    text.textContent = "Light";
  }
}

// Save chat history to local storage
function saveChatHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory));
  } catch (error) {
    console.warn("Failed to save chat history:", error);
  }
}

// Load chat history from local storage
function loadChatHistory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      chatHistory = JSON.parse(saved);
      return true;
    }
  } catch (error) {
    console.warn("Failed to load chat history:", error);
  }
  return false;
}

// Clear chat function
function clearChat() {
  if (
    confirm(
      "Are you sure you want to clear the chat history? This action cannot be undone."
    )
  ) {
    chatHistory = [];
    chatContainer.innerHTML = "";
    saveChatHistory();

    // Show confirmation message
    const confirmation = createMessageElement("bot");
    confirmation.innerHTML = "Chat history cleared successfully! 🗑️";
    confirmation.style.opacity = "0.7";
    confirmation.style.fontStyle = "italic";

    // Remove confirmation message after 3 seconds
    setTimeout(() => {
      if (confirmation.parentNode) {
        confirmation.remove();
      }
    }, 3000);
  }
}

// Function to sanitize HTML content and prevent code execution
function sanitizeHTML(html) {
  // Create a temporary div to parse the HTML
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  // Remove any script tags and their content
  const scripts = tempDiv.querySelectorAll("script");
  scripts.forEach((script) => script.remove());

  // Remove any event handlers from elements
  const allElements = tempDiv.querySelectorAll("*");
  allElements.forEach((element) => {
    // Remove all event handler attributes
    const eventAttributes = [
      "onclick",
      "onload",
      "onerror",
      "onmouseover",
      "onmouseout",
      "onfocus",
      "onblur",
      "onchange",
      "onsubmit",
      "onkeydown",
      "onkeyup",
      "onkeypress",
    ];
    eventAttributes.forEach((attr) => {
      if (element.hasAttribute(attr)) {
        element.removeAttribute(attr);
      }
    });

    // Remove javascript: URLs from href and src attributes
    if (
      element.hasAttribute("href") &&
      element.getAttribute("href").toLowerCase().startsWith("javascript:")
    ) {
      element.removeAttribute("href");
    }
    if (
      element.hasAttribute("src") &&
      element.getAttribute("src").toLowerCase().startsWith("javascript:")
    ) {
      element.removeAttribute("src");
    }

    // Ensure code blocks are properly handled
    if (element.tagName === "PRE" || element.tagName === "CODE") {
      // Remove any potentially dangerous attributes from code elements
      const dangerousAttrs = ["onclick", "onload", "onerror", "style"];
      dangerousAttrs.forEach((attr) => {
        if (element.hasAttribute(attr)) {
          element.removeAttribute(attr);
        }
      });
    }
  });

  return tempDiv.innerHTML;
}

// Function to create copyable code blocks
function makeCodeBlocksCopyable() {
  const codeBlocks = document.querySelectorAll("pre code");
  codeBlocks.forEach((codeBlock, index) => {
    // Skip if already has copy button
    if (codeBlock.parentElement.querySelector(".copy-button")) {
      return;
    }

    const pre = codeBlock.parentElement;
    const code = codeBlock.textContent;

    // Create copy button
    const copyButton = document.createElement("button");
    copyButton.className = "copy-button";
    copyButton.innerHTML = "📋";
    copyButton.title = "Copy code";
    copyButton.setAttribute("data-code", code);

    // Add click event to copy code
    copyButton.addEventListener("click", async function () {
      try {
        await navigator.clipboard.writeText(code);

        // Show success feedback
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = "✅";
        copyButton.style.background = "#28a745";

        // Reset button after 2 seconds
        setTimeout(() => {
          copyButton.innerHTML = originalText;
          copyButton.style.background = "";
        }, 2000);
      } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);

        // Show success feedback
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = "✅";
        copyButton.style.background = "#28a745";

        setTimeout(() => {
          copyButton.innerHTML = originalText;
          copyButton.style.background = "";
        }, 2000);
      }
    });

    // Add copy button to pre element
    pre.style.position = "relative";
    pre.appendChild(copyButton);
  });
}

// Function to create copyable tables
function makeTablesCopyable() {
  const tables = document.querySelectorAll("table");
  tables.forEach((table, index) => {
    // Skip if already has copy button
    if (table.querySelector(".table-copy-button")) {
      return;
    }

    // Create copy button for table
    const copyButton = document.createElement("button");
    copyButton.className = "table-copy-button";
    copyButton.innerHTML = "📋";
    copyButton.title = "Copy table";
    copyButton.setAttribute("data-table-index", index);

    // Add click event to copy table
    copyButton.addEventListener("click", async function () {
      try {
        const tableText = convertTableToText(table);
        await navigator.clipboard.writeText(tableText);

        // Show success feedback
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = "✅";
        copyButton.style.background = "#28a745";

        // Reset button after 2 seconds
        setTimeout(() => {
          copyButton.innerHTML = originalText;
          copyButton.style.background = "";
        }, 2000);
      } catch (err) {
        // Fallback for older browsers
        const tableText = convertTableToText(table);
        const textArea = document.createElement("textarea");
        textArea.value = tableText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);

        // Show success feedback
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = "✅";
        copyButton.style.background = "#28a745";

        setTimeout(() => {
          copyButton.innerHTML = originalText;
          copyButton.style.background = "";
        }, 2000);
      }
    });

    // Add copy button to table
    table.style.position = "relative";
    table.appendChild(copyButton);
  });
}

// Function to convert table to formatted text
function convertTableToText(table) {
  const rows = table.querySelectorAll("tr");
  const tableData = [];

  rows.forEach((row) => {
    const cells = row.querySelectorAll("th, td");
    const rowData = [];
    cells.forEach((cell) => {
      rowData.push(cell.textContent.trim());
    });
    tableData.push(rowData);
  });

  if (tableData.length === 0) return "";

  // Calculate column widths
  const columnWidths = [];
  for (let col = 0; col < tableData[0].length; col++) {
    let maxWidth = 0;
    for (let row = 0; row < tableData.length; row++) {
      if (tableData[row][col]) {
        maxWidth = Math.max(maxWidth, tableData[row][col].length);
      }
    }
    columnWidths.push(maxWidth);
  }

  // Build the formatted table string
  let result = "";

  // Add header row
  if (tableData.length > 0) {
    result += "|";
    tableData[0].forEach((cell, col) => {
      result += ` ${cell.padEnd(columnWidths[col])} |`;
    });
    result += "\n";

    // Add separator row
    result += "|";
    tableData[0].forEach((_, col) => {
      result += ` ${"-".repeat(columnWidths[col])} |`;
    });
    result += "\n";

    // Add data rows
    for (let row = 1; row < tableData.length; row++) {
      result += "|";
      tableData[row].forEach((cell, col) => {
        result += ` ${cell.padEnd(columnWidths[col])} |`;
      });
      result += "\n";
    }
  }

  return result.trim();
}

// Function to detect if user is asking for table data
function shouldFormatAsTable(userInput) {
  const tableKeywords = [
    "table",
    "tabular",
    "data in table",
    "format as table",
    "show in table",
    "list in table",
    "display as table",
    "create table",
    "make table",
    "table format",
    "tabular format",
    "in a table",
    "as a table",
  ];

  const lowerInput = userInput.toLowerCase();
  return tableKeywords.some((keyword) => lowerInput.includes(keyword));
}

// Function to make all copyable elements (code blocks and tables)
function makeAllCopyable() {
  makeCodeBlocksCopyable();
  makeTablesCopyable();
}

// Initialize theme and load chat history on page load
document.addEventListener("DOMContentLoaded", function () {
  loadTheme();
  loadChatHistory();

  // Restore chat history to UI
  if (chatHistory.length > 0) {
    chatHistory.forEach((message) => {
      try {
        const messageElement = createMessageElement(message.sender);

        if (message.sender === "bot") {
          // For bot messages, parse markdown and sanitize
          const parsedContent = marked.parse(message.content);
          messageElement.innerHTML = sanitizeHTML(parsedContent);

          // Re-apply syntax highlighting for code blocks
          setTimeout(() => {
            const codeBlocks = messageElement.querySelectorAll("pre code");
            codeBlocks.forEach((block) => {
              hljs.highlightElement(block);
            });
            // Make code blocks and tables copyable
            makeAllCopyable();
          }, 10);
        } else {
          // For user messages, just sanitize plain text
          messageElement.innerText = message.content;
        }
      } catch (error) {
        console.warn("Error loading message:", error);
        // Create a fallback message
        const messageElement = createMessageElement(message.sender);
        messageElement.innerText = message.content || "Error loading message";
      }
    });
    scrollToBottom();
  }
});

// Prevent page refresh/close without warning if there's chat history
window.addEventListener("beforeunload", function (e) {
  if (chatHistory.length > 0) {
    e.preventDefault();
    e.returnValue =
      "You have unsaved chat history. Are you sure you want to leave?";
    return e.returnValue;
  }
});

function createMessageElement(sender) {
  const div = document.createElement("div");
  div.classList.add("message", sender);
  div.innerHTML = "";
  chatContainer.appendChild(div);
  scrollToBottom();
  return div;
}

// Improved scroll function that ensures messages are visible
function scrollToBottom() {
  // Use setTimeout to ensure DOM updates are complete
  setTimeout(() => {
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // For mobile, add extra padding to ensure content is visible above input
    const isMobile = window.innerWidth <= 480;
    if (isMobile) {
      // Add a small delay to ensure smooth scrolling
      setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight + 20;
      }, 50);
    }
  }, 10);
}

// Function to scroll to bottom with smooth animation
function smoothScrollToBottom() {
  chatContainer.scrollTo({
    top: chatContainer.scrollHeight,
    behavior: "smooth",
  });
}

async function handleSend() {
  const input = userInput.value.trim();
  if (!input) return;

  // Create user message
  const userMsg = createMessageElement("user");
  userMsg.innerText = input;

  // Save user message to history
  chatHistory.push({
    sender: "user",
    content: input,
    timestamp: new Date().toISOString(),
  });
  saveChatHistory();

  userInput.value = "";

  // Create typing indicator first
  const botTyping = createMessageElement("bot");
  botTyping.classList.add("typing");
  botTyping.innerHTML = `<span class="dots"><span>.</span><span>.</span><span>.</span></span>`;

  let fullReply = "";

  try {
    // Check if user is asking for table data and modify the prompt
    let modifiedInput = input;
    if (shouldFormatAsTable(input)) {
      modifiedInput = `${input}\n\nPlease format your response as a markdown table when appropriate.`;
    }

    // Add directive to include reference links when appropriate
    modifiedInput = `${modifiedInput}\n\nPlease include relevant reference links and sources when providing information, especially for factual data, statistics, research findings, or technical information. Format references as markdown links at the end of your response.`;

    const response = await puter.ai.chat(modifiedInput, { stream: true });

    // Replace typing indicator with actual bot message container
    const botMsg = document.createElement("div");
    botMsg.classList.add("message", "bot");
    botMsg.innerHTML = "";
    chatContainer.replaceChild(botMsg, botTyping);

    for await (const part of response) {
      if (part?.text) {
        fullReply += part.text;
        // Sanitize the content before displaying
        botMsg.innerHTML = sanitizeHTML(marked.parse(fullReply));
        hljs.highlightAll();

        // Make code blocks and tables copyable
        makeAllCopyable();

        // Scroll to bottom after each update to ensure visibility
        scrollToBottom();
      }
    }

    // Save bot message to history
    chatHistory.push({
      sender: "bot",
      content: fullReply,
      timestamp: new Date().toISOString(),
    });
    saveChatHistory();

    // Final scroll to ensure the complete message is visible
    setTimeout(() => {
      smoothScrollToBottom();
    }, 100);
  } catch (err) {
    botTyping.innerHTML = `<b>Error:</b> ${err.message}`;

    // Save error message to history
    chatHistory.push({
      sender: "bot",
      content: `<b>Error:</b> ${err.message}`,
      timestamp: new Date().toISOString(),
    });
    saveChatHistory();

    scrollToBottom();
  }
}

// Add Enter key support for sending messages
userInput.addEventListener("keypress", function (event) {
  if (event.key === "Enter") {
    handleSend();
  }
});

// Ensure scroll to bottom when input is focused (for mobile)
userInput.addEventListener("focus", function () {
  setTimeout(() => {
    scrollToBottom();
  }, 100);
});

// Handle window resize to ensure proper scrolling
window.addEventListener("resize", function () {
  setTimeout(() => {
    scrollToBottom();
  }, 100);
});
