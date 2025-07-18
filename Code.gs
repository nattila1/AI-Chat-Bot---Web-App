/**
 * The ID of the Google Drive folder containing your knowledge base documents.
 * IMPORTANT: Replace "YOUR_DRIVE_FOLDER_ID_HERE" with your actual folder ID.
 */
const DRIVE_FOLDER_ID = "YOUR_DRIVE_FOLDER_ID_HERE";

/**
 * The duration for which the fetched document context will be cached, in seconds.
 * 6 hours = 6 * 60 * 60 = 21600 seconds.
 */
const CACHE_EXPIRATION_IN_SECONDS = 21600;

/**
 * The incoming webhook URL for the Google Chat space where human handoff
 * notifications will be sent.
 * IMPORTANT: Replace with your actual Google Chat webhook URL.
 */
const GOOGLE_CHAT_WEBHOOK_URL = 'YOUR_GOOGLE_CHAT_WEBHOOK_URL_HERE';

/**
 * Your API key for the Google AI Studio (Gemini) API.
 * IMPORTANT: Replace with your actual Gemini API key.
 */
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';


/**
 * Serves the HTML for the web app.
 * This is the main entry point when a user visits the web app URL.
 */
function doGet() {
  // This function runs when someone visits the app's URL.
  // It creates an HTML page from the 'Index.html' file.
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Gemini Chatbot')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Fetches and caches the Markdown content of all Google Docs from the specified Drive folder.
 */
function getContextFromDrive() {
  // Use Apps Script's caching service to temporarily store the document contents.
  // This avoids repeatedly fetching from Drive, which is slow.
  const cache = CacheService.getScriptCache();
  const cachedContext = cache.get('drive_context');

  // If we find the context in the cache, return it immediately.
  if (cachedContext != null) {
    console.log("Returning context from cache.");
    return cachedContext;
  }

  console.log("Cache is empty. Fetching context from Google Drive using Drive API export.");
  try {
    // Check if the folder ID has been set.
    if (!DRIVE_FOLDER_ID || DRIVE_FOLDER_ID === "YOUR_DRIVE_FOLDER_ID_HERE") {
       console.warn("DRIVE_FOLDER_ID is not set. Skipping context fetch.");
       return "No context provided as the Drive Folder ID is not configured.";
    }
    
    // Get the folder and all Google Docs within it.
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const files = folder.getFilesByType(MimeType.GOOGLE_DOCS);
    let context = "";
    // Get an authorization token to make direct API calls to Google's services.
    const oauthToken = ScriptApp.getOAuthToken();

    // Loop through each file found in the Drive folder.
    while (files.hasNext()) {
      const file = files.next();
      const fileId = file.getId();
      // Construct a URL to the Drive API to export the file as Markdown.
      const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/markdown`;
      
      // Prepare the request with the authorization header.
      const params = {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${oauthToken}`
        },
        muteHttpExceptions: true
      };
      
      // Fetch the content of the document using the Drive API.
      const response = UrlFetchApp.fetch(exportUrl, params);
      
      // If the export was successful, add the content to our context string.
      if (response.getResponseCode() === 200) {
        context += `\n\n--- Document: ${file.getName()} ---\n`;
        context += response.getContentText();
      } else {
        console.warn(`Could not export document "${file.getName()}" (ID: ${fileId}). Status: ${response.getResponseCode()}`);
      }
    }
    
    // If we successfully gathered context, store it in the cache for next time.
    if (context) {
        console.log(`Successfully fetched and cached ${context.length} characters of context.`);
        cache.put('drive_context', context, CACHE_EXPIRATION_IN_SECONDS);
    } else {
        console.log("No Google Docs found or could be exported from the specified folder.");
        context = "No documents found in the knowledge base.";
    }
    
    return context;
  } catch (e) {
    console.error(`Failed to fetch from Drive: ${e.toString()}`);
    return `Error fetching documents: ${e.message}`;
  }
}


/**
 * Forwards the conversation history to a Google Chat room via a webhook.
 */
function forwardToHuman(history) {

  if (!GOOGLE_CHAT_WEBHOOK_URL || GOOGLE_CHAT_WEBHOOK_URL === "YOUR_GOOGLE_CHAT_WEBHOOK_URL_HERE") {
    console.error("Google Chat Webhook URL is not set in Script Properties.");
    return { text: "I'd like to connect you to a human, but the system isn't configured for it. Please contact support directly.", action: "INITIATE_HANDOFF" };
  }

  // Format the conversation history into a readable message.
  let messageText = "*User Handoff Request (Contact Info Provided)*\n\n*Conversation History:*\n";
  history.forEach(turn => {
    if (turn.role === 'user' || turn.role === 'model') {
       messageText += `*${turn.role.charAt(0).toUpperCase() + turn.role.slice(1)}:* ${turn.parts[0].text}\n`;
    }
  });

  // Prepare the message payload for the Google Chat webhook.
  const payload = { 'text': messageText };
  const options = {
    'method': 'post',
    'contentType': 'application/json; charset=UTF-8',
    'payload': JSON.stringify(payload)
  };

  try {
    // Send the message to the specified Google Chat room.
    UrlFetchApp.fetch(GOOGLE_CHAT_WEBHOOK_URL, options);
    return { action: "INITIATE_HANDOFF" };
  } catch (e) {
    console.error(`Failed to send notification to Google Chat: ${e.toString()}`);
    return { text: "I tried to connect you to a human, but there was a technical error. Please try again later.", action: "RESPOND" };
  }
}


