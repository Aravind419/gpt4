const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");

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

  const userMsg = createMessageElement("user");
  userMsg.innerText = input;
  userInput.value = "";

  const botMsg = createMessageElement("bot");

  try {
    const response = await puter.ai.chat(input, { stream: true });
    let fullReply = "";

    for await (const part of response) {
      if (part?.text) {
        fullReply += part.text;
        botMsg.innerHTML = marked.parse(fullReply);
        hljs.highlightAll();
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }
  } catch (err) {
    botMsg.innerHTML = `<b>Error:</b> ${err.message}`;
  }
}

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSend();
});
