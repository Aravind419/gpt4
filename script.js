const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const modelSelector = document.getElementById("model-selector");
const imagePreviewContainer = document.getElementById("image-preview-container");
const conversationsList = document.getElementById("conversations-list");
const sidebar = document.getElementById("sidebar");
const sendBtn = document.querySelector(".send-btn");

// Track if model is responding
let isModelResponding = false;

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
const STORAGE_KEY = "puter_conversations";
const THEME_KEY = "puter_chat_theme";
const CURRENT_CONVERSATION_KEY = "puter_current_conversation";
const MODEL_KEY = "puter_selected_model";

// Current conversation and data
let conversations = {};
let currentConversationId = null;
let uploadedImages = [];
let selectedModel = "gpt-5";

// Voice functionality
let recognition = null;
let isRecording = false;

// Theme toggle functionality
function toggleTheme() {
  const body = document.body;
  const themeToggle = document.querySelector(".theme-toggle");
  const icon = themeToggle.querySelector(".icon");
  const text = themeToggle.querySelector(".text");

  if (body.classList.contains("dark-theme")) {
    body.classList.remove("dark-theme");
    icon.className = "fas fa-moon icon";
    text.textContent = "Dark";
    localStorage.setItem(THEME_KEY, "light");
  } else {
    body.classList.add("dark-theme");
    icon.className = "fas fa-sun icon";
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
    icon.className = "fas fa-sun icon";
    text.textContent = "Light";
  }
}

// Initialize speech recognition
function initSpeechRecognition() {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = function() {
      isRecording = true;
      const btn = document.getElementById('voice-input-btn');
      btn.classList.add('recording');
      btn.querySelector('i').className = 'fas fa-stop';
      showNotification('🎤 Listening...');
    };

    recognition.onresult = function(event) {
      const transcript = event.results[0][0].transcript;
      userInput.value = transcript;
      userInput.focus();
    };

    recognition.onerror = function(event) {
      console.error('Speech recognition error:', event.error);
      stopVoiceInput();
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        showNotification('❌ Voice input error: ' + event.error);
      }
    };

    recognition.onend = function() {
      stopVoiceInput();
    };
  } else {
    console.warn('Speech recognition not supported');
  }
}

// Toggle voice input
function toggleVoiceInput() {
  if (!recognition) {
    showNotification('❌ Voice input not supported in this browser');
    return;
  }

  if (isRecording) {
    recognition.stop();
  } else {
    recognition.start();
  }
}

// Stop voice input
function stopVoiceInput() {
  isRecording = false;
  const btn = document.getElementById('voice-input-btn');
  btn.classList.remove('recording');
  btn.querySelector('i').className = 'fas fa-microphone';
}


// Generate unique ID for conversations
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Save conversations to local storage
function saveConversations() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    if (currentConversationId) {
      localStorage.setItem(CURRENT_CONVERSATION_KEY, currentConversationId);
    }
  } catch (error) {
    console.warn("Failed to save conversations:", error);
  }
}

// Load conversations from local storage
function loadConversations() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      conversations = JSON.parse(saved);
      currentConversationId = localStorage.getItem(CURRENT_CONVERSATION_KEY);
      
      // If no conversations exist, create a new one
      if (Object.keys(conversations).length === 0) {
        createNewChat();
      } else if (!currentConversationId || !conversations[currentConversationId]) {
        // If current conversation doesn't exist, use the first one
        currentConversationId = Object.keys(conversations)[0];
      }
      
      return true;
    } else {
      // Create first conversation
      createNewChat();
    }
  } catch (error) {
    console.warn("Failed to load conversations:", error);
    createNewChat();
  }
  return false;
}

// Get current conversation
function getCurrentConversation() {
  if (!currentConversationId || !conversations[currentConversationId]) {
    return { messages: [], title: "New Chat" };
  }
  return conversations[currentConversationId];
}

