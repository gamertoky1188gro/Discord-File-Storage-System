import { useState, useEffect, useCallback } from 'react';

type WebSocketMessage = {
  type: string;
  data: any;
};

export function useWebSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [messageHistory, setMessageHistory] = useState<WebSocketMessage[]>([]);

  // Initialize WebSocket connection
  useEffect(() => {
    // Create WebSocket with the correct protocol based on the current URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connection established');
      setIsConnected(true);
    };
    
    ws.onclose = () => {
      console.log('WebSocket connection closed');
      setIsConnected(false);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        setLastMessage(message);
        setMessageHistory(prev => [...prev, message]);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    setSocket(ws);
    
    // Clean up connection on unmount
    return () => {
      ws.close();
    };
  }, []);

  // Send a message through the WebSocket
  const sendMessage = useCallback((type: string, data: any) => {
    if (socket && isConnected) {
      const message = JSON.stringify({ type, data });
      socket.send(message);
      return true;
    }
    return false;
  }, [socket, isConnected]);

  // Reset the message history
  const clearMessageHistory = useCallback(() => {
    setMessageHistory([]);
  }, []);

  return {
    isConnected,
    lastMessage,
    messageHistory,
    sendMessage,
    clearMessageHistory
  };
}