const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");

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
    localStorage.setItem("theme", "light");
  } else {
    body.classList.add("dark-theme");
    icon.textContent = "☀️";
    text.textContent = "Light";
    localStorage.setItem("theme", "dark");
  }
}

// Load saved theme on page load
function loadTheme() {
  const savedTheme = localStorage.getItem("theme");
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

// Initialize theme on page load
document.addEventListener("DOMContentLoaded", loadTheme);

function createMessageElement(sender) {
  const div = document.createElement("div");
  div.classList.add("message", sender);
  div.innerHTML = "";
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return div;
}

async function handleSend() {
  const input = userInput.value.trim();
  if (!input) return;

  // Create user message
  const userMsg = createMessageElement("user");
  userMsg.innerText = input;
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
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }
  } catch (err) {
    botTyping.innerHTML = `<b>Error:</b> ${err.message}`;
  }
}

// Add Enter key support for sending messages
userInput.addEventListener("keypress", function (event) {
  if (event.key === "Enter") {
    handleSend();
  }
});