// Save selected model
function saveSelectedModel() {
  try {
    localStorage.setItem(MODEL_KEY, selectedModel);
  } catch (error) {
    console.warn("Failed to save model:", error);
  }
}

// Load selected model
function loadSelectedModel() {
  try {
    const saved = localStorage.getItem(MODEL_KEY);
    if (saved) {
      selectedModel = saved;
      modelSelector.value = selectedModel;
    }
  } catch (error) {
    console.warn("Failed to load model:", error);
  }
}

// Create new chat
function createNewChat() {
  const id = generateId();
  conversations[id] = {
    id: id,
    title: "New Chat",
    messages: [],
    createdAt: new Date().toISOString(),
    model: selectedModel
  };
  currentConversationId = id;
  chatContainer.innerHTML = "";
  uploadedImages = [];
  clearImagePreviews();
  saveConversations();
  renderConversationsList();
  
  // Close sidebar on mobile after creating new chat
  closeSidebarOnMobile();
  
  return id;
}

// Switch to a conversation
function switchToConversation(conversationId) {
  if (!conversations[conversationId]) return;
  
  currentConversationId = conversationId;
  chatContainer.innerHTML = "";
  uploadedImages = [];
  clearImagePreviews();
  
  const conversation = conversations[conversationId];
  
  // Render all messages
  conversation.messages.forEach((message) => {
    try {
      const messageElement = createMessageElement(message.sender);
      
      // Display images if any
      if (message.images && message.images.length > 0) {
        const imagesContainer = document.createElement("div");
        imagesContainer.className = "message-images-container";
        message.images.forEach(imgSrc => {
          const imageWrapper = createImageWithDownload(imgSrc);
          imagesContainer.appendChild(imageWrapper);
        });
        messageElement.appendChild(imagesContainer);
      }

      if (message.sender === "bot") {
        const parsedContent = marked.parse(message.content);
        const contentDiv = document.createElement("div");
        contentDiv.innerHTML = sanitizeHTML(parsedContent);
        messageElement.appendChild(contentDiv);
        
        setTimeout(() => {
          const codeBlocks = messageElement.querySelectorAll("pre code");
          codeBlocks.forEach((block) => {
            // Skip if already highlighted
            if (block.classList.contains('hljs') && block.classList.contains('highlighted')) {
              return;
            }
            block.classList.add('highlighted');
            try {
              hljs.highlightElement(block);
            } catch (err) {
              console.warn('Syntax highlighting error:', err);
            }
          });
          
          // Format tables
          wrapTablesInScrollable();
          
          // Make code blocks and tables copyable
          makeAllCopyable();
        }, 10);
      } else {
        const textDiv = document.createElement("div");
        textDiv.innerText = message.content;
        messageElement.appendChild(textDiv);
      }
    } catch (error) {
      console.warn("Error loading message:", error);
    }
  });
  
  saveConversations();
  renderConversationsList();
  scrollToBottom();
  
  // Close sidebar on mobile after switching conversation
  closeSidebarOnMobile();
}

// Delete a conversation
function deleteConversation(conversationId, event) {
  event.stopPropagation();
  
  if (confirm("Are you sure you want to delete this conversation?")) {
    delete conversations[conversationId];
    
    // If we deleted the current conversation, switch to another or create new
    if (currentConversationId === conversationId) {
      const remainingIds = Object.keys(conversations);
      if (remainingIds.length > 0) {
        switchToConversation(remainingIds[0]);
      } else {
        createNewChat();
      }
    }
    
    saveConversations();
    renderConversationsList();
  }
}