/**
 * Fetches a structured response from the Gemini API, using context from Google Drive.
 */
function getGeminiResponse(userInput, history) {
  // Implements a simple rate limit to prevent a single user from spamming the bot.
  const rateLimitCache = CacheService.getUserCache();
  // Gets a unique, temporary ID for each user, even if they aren't logged in.
  const userKey = Session.getTemporaryActiveUserKey();
  const rateLimitKey = `rate_limit_${userKey}`;

  // If this user has made a request in the last 5 seconds, block them.
  if (rateLimitCache.get(rateLimitKey)) {
    console.warn(`Rate limit exceeded for user key: ${userKey}`);
    return { error: "You are sending requests too quickly. Please wait a moment and try again." };
  }
  
  // Set a new rate limit for this user for the next 5 seconds.
  rateLimitCache.put(rateLimitKey, 'true', 5);
  
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    return { error: "API key is not set. Please configure it in Script Properties." };
  }

  const GEMINI_MODEL = 'gemini-2.0-flash';
  // Get the knowledge base content from Drive (or cache).
  const driveContext = getContextFromDrive();

  // This is the detailed instruction manual for the AI.
  const systemInstructionText = `You are a sophisticated customer support assistant for YOUR_BRAND. Your primary role is to be a helpful and knowledgeable expert on the company's personal loan products.

  ##Your Core Instructions:
  - **Your Knowledge Source:** Your entire knowledge base is strictly limited to the information contained in the --- DOCUMENT CONTEXT --- section below. You must act as the direct authority on this information.
  - **Crucial Rule:** You must never refer to your information source. Do not use phrases like "based on the document," "the provided context says," or "I don't have that information in my documents." Speak as if you know the information yourself.
  - **Output Format:** You MUST strictly respond only with a JSON object containing two properties: a string response and a string action.

  ##Your Core Tasks:
  1. **Answer Questions About The Context:** When a user asks a general question about personal loans, formulate your answer using only the information provided in the DOCUMENT CONTEXT below. Set the action to RESPOND.
  2. **Perform Loan Calculations:** When a user asks for a loan calculation (e.g., "How much would a loan of £5,000 over 3 years cost me?"), you MUST perform the calculation.
  - Identify Inputs. Identify the principal loan amount (P) and the loan term in years from the user's request. Important to make sure that the imput matches with the alowed minimum or maximum loan term specified in the --- DOCUMENT CONTEXT --- section below.
  - Get the Interest Rate. Use the default APR value specified in the DOCUMENT CONTEXT.
  - se the Formula. You MUST use the following standard loan amortization formula to calculate the monthly payment (M): $M = P \frac{r(1+r)^n}{(1+r)^n - 1}$.
  Where
    - P = The principal loan amount.
    - r = The monthly interest rate. You must calculate this by taking the annual default APR, converting it to a decimal (divide by 100), and then dividing the result by 12.
    - n = The total number of payments (months). You must calculate this by taking the loan term in years and multiplying it by 12.
  - Calculate Total Repayable. After finding the monthly payment (M), calculate the total amount repayable by multiplying M by n.
  - Formulate a clear, user-friendly sentence that only states the final results: the APR level was used, the estimated monthly repayment and the total amount repayable. Do not show the intermediate steps or the formula in your response. Set the action to RESPOND. Empasise that you can provide only estimations, the interest rate we offer depends on users personal circumstances. 
  3. **Handle Handoffs:** 
  - If the user asks to speak to a human, is frustrated, or asks a question not covered by the DOCUMENT CONTEXT, initiate a handoff.
  - First, ask the user for for contact information (email or phone number). Set the action to ASK_FOR_CONTACT.
  - If contact information is present in conversation history, confirm that you have forwarded the request to a human agent. Set the action to INITIATE_HANDOFF.

  --- DOCUMENT CONTEXT ---
  ${driveContext} 
  --- END OF CONTEXT ---`;

  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  
  // Prepare the full conversation history for the API call.
  const contents = [
    // 1. Start with the system prompt to set the rules.
    { role: "user", parts: [{ text: systemInstructionText }] },
    // 2. Add a fake model response to "prime" the AI to follow instructions.
    { role: "model", parts: [{ text: "OK. I will follow these instructions, prioritize the provided document context, and always respond in the specified JSON format." }] },
    // 3. Add the actual user conversation history.
    ...history
  ];

  // Prepare the final payload for the Gemini API.
  const payload = {
    contents: contents,
    generationConfig: {
      // Force the model to output its response as a JSON object.
      "response_mime_type": "application/json",
    }
  };

  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };

  try {
    // Call the Gemini API.
    const response = UrlFetchApp.fetch(API_URL, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode === 200) {
      // Parse the outer API response.
      const data = JSON.parse(responseBody);
      // Parse the inner JSON that the model generated.
      const botResponse = JSON.parse(data.candidates[0].content.parts[0].text);

      // If the bot decided a handoff is needed, call the function to send the alert.
      if (botResponse.action === 'INITIATE_HANDOFF') {
        forwardToHuman(history);
        return { text: botResponse.response, action: 'INITIATE_HANDOFF' };
      } else {
        return { text: botResponse.response, action: botResponse.action };
      }
    } else {
      console.error(`API Error: ${responseCode} ${responseBody}`);
      return { error: `API returned status ${responseCode}. Check logs for details.` };
    }
  } catch (e) {
    console.error(`Network or other error: ${e.toString()}`);
    return { error: `Failed to call Gemini API: ${e.toString()}` };
  }
}