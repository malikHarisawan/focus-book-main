import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'
import { MessageSquare, Send, Bot, User, Sparkles, RotateCcw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'

export default function ChatPage() {
  // Load messages from localStorage on component mount
  const loadMessagesFromStorage = () => {
    try {
      const saved = localStorage.getItem('focusbook-chat-messages')
      if (saved) {
        const parsedMessages = JSON.parse(saved)
        // Convert timestamp strings back to Date objects
        return parsedMessages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }
    } catch (error) {
      console.error('Error loading messages from storage:', error)
    }
    
    // Return default welcome message if nothing saved
    return [
      {
        id: 1,
        type: 'bot',
        content: 'Hello! I can help you analyze your productivity data and provide insights. Ask me about your usage patterns, productivity trends, or request a summary of your activities.',
        timestamp: new Date()
      }
    ]
  }

  const [messages, setMessages] = useState(loadMessagesFromStorage)
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [serviceStatus, setServiceStatus] = useState({ isRunning: false, port: null })
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Save messages to localStorage whenever messages change
  const saveMessagesToStorage = (newMessages) => {
    try {
      localStorage.setItem('focusbook-chat-messages', JSON.stringify(newMessages))
    } catch (error) {
      console.error('Error saving messages to storage:', error)
    }
  }

  useEffect(() => {
    scrollToBottom()
    // Save messages whenever they change
    saveMessagesToStorage(messages)
  }, [messages])

  useEffect(() => {
    // Check AI service status periodically
    const checkServiceStatus = async () => {
      try {
        const status = await window.electronAPI.getAiServiceStatus()
        setServiceStatus(status)
      } catch (error) {
        console.error('Error checking AI service status:', error)
        setServiceStatus({ isRunning: false, port: null, error: error.message })
      }
    }

    checkServiceStatus()
    const statusInterval = setInterval(checkServiceStatus, 10000) // Check every 10 seconds

    return () => clearInterval(statusInterval)
  }, [])

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInputMessage('')
    setIsLoading(true)

    try {
      // Send message to AI service
      const response = await window.electronAPI.aiChat(inputMessage)
      
      let botContent = 'Sorry, I encountered an error processing your request.'
      
      if (response.error) {
        botContent = `Error: ${response.error}. Please make sure the AI service is running and configured properly.`
      } else if (response.reply) {
        botContent = response.reply
      }

      const botResponse = {
        id: Date.now() + 1,
        type: 'bot',
        content: botContent,
        timestamp: new Date()
      }
      const updatedMessages = [...newMessages, botResponse]
      setMessages(updatedMessages)
      
    } catch (error) {
      console.error('Error sending message to AI service:', error)
      const errorResponse = {
        id: Date.now() + 1,
        type: 'bot',
        content: 'Sorry, I\'m unable to connect to the AI service. Please check your connection and try again.',
        timestamp: new Date()
      }
      const updatedMessages = [...newMessages, errorResponse]
      setMessages(updatedMessages)
    } finally {
      setIsLoading(false)
    }
  }

  
const handleResetConversation = async () => {
    try {
      // Call backend reset endpoint to clear server-side memory via IPC
      const resetResponse = await window.electronAPI.resetAiMemory()

      if (resetResponse.error) {
        console.warn('Backend reset failed:', resetResponse.error, 'but continuing with frontend reset')
      } else {
        console.log('AI memory reset successfully')
      }
    } catch (error) {
      console.error('Error calling backend reset:', error)
      // Continue with frontend reset even if backend fails
    }

    // Reset frontend state - initial state with welcome message
    const initialMessages = [
      {
        id: 1,
        type: 'bot',
        content: 'Hello! I can help you analyze your productivity data and provide insights. Ask me about your usage patterns, productivity trends, or request a summary of your activities.',
        timestamp: new Date()
      }
    ]
    
    setMessages(initialMessages)
    setShowResetConfirm(false)
    
    // Clear input if any
    setInputMessage('')
    
    // Clear localStorage
    try {
      localStorage.removeItem('focusbook-chat-messages')
    } catch (error) {
      console.error('Error clearing localStorage:', error)
    }
    
    // Focus back to input
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const suggestedPrompts = [
    "Give me a summary of today's productivity",
    "What are my most distracting applications?",
    "Show me my focus session trends",
    "How can I improve my productivity?",
    "What time of day am I most productive?"
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          AI Insights
        </h1>
        <p className="text-slate-400 mt-2">
          Get personalized insights and summaries about your productivity patterns
        </p>
      </div>

      {/* Chat Container */}
      <Card className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border-slate-700/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-slate-200">
            <MessageSquare className="h-5 w-5 text-cyan-500" />
            Chat with AI Assistant
            <div className="flex items-center gap-2 ml-auto">
              <div className={`w-2 h-2 rounded-full ${serviceStatus.isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-xs text-slate-400">
                {serviceStatus.isRunning ? `Service Running (Port ${serviceStatus.port})` : 'Service Offline'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowResetConfirm(true)}
                className="text-slate-400 hover:text-red-400 hover:bg-red-900/20 p-1 h-8 w-8"
                title="Reset conversation"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Sparkles className="h-4 w-4 text-yellow-500" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Messages Area */}
          <ScrollArea className="h-96 w-full rounded-lg bg-slate-900/50 border border-slate-700/50">
            <div className="p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.type === 'bot' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 ${
                      message.type === 'user'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white'
                        : 'bg-slate-800/70 border border-slate-700/50 text-slate-200'
                    }`}
                  >
                    {message.type === 'bot' ? (
                      <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeHighlight]}
                          components={{
                            // Custom styling for markdown elements
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-cyan-400">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-md font-semibold mb-2 text-cyan-300">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 text-cyan-300">{children}</h3>,
                            ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="text-slate-300">{children}</li>,
                            code: ({ children, className }) => {
                              const isInline = !className;
                              return isInline ? (
                                <code className="bg-slate-900/50 text-cyan-400 px-1 py-0.5 rounded text-xs font-mono">
                                  {children}
                                </code>
                              ) : (
                                <code className={className}>{children}</code>
                              );
                            },
                            pre: ({ children }) => (
                              <pre className="bg-slate-900/80 border border-slate-600/50 rounded-md p-3 mb-2 overflow-x-auto custom-scrollbar">
                                {children}
                              </pre>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-cyan-500/50 pl-4 italic text-slate-300 mb-2">
                                {children}
                              </blockquote>
                            ),
                            strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                            em: ({ children }) => <em className="text-cyan-300">{children}</em>,
                            a: ({ children, href }) => (
                              <a 
                                href={href} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-cyan-400 hover:text-cyan-300 underline"
                              >
                                {children}
                              </a>
                            ),
                            table: ({ children }) => (
                              <div className="overflow-x-auto mb-2 custom-scrollbar">
                                <table className="min-w-full border-collapse border border-slate-600">
                                  {children}
                                </table>
                              </div>
                            ),
                            th: ({ children }) => (
                              <th className="border border-slate-600 px-3 py-2 bg-slate-700/50 text-left font-semibold text-cyan-300">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="border border-slate-600 px-3 py-2 text-slate-300">
                                {children}
                              </td>
                            )
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed">{message.content}</p>
                    )}
                    <p className={`text-xs mt-2 ${
                      message.type === 'user' ? 'text-cyan-100' : 'text-slate-500'
                    }`}>
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                  {message.type === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-slate-600 to-slate-700 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-slate-800/70 border border-slate-700/50 rounded-lg px-4 py-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Suggested Prompts */}
          <div className="space-y-2">
            <p className="text-xs text-slate-500 font-mono">SUGGESTED PROMPTS</p>
            <div className="flex flex-wrap gap-2">
              {suggestedPrompts.map((prompt, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50 hover:border-cyan-500/50 text-slate-300"
                  onClick={() => setInputMessage(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about your productivity patterns, request insights, or get a summary..."
                className="w-full min-h-[60px] max-h-32 px-4 py-3 bg-slate-900/70 border border-slate-700/50 rounded-lg text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
                disabled={isLoading}
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white self-end"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="bg-slate-800 border-slate-700 w-96">
            <CardHeader>
              <CardTitle className="text-slate-200 flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-red-400" />
                Reset Conversation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-300">
                Are you sure you want to clear the entire conversation? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowResetConfirm(false)}
                  className="bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleResetConversation}
                  className="bg-red-600 hover:bg-red-500 text-white"
                >
                  Reset Chat
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}