// Render conversations list in sidebar
function renderConversationsList() {
  conversationsList.innerHTML = "";
  
  const sortedConversations = Object.values(conversations).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  
  sortedConversations.forEach(conv => {
    const item = document.createElement("div");
    item.className = "conversation-item";
    if (conv.id === currentConversationId) {
      item.classList.add("active");
    }
    
    const title = document.createElement("div");
    title.className = "conversation-title";
    title.textContent = conv.title;
    
    // Make title editable on double-click
    title.ondblclick = (e) => {
      e.stopPropagation();
      makeConversationTitleEditable(conv.id, title);
    };
    
    // Add edit icon that appears on hover
    const editBtn = document.createElement("button");
    editBtn.className = "conversation-edit";
    editBtn.innerHTML = '<i class="fas fa-edit"></i>';
    editBtn.title = "Edit title";
    editBtn.onclick = (e) => {
      e.stopPropagation();
      makeConversationTitleEditable(conv.id, title);
    };
    
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "conversation-delete";
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.title = "Delete conversation";
    deleteBtn.onclick = (e) => deleteConversation(conv.id, e);
    
    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "conversation-buttons";
    buttonsContainer.appendChild(editBtn);
    buttonsContainer.appendChild(deleteBtn);
    
    item.appendChild(title);
    item.appendChild(buttonsContainer);
    item.onclick = () => switchToConversation(conv.id);
    
    conversationsList.appendChild(item);
  });
}

// Clear chat function
function clearChat() {
  if (
    confirm(
      "Are you sure you want to clear this conversation? This action cannot be undone."
    )
  ) {
    const conversation = getCurrentConversation();
    conversation.messages = [];
    chatContainer.innerHTML = "";
    uploadedImages = [];
    clearImagePreviews();
    saveConversations();

    // Show confirmation message
    const confirmation = createMessageElement("bot");
    const contentDiv = document.createElement("div");
    contentDiv.innerHTML = '<i class="fas fa-check"></i> Conversation cleared successfully!';
    contentDiv.style.opacity = "0.7";
    contentDiv.style.fontStyle = "italic";
    confirmation.appendChild(contentDiv);

    // Remove confirmation message after 3 seconds
    setTimeout(() => {
      if (confirmation.parentNode) {
        confirmation.remove();
      }
    }, 3000);
  }
}

// Toggle sidebar
function toggleSidebar() {
  sidebar.classList.toggle("hidden");
}

// Close sidebar on mobile devices
function closeSidebarOnMobile() {
  if (window.innerWidth <= 768) {
    sidebar.classList.add("hidden");
  }
}

// Setup click outside to close sidebar on mobile
function setupClickOutsideHandler() {
  document.addEventListener('click', function(event) {
    // Only on mobile devices
    if (window.innerWidth > 768) return;
    
    // Check if sidebar is open
    if (sidebar.classList.contains('hidden')) return;
    
    // Check if click is outside sidebar
    if (!sidebar.contains(event.target) && !event.target.closest('.toggle-sidebar-btn')) {
      sidebar.classList.add('hidden');
    }
  });
}

// Setup hover to show sidebar on desktop
function setupSidebarHoverHandler() {
  let hoverTimeout;
  const hoverZoneWidth = 20; // pixels from left edge to trigger
  
  document.addEventListener('mousemove', function(event) {
    // Only on desktop devices
    if (window.innerWidth <= 768) return;
    
    // Check if mouse is near left edge
    if (event.clientX <= hoverZoneWidth) {
      // Clear any pending hide timeout
      clearTimeout(hoverTimeout);
      
      // Show sidebar
      if (sidebar.classList.contains('hidden')) {
        sidebar.classList.remove('hidden');
        sidebar.classList.add('hover-open');
      }
    } else if (!sidebar.contains(event.target)) {
      // Mouse moved away from sidebar and hover zone
      if (sidebar.classList.contains('hover-open')) {
        // Delay hiding to prevent flickering
        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
          sidebar.classList.add('hidden');
          sidebar.classList.remove('hover-open');
        }, 300);
      }
    }
  });
  
  // Keep sidebar open when hovering over it
  sidebar.addEventListener('mouseenter', function() {
    clearTimeout(hoverTimeout);
  });
  
  // Start hide timer when leaving sidebar
  sidebar.addEventListener('mouseleave', function(event) {
    if (window.innerWidth <= 768) return;
    
    if (sidebar.classList.contains('hover-open')) {
      hoverTimeout = setTimeout(() => {
        sidebar.classList.add('hidden');
        sidebar.classList.remove('hover-open');
      }, 300);
    }
  });
  
  // Don't hide if clicking inside sidebar
  sidebar.addEventListener('click', function(event) {
    clearTimeout(hoverTimeout);
  });
}

