import axios from 'axios';
import { useState, useEffect, useCallback } from 'react';
import { Message, CreateMessage } from '@/app/components/base/chat-api';

import apiClient from '@/app/components/base/api-client';

interface UseChatOptions {
  initialMessages?: Message[];
  body?: Record<string, any>;
  onFinish?: () => void;
  chatId: string;
}

export const createThread = async (): Promise<string> => {
  try {
    const response = await apiClient.post('/api/threads/create');
    if (response.status !== 201) {
      throw new Error('Failed to create thread');
    }
    return response.data.thread_id;
  } catch (error) {
    console.error('Error creating thread:', error);
    throw new Error('Failed to create thread');
  }
};


export function useChat({ initialMessages = [], body = {}, onFinish }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingData, setStreamingData] = useState<any>(null);
  const [currentThreadId, setCurrentThreadId] = useState('');

  // Initialize thread on component mount if there are initial messages
  useEffect(() => {
    const initializeThread = async () => {
      if (initialMessages.length > 0 && !currentThreadId) {
        const newThreadId = await createThread();
        setCurrentThreadId(newThreadId);
      }
    };
    
    initializeThread();
  }, [initialMessages.length, currentThreadId]);

  const append = useCallback(async (message: CreateMessage) => {
    try {
      setIsLoading(true);

      let threadId = currentThreadId;
      if (!threadId) {
        threadId = await createThread();
        setCurrentThreadId(threadId);
      }


      // Add user message
      setMessages(prevMessages => [...prevMessages, { 
        ...message, 
        id: Date.now().toString(),
        role: message.role || 'user'
      }]);
      
      const response = await apiClient.post(`/api/threads/runs`, {
        message: message.content,
        thread_id: threadId,
        content: message.content,
        chat_id: body.id,
        attachments: message.attachments
      });

      // Format assistant message
      const assistantMessage: Message = {
        id: response.data.id || Date.now().toString(),
        role: 'assistant',
        content: response.data || ''  // Modify this line
      };

      // Update with assistant response using functional update
      setMessages(prevMessages => [...prevMessages, assistantMessage]);
      
      setStreamingData(response.data.streamingData);
      onFinish?.();
      return assistantMessage.id;

    } catch (error) {
      console.error('Chat API error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [body.id, messages, onFinish]);

  const handleSubmit = useCallback(
    (event?: { preventDefault?: () => void }) => {
      event?.preventDefault?.();
      if (!input.trim() || isLoading) return;
  
      const userMessage = {
        id: Date.now().toString(),
        role: 'user' as const,
        content: input
      };
  
      setInput('');
      return append(userMessage);
    },
    [input, isLoading, append, setInput]
  );



  const stop = useCallback(() => {
    // Implement cancel logic here if needed
    setIsLoading(false);
  }, []);

  return {
    messages,
    setMessages,
    input,
    setInput,
    handleSubmit,
    append,
    isLoading,
    stop,
    data: streamingData,
    currentThreadId,
    setCurrentThreadId
  };
}

export function Chat({
  id,
  initialMessages,
  selectedModelId,
}: {
  id: string;
  initialMessages: Array<Message>;
  selectedModelId: string;
}) {
  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,  
    append,
    isLoading,
    stop,
    data: streamingData,
  } = useChat({
    chatId: id,
    body: { id, modelId: selectedModelId },
    initialMessages
  });
}