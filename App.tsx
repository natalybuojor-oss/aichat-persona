import React, { useState, useEffect } from 'react';
import { Persona } from './types';
import { PERSONAS } from './constants';
import PersonaSelection from './components/PersonaSelection';
import ChatView from './components/ChatView';
import { translations } from './localization/translations';
import { logAppVisit } from './services/geminiService';

const App: React.FC = () => {
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [language, setLanguage] = useState<string>('ru'); // Default language set to Russian

  useEffect(() => {
    // Логируем посещение приложения при первом монтировании компонента
    logAppVisit();
  }, []); // Пустой массив зависимостей гарантирует, что это выполнится только один раз

  const handleSelectPersona = (persona: Persona) => {
    setSelectedPersona(persona);
  };

  const handleBack = () => {
    setSelectedPersona(null);
  };
  
  const t = translations[language as keyof typeof translations];

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      <div className="container mx-auto p-4 max-w-4xl">
        <header className="text-center mb-8 pt-4">
          <h1 className="text-4xl font-bold text-purple-400">{t.appTitle}</h1>
          <p className="text-gray-400 mt-2">{t.appSubtitle}</p>
        </header>
        {!selectedPersona ? (
          <PersonaSelection
            personas={PERSONAS}
            onSelectPersona={handleSelectPersona}
            language={language}
            setLanguage={setLanguage}
          />
        ) : (
          <ChatView
            persona={selectedPersona}
            onBack={handleBack}
            language={language}
          />
        )}
      </div>
    </div>
  );
};

export default App;