// Model selector change handler
modelSelector.addEventListener("change", function() {
  selectedModel = this.value;
  saveSelectedModel();
});

// Download image function
async function downloadImage(imageSrc, filename) {
  try {
    // If it's a base64 data URL, convert to blob
    if (imageSrc.startsWith('data:')) {
      const response = await fetch(imageSrc);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showNotification('<i class="fas fa-check"></i> Image downloaded');
    } else {
      // For external URLs, use fetch
      try {
        const response = await fetch(imageSrc);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        try {
          const urlObj = new URL(imageSrc);
          const pathname = urlObj.pathname;
          const extension = pathname.substring(pathname.lastIndexOf('.')) || '.png';
          a.download = filename || `image-${Date.now()}${extension}`;
        } catch {
          a.download = filename || `image-${Date.now()}.png`;
        }
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showNotification('<i class="fas fa-check"></i> Image downloaded');
      } catch (err) {
        // Fallback: open in new tab
        window.open(imageSrc, '_blank');
        showNotification('<i class="fas fa-info-circle"></i> Cannot download external image. Opened in new tab.');
      }
    }
  } catch (error) {
    console.error('Error downloading image:', error);
    showNotification('<i class="fas fa-exclamation-circle"></i> Error downloading image');
  }
}

// Create image with wrapper and download button
function createImageWithDownload(imgSrc) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message-image-wrapper';
  
  const img = document.createElement('img');
  img.src = imgSrc;
  img.className = 'message-image';
  img.onclick = () => window.open(imgSrc, '_blank');
  img.loading = 'lazy';
  
  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'image-download-btn';
  downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
  downloadBtn.title = 'Download image';
  downloadBtn.onclick = (e) => {
    e.stopPropagation();
    const filename = `image-${Date.now()}.png`;
    downloadImage(imgSrc, filename);
  };
  
  wrapper.appendChild(img);
  wrapper.appendChild(downloadBtn);
  
  return wrapper;
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

