import { Persona } from '../types';
import { translations } from '../localization/translations';
import type { Chat } from '@google/genai'; // Keep the type for ChatView compatibility

// ====================================================================================
// ВАЖНО: Замените 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE' на URL вашего развернутого Google Apps Script.
// Подробную инструкцию см. в файле README.md
//
// IMPORTANT: Replace 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE' with the URL of your deployed Google Apps Script.
// See README.md for detailed instructions.
const GOOGLE_SCRIPT_URL: string = 'https://script.google.com/macros/s/AKfycbxWj7qEaAmwpy9py2AcufdIlpBrHWWJQMw2SmqLGNIYw0S-blXQN2uqxT0MpwADUA-iwQ/exec';
// ====================================================================================


/**
 * Эта функция теперь является заглушкой. Она больше не создает реальный чат-сеанс,
 * так как вся логика теперь находится на стороне сервера в Google Apps Script.
 * Она возвращает пустой объект, чтобы соответствовать типу и минимизировать изменения в ChatView.
 */
export const startChat = (persona: Persona, language:string): Chat | null => {
  // Return a dummy object to satisfy the type, as we no longer manage state on the client.
  return {} as Chat;
};

/**
 * Отправляет сообщение на прокси-сервер Google Apps Script.
 * @param persona - Текущий выбранный персонаж.
 * @param language - Текущий выбранный язык.
 * @param message - Сообщение пользователя.
 * @returns {Promise<string>} - Ответ от AI или подробное сообщение об ошибке.
 */
export const sendMessage = async (persona: Persona, language: string, message: string): Promise<string> => {
  const t = translations[language as keyof typeof translations] || translations['en'];

  if (GOOGLE_SCRIPT_URL === 'ВАШ_URL_ВЕБ_ПРИЛОЖЕНИЯ_ЗДЕСЬ' || !GOOGLE_SCRIPT_URL.includes('/exec')) {
     const errorMsg = GOOGLE_SCRIPT_URL.includes('script.google.com') && !GOOGLE_SCRIPT_URL.includes('/exec') 
       ? t.configErrorUrl as string
       : t.configError as string;
    console.error(errorMsg);
    return errorMsg;
  }


  try {
    const systemInstruction = (t[persona.systemPromptKey] || translations['en'][persona.systemPromptKey]) as string;

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', 
      },
      body: JSON.stringify({
        message: message,
        systemInstruction: systemInstruction,
      }),
      redirect: 'follow',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error from Google Apps Script Backend:", { status: response.status, body: errorText });
      if(response.status === 0 || response.type === 'opaque'){
         return t.networkError as string;
      }
      return `${t.backendError as string} (Status: ${response.status}). ${t.backendErrorCheckLogs as string}`;
    }

    const result = await response.json();
    
    if (result.error) {
      const errorMessage = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
      console.error("Application error from Google Apps Script:", errorMessage);
      return `${t.backendError as string}: ${errorMessage}.`;
    }

    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof text !== 'string') {
        console.error("Invalid response structure from backend:", result);
        return t.unexpectedResponse as string;
    }

    return text;
  } catch (error) {
    console.error("Error sending message via Google Apps Script proxy:", error);
    if (error instanceof TypeError) {
        return t.networkError as string;
    }
    return t.connectionError as string;
  }
};

/**
 * Отправляет анонимный лог о посещении приложения на бэкенд Google Apps Script.
 * Эта функция "fire-and-forget" - она не блокирует UI и не показывает ошибки пользователю.
 */
export const logAppVisit = async (): Promise<void> => {
  if (GOOGLE_SCRIPT_URL === 'ВАШ_URL_ВЕБ_ПРИЛОЖЕНИЯ_ЗДЕСЬ' || !GOOGLE_SCRIPT_URL.includes('/exec')) {
    console.log("Visit logging disabled: Google Apps Script URL is not set correctly.");
    return;
  }

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'logVisit',
        userAgent: navigator.userAgent,
        language: navigator.language,
        referrer: document.referrer,
      }),
      redirect: 'follow',
    });
    // Мы не ждем и не анализируем ответ, чтобы не замедлять работу приложения.
  } catch (error) {
    // Ошибки логирования не должны влиять на пользователя, просто выводим их в консоль.
    console.error("Error logging app visit:", error);
  }
};