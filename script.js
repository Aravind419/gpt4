const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");

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

// Initialize theme and load chat history on page load
document.addEventListener("DOMContentLoaded", function () {
  loadTheme();
  loadChatHistory();

  // Restore chat history to UI
  if (chatHistory.length > 0) {
    chatHistory.forEach((message) => {
      const messageElement = createMessageElement(message.sender);
      messageElement.innerHTML = message.content;
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
    const response = await puter.ai.chat(input, { stream: true });

    // Replace typing indicator with actual bot message container
    const botMsg = document.createElement("div");
    botMsg.classList.add("message", "bot");
    botMsg.innerHTML = "";
    chatContainer.replaceChild(botMsg, botTyping);

    for await (const part of response) {
      if (part?.text) {
        fullReply += part.text;
        botMsg.innerHTML = marked.parse(fullReply);
        hljs.highlightAll();

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