// Wrap tables in scrollable containers
function wrapTablesInScrollable() {
  const tables = document.querySelectorAll(".bot table");
  tables.forEach((table) => {
    // Skip if already wrapped
    if (table.parentElement && table.parentElement.classList.contains("table-wrapper")) {
      return;
    }

    // Create wrapper
    const wrapper = document.createElement("div");
    wrapper.className = "table-wrapper";
    
    // Move table into wrapper
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}

// Function to create copyable tables
function makeTablesCopyable() {
  const tables = document.querySelectorAll(".bot table");
  tables.forEach((table, index) => {
    // Skip if already has copy button
    if (table.querySelector(".table-copy-button")) {
      return;
    }

    // Create copy button for table
    const copyButton = document.createElement("button");
    copyButton.className = "table-copy-button";
    copyButton.innerHTML = '<i class="fas fa-copy"></i>';
    copyButton.title = "Copy table";
    copyButton.setAttribute("data-table-index", index);

    // Add click event to copy table
    copyButton.addEventListener("click", async function () {
      try {
        const tableText = convertTableToText(table);
        await navigator.clipboard.writeText(tableText);

        // Show success feedback
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = '<i class="fas fa-check"></i>';
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
        copyButton.innerHTML = '<i class="fas fa-check"></i>';
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
  wrapTablesInScrollable();
  makeCodeBlocksCopyable();
  makeTablesCopyable();
}

// Image upload handling
function handleImageUpload(event) {
  const files = event.target.files;
  processImageFiles(files);
  
  // Clear the input so the same file can be uploaded again if needed
  event.target.value = "";
}

// Process image files (used by both file input and drag & drop)
function processImageFiles(files) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      
      reader.onload = function(e) {
        const imageData = e.target.result;
        uploadedImages.push(imageData);
        renderImagePreviews();
      };
      
      reader.readAsDataURL(file);
    }
  }
}

// Drag and drop functionality
function setupDragAndDrop() {
  const dropZones = [chatContainer, document.querySelector('.input-wrapper')];
  
  dropZones.forEach(zone => {
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      zone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
      zone.addEventListener(eventName, () => {
        zone.classList.add('drag-over');
      }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      zone.addEventListener(eventName, () => {
        zone.classList.remove('drag-over');
      }, false);
    });
    
    // Handle dropped files
    zone.addEventListener('drop', handleDrop, false);
  });
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  
  processImageFiles(files);
  
  // Show a notification
  showNotification('<i class="fas fa-check"></i> Images uploaded successfully!');
}

// Show temporary notification
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.innerHTML = message;
  document.body.appendChild(notification);
  
  // Trigger animation
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // Remove after 2 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 2000);
}

// Render image previews
function renderImagePreviews() {
  imagePreviewContainer.innerHTML = "";
  
  uploadedImages.forEach((imgSrc, index) => {
    const previewItem = document.createElement("div");
    previewItem.className = "image-preview-item";
    
    const img = document.createElement("img");
    img.src = imgSrc;
    
    const removeBtn = document.createElement("button");
    removeBtn.className = "image-preview-remove";
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.onclick = () => removeImage(index);
    
    previewItem.appendChild(img);
    previewItem.appendChild(removeBtn);
    imagePreviewContainer.appendChild(previewItem);
  });
}

// Remove an image from uploaded images
function removeImage(index) {
  uploadedImages.splice(index, 1);
  renderImagePreviews();
}

// Clear image previews
function clearImagePreviews() {
  uploadedImages = [];
  imagePreviewContainer.innerHTML = "";
}

// Update conversation title based on first message (called when user sends)
function updateConversationTitle(conversationId, firstMessage) {
  if (conversations[conversationId] && conversations[conversationId].title === "New Chat") {
    // Take first 40 characters of the message as title
    conversations[conversationId].title = firstMessage.substring(0, 40) + (firstMessage.length > 40 ? "..." : "");
    saveConversations();
    renderConversationsList();
  }
}

// Update conversation title from GPT's response (called when GPT replies)
function updateConversationTitleFromGPT(conversationId, gptResponse) {
  if (conversations[conversationId] && conversations[conversationId].title === "New Chat") {
    // Extract a meaningful title from GPT's response (first sentence or up to 50 chars)
    let title = gptResponse.split(/[.!?]/)[0].trim();
    
    // Remove markdown and special characters
    title = title.replace(/[#*_`\[\]]/g, '').trim();
    
    // Limit length
    if (title.length > 50) {
      title = title.substring(0, 50) + "...";
    }
    
    // Use first meaningful words as title
    if (title.length > 0) {
      conversations[conversationId].title = title;
      saveConversations();
      renderConversationsList();
    }
  }
}

// Make conversation title editable
function makeConversationTitleEditable(conversationId, titleElement) {
  const currentTitle = conversations[conversationId].title;
  
  // Create input element
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'conversation-title-edit';
  input.value = currentTitle;
  
  // Replace title with input
  titleElement.style.display = 'none';
  titleElement.parentElement.insertBefore(input, titleElement);
  input.focus();
  input.select();
  
  // Save on Enter or blur
  function saveTitle() {
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== currentTitle) {
      conversations[conversationId].title = newTitle;
      saveConversations();
      renderConversationsList();
    } else {
      // Revert if empty or unchanged
      titleElement.style.display = '';
      input.remove();
    }
  }
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveTitle();
    } else if (e.key === 'Escape') {
      titleElement.style.display = '';
      input.remove();
    }
  });
  
  input.addEventListener('blur', saveTitle);
}

