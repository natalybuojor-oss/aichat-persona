# AI Persona Chat - Инструкция по настройке

Это руководство поможет вам шаг за шагом настроить и запустить приложение AI Persona Chat. Процесс включает в себя настройку Google Таблицы для управления доступом, создание Google Apps Script в качестве безопасного сервера и подключение его к React-приложению.

## Архитектура
- **Frontend**: React-приложение, которое вы видите и с которым взаимодействуете. Оно может подключаться только к **одному** URL бэкенда.
- **Backend**: **Один** Google Apps Script, который выступает в роли посредника между вашим приложением и Gemini API, а также управляет рассылкой приглашений ко **всем** вашим документам.
- **База данных**: **Одна** Google Таблица, которая является вашим центром управления для всех рассылок.

---

### Шаг 1: Создание Документов-Шаблонов (для приглашений)

Вы можете создать столько документов-шаблонов, сколько вам нужно.

1.  **Создайте новый Google Документ**: Перейдите на [docs.google.com](https://docs.google.com) и создайте документ.
2.  **Напишите текст приглашения**: Внутри документа напишите приветственный текст и **обязательно вставьте ссылку на ваше веб-приложение**. Например:
    > "Здравствуйте! Вам предоставлен доступ к приложению AI Persona Chat. Нажмите на ссылку, чтобы начать общение: [вставьте сюда URL вашего веб-приложения]"
3.  **Скопируйте ID документа**:
    -   URL-адрес вашего документа будет выглядеть примерно так: `https://docs.google.com/document/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ_12345AbCdEfGhIjK/edit`
    -   **ID документа** - это длинная строка символов между `.../d/` и `/edit...`.
    -   В примере выше ID это: `1aBcDeFgHiJkLmNoPqRsTuVwXyZ_12345AbCdEfGhIjK`.
    -   **Скопируйте и сохраните этот ID**. Повторите это для всех ваших документов-шаблонов.

---

### Шаг 2: Настройка Единой Управляющей Google Таблицы

Эта таблица будет вашим центром управления рассылками и логами посещений.

1.  **Создайте новую Google Таблицу**: Перейдите на [sheets.google.com](https://sheets.google.com) и создайте пустую таблицу.
2.  **Настройте столбцы для приглашений (на первом листе)**:
    -   Переименуйте текущий лист (обычно `Лист1`) в `Invitations`.
    -   В ячейке **A1** напишите `Email`.
    -   В ячейке **B1** напишите `Document_ID`.
    -   В ячейке **C1** напишите `Invited`.
3.  **Создайте лист для логов посещений**:
    -   Нажмите на `+` в левом нижнем углу, чтобы добавить новый лист.
    -   Переименуйте этот новый лист в `Logs`.
    -   В ячейке **A1** на листе `Logs` напишите `Timestamp`.
    -   В ячейке **B1** напишите `UserAgent`.
    -   В ячейке **C1** напишите `Language`.
    -   В ячейке **D1** напишите `Referrer`.
4.  **Скопируйте ID таблицы**:
    -   URL-адрес вашей таблицы будет выглядеть примерно так: `https://docs.google.com/spreadsheets/d/1KUMcPkc1oKu0zzvOR1XaRwqO51idAhb4rR542dr8eNg/edit`
    -   **ID таблицы** - это длинная строка символов между `.../d/` и `/edit...`.
    -   **Скопируйте и сохраните этот ID**, он понадобится на следующем шаге.

---

### Шаг 3: Настройка Google Apps Script

Это самый важный шаг. Скрипт будет выполнять роль вашего единого сервера.

1.  **Откройте ваш существующий проект**: Перейдите на [script.google.com](https://script.google.com) и откройте ваш проект скрипта.
2.  **Вставьте обновленный код**:
    -   Удалите **все** содержимое из файла `Code.gs`.
    -   Скопируйте и вставьте в него следующий **полный и обновленный код**. Он теперь умеет и обрабатывать чат, и рассылать приглашения, и логировать посещения.
        ```javascript
        // ==== НАСТРОЙКА ====
        // Вставьте сюда ID вашей ЕДИНОЙ Google Таблицы из Шага 2
        var SPREADSHEET_ID = 'ВАШ_ID_ТАБЛИЦЫ_ЗДЕСЬ'; 
        // ==== КОНЕЦ НАСТРОЙКИ ====

        /**
         * Эта функция обрабатывает POST-запросы от вашего React-приложения.
         * Она определяет, является ли запрос чат-сообщением или логом посещения.
         */
        function doPost(e) {
          if (!e || !e.postData || !e.postData.contents) {
            var errorMsg = "Запрос не содержит данных.";
            return ContentService.createTextOutput(JSON.stringify({ error: errorMsg })).setMimeType(ContentService.MimeType.JSON);
          }

          try {
            var payload = JSON.parse(e.postData.contents);
            
            // Маршрутизация: определяем, что делать на основе содержимого payload
            if (payload.action === 'logVisit') {
              return logVisit(payload);
            } else if (payload.message) {
              return handleChatMessage(payload);
            } else {
              throw new Error("Неизвестный тип запроса. 'action' или 'message' не найдены.");
            }

          } catch (error) {
            Logger.log('Критическая ошибка в doPost: ' + error.toString());
            var errorMessage = error.message || error.toString() || 'Произошла неизвестная ошибка на сервере.';
            return ContentService.createTextOutput(JSON.stringify({ error: errorMessage }))
              .setMimeType(ContentService.MimeType.JSON);
          }
        }

        /**
         * Записывает информацию о посещении в лист "Logs".
         */
        function logVisit(data) {
          try {
            var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Logs');
            if (!sheet) {
              throw new Error("Лист с названием 'Logs' не найден в вашей Google Таблице.");
            }
            // Формируем строку для записи
            var newRow = [
              new Date().toISOString(),
              data.userAgent || '',
              data.language || '',
              data.referrer || ''
            ];
            sheet.appendRow(newRow);
            // Возвращаем успешный ответ (он не будет использоваться на клиенте, но это хорошая практика)
            return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
          } catch (e) {
            Logger.log("Ошибка при записи лога посещения: " + e.message);
            // Не отправляем ошибку клиенту, чтобы не нарушать его работу
            return ContentService.createTextOutput(JSON.stringify({ status: 'logged_error' })).setMimeType(ContentService.MimeType.JSON);
          }
        }

        /**
         * Обрабатывает чат-сообщение и отправляет его в Gemini API.
         */
        function handleChatMessage(payload) {
          var userMessage = payload.message;
          var systemInstruction = payload.systemInstruction;
          
          var scriptProperties = PropertiesService.getScriptProperties();
          var primaryApiKey = scriptProperties.getProperty('GEMINI_API_KEY');
          var secondaryApiKey = scriptProperties.getProperty('GEMINI_API_KEY1');
          
          if (!primaryApiKey && !secondaryApiKey) {
            throw new Error("API Key (GEMINI_API_KEY или GEMINI_API_KEY1) не найден в Свойствах скрипта.");
          }

          var geminiPayload = {
            "contents": [{"parts": [{"text": userMessage}]}],
            "systemInstruction": {"parts": [{"text": systemInstruction}]}
          };

          var response;
          if (primaryApiKey) {
            response = makeGeminiRequest(primaryApiKey, geminiPayload);
          }
          if ((!response || response.getResponseCode() === 429) && secondaryApiKey) {
            if (response) {
               Logger.log('Основной ключ (GEMINI_API_KEY) исчерпал лимит. Переключаюсь на запасной (GEMINI_API_KEY1).');
            }
            response = makeGeminiRequest(secondaryApiKey, geminiPayload);
          }
          if (!response) {
             throw new Error("Не удалось выполнить запрос. Проверьте наличие и правильность API ключей.");
          }
          
          var responseBody = response.getContentText();
          var responseCode = response.getResponseCode();
          
          if (responseCode >= 400) {
             Logger.log('Ошибка от Gemini API. Статус: ' + responseCode + '. Ответ: ' + responseBody);
             var errorDetail = responseBody;
             try {
               var errorResponse = JSON.parse(responseBody);
               if (errorResponse && errorResponse.error && errorResponse.error.message) {
                 errorDetail = errorResponse.error.message;
               }
             } catch (parseError) {}
             return ContentService.createTextOutput(JSON.stringify({ 
                 error: 'Ошибка от Gemini API (статус ' + responseCode + '). Детали: ' + errorDetail 
             })).setMimeType(ContentService.MimeType.JSON);
          }

          return ContentService.createTextOutput(responseBody).setMimeType(ContentService.MimeType.JSON);
        }
        
        function makeGeminiRequest(apiKey, payload) {
            var geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey;
            var options = {
              'method': 'post',
              'contentType': 'application/json',
              'payload': JSON.stringify(payload),
              'muteHttpExceptions': true
            };
            return UrlFetchApp.fetch(geminiUrl, options);
        }

        function onOpen() {
          SpreadsheetApp.getUi()
              .createMenu('Управление доступом')
              .addItem('Отправить приглашения', 'sendInvitations')
              .addToUi();
        }

        /**
         * Предоставляет доступ к документам пользователям из таблицы.
         */
        function sendInvitations() {
          var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Invitations');
          if (!sheet) {
             SpreadsheetApp.getUi().alert("Ошибка", "Лист с названием 'Invitations' не найден. Пожалуйста, проверьте имя листа.", SpreadsheetApp.getUi().ButtonSet.OK);
             return;
          }
          var dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3);
          var data = dataRange.getValues();
          var ui = SpreadsheetApp.getUi();
          var sentCount = 0;
          var errorCount = 0;

          for (var i = 0; i < data.length; i++) {
            var row = data[i];
            var email = row[0];
            var docId = row[1];
            var status = row[2];
            
            if (email && docId && status !== 'YES') {
              try {
                var doc = DriveApp.getFileById(docId);
                doc.addViewer(email); 
                sheet.getRange(i + 2, 3).setValue('YES');
                Logger.log('Предоставлен доступ к документу ' + docId + ' для ' + email);
                sentCount++;
              } catch (e) {
                Logger.log('Ошибка: не удалось поделиться документом ' + docId + ' с ' + email + ': ' + e.message);
                sheet.getRange(i + 2, 3).setValue('ERROR');
                errorCount++;
              }
            }
          }
          
          var message = 'Готово!\n\n';
          if (sentCount > 0) message += 'Успешно отправлено приглашений: ' + sentCount + '.\n';
          if (errorCount > 0) message += 'Произошло ошибок: ' + errorCount + '.\n';
          if (sentCount === 0 && errorCount === 0) message = 'Нет новых строк для обработки.';
          ui.alert('Результат выполнения', message, ui.ButtonSet.OK);
        }
        ```
3.  **Убедитесь, что ID Таблицы указан верно**:
    -   Проверьте, что в строке `var SPREADSHEET_ID = '...';` стоит ID вашей таблицы.
4.  **Сохраните проект**: Нажмите на иконку дискеты ("Сохранить проект").

---

### Шаг 4: ПЕРЕРАЗВЕРТЫВАНИЕ Веб-Приложения (Критически важный шаг!)

Поскольку мы изменили код скрипта, нам нужно опубликовать новую версию.

1.  В правом верхнем углу редактора скриптов нажмите синюю кнопку **"Развертывание" (Deploy)**.
2.  Выберите **"Управление развертываниями" (Manage deployments)**.
3.  Найдите ваше активное развертывание, нажмите на иконку карандаша ("Изменить").
4.  В поле **"Версия"** выберите **"Новая версия"**.
5.  Нажмите **"Развернуть" (Deploy)**.
6.  **URL веб-приложения останется прежним**, вам не нужно его менять. Просто закройте окно.

---

### Шаг 5: Настройка Frontend-приложения

Этот шаг нужно сделать только один раз.

1.  Откройте файл `services/geminiService.ts` в редакторе.
2.  Найдите строку:
    ```typescript
    const GOOGLE_SCRIPT_URL: string = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';
    ```
3.  **Замените** `'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE'` на URL веб-приложения, который вы скопировали ранее.
4.  Сохраните файл.

---

### Использование системы

1.  **Рассылка приглашений**:
    -   Добавьте в вашу Google Таблицу на лист `Invitations` email пользователя (столбец A) и ID нужного ему документа (столбец B).
    -   Откройте Таблицу.
    -   В верхнем меню выберите **"Управление доступом" -> "Отправить приглашения"**.
2.  **Просмотр логов посещений**:
    -   Просто откройте лист `Logs` в вашей Google Таблице. Новые записи о посещениях будут автоматически добавляться в конец списка каждый раз, когда кто-то открывает ваше приложение.