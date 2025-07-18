# Free AI Chatbot Trained on Your Google Drive Documents

[![YouTube Video Placeholder](http://googleusercontent.com/youtube/3)](http://googleusercontent.com/youtube/com/watch?v=dQw4w9WgXcQ "Watch the Video Tutorial")

This project provides the simplest possible solution to create a powerful, FREE, custom-trained AI chatbot using only **Google Apps Script** and **Google Drive**. It allows you to build a chatbot that answers questions based *exclusively* on your own business documents, without needing complex cloud architectures or vector databases.

---

## Features

* **Custom Knowledge Base**: Train the chatbot by simply adding Google Docs to a specified Google Drive folder.
* **Intelligent Responses**: Uses Google's **Gemini 2.0 Flash** model to understand and answer questions based on the provided documents.
* **Smart Caching**: Uses Google Apps Script's `CacheService` to store document content for up to 6 hours, ensuring fast response times after the initial load.
* **Simple Human Handoff**: If the bot can't answer a question or the user asks for a person, it will request contact information and forward the conversation transcript to a designated Google Chat space.
* **Responsive Web Interface**: A clean, modern chat widget built with HTML and Tailwind CSS that can be embedded on any website.

---

## How It Works

This chatbot leverages a simplified **Retrieval-Augmented Generation (RAG)** architecture built entirely within the Google ecosystem.

1.  **Knowledge Base**: A Google Drive folder acts as the knowledge base. All Google Docs within this folder are considered the source of truth.
2.  **Context Injection**: Instead of a complex vector search, the script reads the *entire content* of all documents (exported as Markdown to preserve formatting) and injects it into the AI's system prompt on every query.
3.  **Massive Context Window**: This is made possible by the **Google Gemini 2.0 Flash** model, which supports a 1 million token context window, allowing us to feed it a large amount of text in a single call.
4.  **Backend Logic**: A single **Google Apps Script** file (`Code.gs`) handles fetching documents, caching content, processing user input, and making API calls to the Gemini API.
5.  **Frontend Interface**: An HTML file (`index.html`) serves a modern chat UI, which communicates with the backend Apps Script functions.

---

## Technology Stack

* **Backend**: Google Apps Script
* **Frontend**: HTML, Tailwind CSS, JavaScript
* **AI Model**: Google Gemini 2.0 Flash API
* **Database**: Google Drive (for document storage)
* **Caching**: Google Apps Script `CacheService`
* **Notifications**: Google Chat Webhooks (for human handoff)

---

## 🚀 Setup in 5 Minutes

Here's a quick guide to get your chatbot running. For a detailed walkthrough, please refer to our **[full blog post tutorial](https://your-blog-post-link-here.com)**.

1.  **Prepare Google Drive**:
    * Create a new folder in Google Drive to serve as your knowledge base.
    * Add one or more Google Docs with the information you want the chatbot to know.
    * Copy the **Folder ID** from the URL.

2.  **Create the Apps Script Project**:
    * In Google Drive, go to `New > More > Google Apps Script`.
    * Name the project (e.g., "AI Chatbot").
    * Copy the content from `Code.gs` and `index.html` in this repository into the corresponding files in your Apps Script project.

3.  **Configure the Script (`Code.gs`)**:
    * Paste your **Google Drive Folder ID** into the `DRIVE_FOLDER_ID` variable.
    * Get a **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/) and paste it into the `GEMINI_API_KEY` variable.
    * (Optional) If you have a Google Workspace account, set up a webhook in a Google Chat space and paste the URL into the `GOOGLE_CHAT_WEBHOOK_URL` variable for human handoff.

4.  **Customize the System Prompt**:
    * In `Code.gs`, find the `systemInstructionText` variable.
    * Modify the prompt to define your chatbot's personality, brand name, and specific rules.

5.  **Deploy the Web App**:
    * Click the **Deploy** button > **New deployment**.
    * Select `Web app` as the type.
    * Set **"Who has access"** to **"Anyone"**.
    * Click **Deploy**, authorize the permissions (you may need to click "Advanced" and "Go to... (unsafe)"), and you're done! Copy the provided Web App URL to access your chatbot.

---

## Limitations

This solution is designed for simplicity and is ideal for small to medium-sized businesses or internal tools. However, it has some limitations compared to a full-scale RAG implementation:

* **Scalability**: The "read everything" approach works well for dozens of documents but will not scale to thousands. A proper RAG system with a vector database is better for massive knowledge bases.
* **No "Smart" Retrieval**: The bot receives the entire context every time, which is less precise than a semantic search that finds only the most relevant text snippets.
* **Basic Handoff**: The handoff system is a simple notification and does not include features of a professional live chat platform like agent queuing.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