// Initialize theme and load conversations on page load
document.addEventListener("DOMContentLoaded", function () {
  loadTheme();
  loadSelectedModel();
  loadConversations();
  renderConversationsList();
  
  // Load current conversation
  if (currentConversationId && conversations[currentConversationId]) {
    switchToConversation(currentConversationId);
  }
  // Make sure we start at bottom
  scrollToBottom();
  
  // Setup drag and drop
  setupDragAndDrop();
  
  // Initialize speech recognition
  initSpeechRecognition();
  
  // Setup click outside handler for sidebar
  setupClickOutsideHandler();
  
  // Setup hover handler for sidebar
  setupSidebarHoverHandler();
});

// Prevent page refresh/close without warning if there are conversations
window.addEventListener("beforeunload", function (e) {
  const hasMessages = Object.values(conversations).some(conv => conv.messages.length > 0);
  if (hasMessages) {
    e.preventDefault();
    e.returnValue =
      "You have unsaved conversations. Are you sure you want to leave?";
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
  const hasImages = uploadedImages.length > 0;
  
  if (!input && !hasImages) return;
  if (isModelResponding) return; // Prevent sending while model is responding

  // Disable send button
  isModelResponding = true;
  sendBtn.disabled = true;

  const conversation = getCurrentConversation();
  
  // Create user message
  const userMsg = createMessageElement("user");
  
  // Display images if any
  if (hasImages) {
    const imagesContainer = document.createElement("div");
    imagesContainer.className = "message-images-container";
    uploadedImages.forEach(imgSrc => {
      const imageWrapper = createImageWithDownload(imgSrc);
      imagesContainer.appendChild(imageWrapper);
    });
    userMsg.appendChild(imagesContainer);
  }
  
  // Add text if any
  if (input) {
    const textDiv = document.createElement("div");
    textDiv.innerText = input;
    userMsg.appendChild(textDiv);
  }

  // Save user message to conversation
  const userMessage = {
    sender: "user",
    content: input || "(Image)",
    images: hasImages ? [...uploadedImages] : [],
    timestamp: new Date().toISOString(),
  };
  
  conversation.messages.push(userMessage);
  
  // Update conversation title if it's the first message
  if (conversation.messages.length === 1) {
    updateConversationTitle(currentConversationId, input || "Image analysis");
  }
  
  saveConversations();

  // Clear input and images
  userInput.value = "";
  const currentImages = [...uploadedImages];
  clearImagePreviews();

  // Create typing indicator
  const botTyping = createMessageElement("bot");
  botTyping.classList.add("typing");
  const typingDots = document.createElement("span");
  typingDots.className = "dots";
  typingDots.innerHTML = `<span>.</span><span>.</span><span>.</span>`;
  botTyping.appendChild(typingDots);

  let fullReply = "";

  try {
    // Build conversation context from chat history (limit to last 10 messages)
    let conversationContext = "";
    if (conversation.messages.length > 0) {
      const recentMessages = conversation.messages.slice(-10);
      conversationContext = recentMessages
        .map((msg) => {
          if (msg.sender === "user") {
            return `User: ${msg.content}`;
          } else {
            return `Assistant: ${msg.content}`;
          }
        })
        .join("\n\n");
      conversationContext += "\n\n";
    }

    // Check if user is asking for table data
    let modifiedInput = input;
    if (shouldFormatAsTable(input)) {
      modifiedInput = `${input}\n\nPlease format your response as a markdown table when appropriate.`;
    }

    // Add directive to include reference links
    modifiedInput = `${modifiedInput}\n\nPlease include relevant reference links and sources when providing information, especially for factual data, statistics, research findings, or technical information. Format references as markdown links at the end of your response.`;

    let response;
    
    // If there are images, use image analysis
    if (currentImages.length > 0) {
      // For multiple images, send them all
      if (currentImages.length === 1) {
        response = await puter.ai.chat(
          modifiedInput || "What do you see in this image?",
          currentImages[0],
          { model: selectedModel, stream: true }
        );
      } else {
        // For multiple images, describe them in the prompt
        const imagePrompt = `${modifiedInput || "What do you see in these images?"}\n\nI'm providing ${currentImages.length} images for analysis.`;
        response = await puter.ai.chat(
          imagePrompt,
          currentImages[0], // Puter AI typically analyzes the first image
          { model: selectedModel, stream: true }
        );
      }
    } else {
      // Text-only message
      const fullPrompt = conversationContext + "User: " + modifiedInput + "\n\nAssistant:";
      response = await puter.ai.chat(fullPrompt, { model: selectedModel, stream: true });
    }

    // Replace typing indicator with actual bot message
    const botMsg = document.createElement("div");
    botMsg.classList.add("message", "bot");
    chatContainer.replaceChild(botMsg, botTyping);

    for await (const part of response) {
      if (part?.text) {
        fullReply += part.text;
        const parsedContent = marked.parse(fullReply);
        botMsg.innerHTML = sanitizeHTML(parsedContent);
        
        // Format code blocks with syntax highlighting
        const codeBlocks = botMsg.querySelectorAll('pre code');
        codeBlocks.forEach((block) => {
          // Skip if already highlighted to avoid re-processing
          if (block.classList.contains('hljs') && block.classList.contains('highlighted')) {
            return;
          }
          
          // Mark as processing to prevent duplicate highlighting
          block.classList.add('highlighted');
          
          try {
            // Highlight code with syntax coloring
            hljs.highlightElement(block);
          } catch (err) {
            // If highlighting fails, at least ensure proper formatting
            console.warn('Syntax highlighting error:', err);
          }
        });
        
        // Format tables
        wrapTablesInScrollable();
        
        // Make code blocks and tables copyable
        makeAllCopyable();
        scrollToBottom();
      }
    }

    // Final code formatting after streaming completes
    const codeBlocks = botMsg.querySelectorAll('pre code');
    codeBlocks.forEach((block) => {
      if (!block.classList.contains('highlighted')) {
        block.classList.add('highlighted');
        try {
          hljs.highlightElement(block);
        } catch (err) {
          console.warn('Final syntax highlighting error:', err);
        }
      }
    });
    
    // Final table formatting
    wrapTablesInScrollable();
    
    // Ensure all code and tables are copyable
    makeAllCopyable();

    // Save bot message to conversation
    conversation.messages.push({
      sender: "bot",
      content: fullReply,
      timestamp: new Date().toISOString(),
    });
    
    // Auto-rename conversation if it's still "New Chat"
    if (conversation.title === "New Chat" && fullReply.length > 0) {
      updateConversationTitleFromGPT(currentConversationId, fullReply);
    }
    
    saveConversations();
    renderConversationsList();

    setTimeout(() => {
      smoothScrollToBottom();
    }, 100);
  } catch (err) {
    botTyping.innerHTML = "";
    const errorDiv = document.createElement("div");
    errorDiv.innerHTML = `<b>Error:</b> ${err.message}`;
    botTyping.appendChild(errorDiv);

    // Save error to conversation
    conversation.messages.push({
      sender: "bot",
      content: `<b>Error:</b> ${err.message}`,
      timestamp: new Date().toISOString(),
    });
    saveConversations();

    scrollToBottom();
  } finally {
    // Re-enable send button
    isModelResponding = false;
    sendBtn.disabled = false;
  }
}

// Enter key support for sending messages
userInput.addEventListener("keypress", function (event) {
  if (event.key === "Enter" && !isModelResponding) {
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

