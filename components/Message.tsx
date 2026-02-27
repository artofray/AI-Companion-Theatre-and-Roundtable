import React from 'react';
import { ChatMessage } from '../types';
import { User } from 'lucide-react';

interface MessageProps {
  message: ChatMessage;
}

const Message: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.sender === 'user';

  return (
    <div className={`flex items-start gap-3 my-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center`}>
        {isUser ? (
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-indigo-500">
            <User className="w-6 h-6 text-white" />
          </div>
        ) : message.character && (
          <img src={message.character.avatarUrl} alt={message.character.name} className="w-10 h-10 object-cover rounded-full" />
        )}
      </div>
      <div className={`px-4 py-2 rounded-xl max-w-[85%] shadow-md ${isUser ? `bg-indigo-600 text-white rounded-br-sm` : `bg-slate-700 text-slate-200 rounded-bl-sm`}`}>
        {!isUser && message.character && (
          <p className="font-bold text-sm mb-1 text-teal-300">{message.character.name}</p>
        )}
        <p className="text-base whitespace-pre-wrap break-words">{message.text}</p>
      </div>
    </div>
  );
};

export default Message;