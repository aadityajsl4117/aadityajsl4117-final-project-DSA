import React, { useState, useRef, useEffect } from 'react';
import { useLibrary } from '../../hooks/useLibrary';
import { Bot, User, Send, Sparkles } from 'lucide-react';
import { LibraryState } from '../../types';

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: Date;
}

const processQuery = (query: string, state: LibraryState): string => {
  const lower = query.toLowerCase();
  
  if (lower.includes('available') && lower.includes('books')) {
    const available = state.books.filter(b => b.availableCopies > 0).length;
    return `We currently have **${available}** different books available for borrowing. Let me know if you want to search for a specific title! 📚`;
  }
  if (lower.includes('overdue')) {
    const overdue = state.transactions.filter(t => t.status === 'OVERDUE');
    if (overdue.length === 0) return "Great news! There are no overdue books right now. 🎉";
    return `There are **${overdue.length}** overdue transactions currently. Please check the Circulation tab for details. ⏰`;
  }
  if (lower.includes('who has fines') || lower.includes('unpaid fines')) {
    const fines = state.fines.filter(f => f.status === 'PENDING');
    if (fines.length === 0) return "No one has pending fines. Everyone is all caught up! 💸";
    const amount = fines.reduce((sum, f) => sum + f.amount, 0);
    return `There are **${fines.length}** pending fines totaling **₹${amount.toFixed(2)}**. 💰`;
  }
  if (lower.includes('popular') || lower.includes('most borrowed')) {
    return "Our most popular books right now are usually the latest tech releases and classic sci-fi novels! Check the Analytics tab for detailed stats. 📈";
  }
  if (lower.includes('how many books')) {
    return `We have a total of **${state.books.length}** unique book titles in our catalog. 📖`;
  }
  
  return "I can help you with: available books, overdue items, member info, fines, reservations, email status, and more. Try asking a specific question! 🤖";
};

export const AIAssistant: React.FC = () => {
  const { state } = useLibrary();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', sender: 'ai', text: "Hello! I'm Lumina, your library AI assistant. How can I help you manage the library today? ✨", timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    
    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    setTimeout(() => {
      const response = processQuery(userMsg.text, state);
      const aiMsg: Message = { id: (Date.now() + 1).toString(), sender: 'ai', text: response, timestamp: new Date() };
      setMessages(prev => [...prev, aiMsg]);
    }, 600);
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
    // Auto send suggestion
    setTimeout(() => {
      const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
      document.getElementById('chat-form')?.dispatchEvent(submitEvent);
    }, 100);
  };

  const suggestions = [
    'Which books are available?',
    'Which books are overdue?',
    'Who has unpaid fines?',
    'What are the most popular books?'
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[600px] flex flex-col">
      <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-indigo-50/50 rounded-t-lg">
        <div className="bg-indigo-100 p-2 rounded-full text-indigo-600">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-800">Lumina AI</h3>
          <p className="text-xs text-gray-500">Always here to help</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.sender === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'}`}>
              {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none'}`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              <span className={`text-[10px] block mt-1 ${msg.sender === 'user' ? 'text-indigo-200 text-right' : 'text-gray-400'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-100 bg-gray-50/50 rounded-b-lg">
        <div className="flex flex-wrap gap-2 mb-3">
          {suggestions.map(s => (
            <button key={s} onClick={() => handleSuggestion(s)} className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full hover:bg-gray-50 hover:text-indigo-600 transition-colors">
              {s}
            </button>
          ))}
        </div>
        <form id="chat-form" onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Lumina a question..."
            className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="absolute right-2 top-1.5 p-1.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
