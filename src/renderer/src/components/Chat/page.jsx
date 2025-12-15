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
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-[#5051F9] to-[#1EA7FF] bg-clip-text text-transparent">
          AI Insights
        </h1>
        <p className="text-[#768396] dark:text-[#898999] mt-1">
          Get personalized insights and summaries about your productivity patterns
        </p>
      </div>

      {/* Chat Container */}
      <Card className="bg-white dark:bg-[#212329] border-[#E8EDF1] dark:border-[#282932] backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-[#232360] dark:text-white text-base">
            <MessageSquare className="h-5 w-5 text-[#5051F9]" />
            Chat with AI Assistant
            <div className="flex items-center gap-1.5 ml-auto">
              <div className={`w-2 h-2 rounded-full ${serviceStatus.isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-xs text-[#768396] dark:text-[#898999]">
                {serviceStatus.isRunning ? `Service Running (Port ${serviceStatus.port})` : 'Service Offline'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowResetConfirm(true)}
                className="text-[#768396] dark:text-[#898999] hover:text-[#FF6B6B] hover:bg-[#FF6B6B]/10 p-0.5 h-7 w-7"
                title="Reset conversation"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Sparkles className="h-4 w-4 text-yellow-500" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Messages Area */}
          <ScrollArea className="h-96 w-full rounded-lg bg-[#F4F7FE] dark:bg-[#1E1F25] border border-[#E8EDF1] dark:border-[#282932]">
            <div className="p-3 space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-2 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.type === 'bot' && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-r from-[#5051F9] to-[#1EA7FF] flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      message.type === 'user'
                        ? 'bg-gradient-to-r from-[#5051F9] to-[#1EA7FF] text-white'
                        : 'bg-white dark:bg-[#282932] border border-[#E8EDF1] dark:border-[#282932] text-[#232360] dark:text-white'
                    }`}
                  >
                    {message.type === 'bot' ? (
                      <div className="text-sm leading-relaxed prose dark:prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeHighlight]}
                          components={{
                            // Custom styling for markdown elements
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-[#5051F9]">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-md font-semibold mb-2 text-[#5051F9]">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 text-[#5051F9]">{children}</h3>,
                            ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="text-[#232360] dark:text-white">{children}</li>,
                            code: ({ children, className }) => {
                              const isInline = !className;
                              return isInline ? (
                                <code className="bg-[#F4F7FE] dark:bg-[#1E1F25] text-[#5051F9] px-1 py-0.5 rounded text-xs font-mono">
                                  {children}
                                </code>
                              ) : (
                                <code className={className}>{children}</code>
                              );
                            },
                            pre: ({ children }) => (
                              <pre className="bg-[#F4F7FE] dark:bg-[#1E1F25] border border-[#E8EDF1] dark:border-[#282932] rounded-md p-3 mb-2 overflow-x-auto custom-scrollbar">
                                {children}
                              </pre>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-[#5051F9]/50 pl-4 italic text-[#768396] dark:text-[#898999] mb-2">
                                {children}
                              </blockquote>
                            ),
                            strong: ({ children }) => <strong className="text-[#232360] dark:text-white font-semibold">{children}</strong>,
                            em: ({ children }) => <em className="text-[#5051F9]">{children}</em>,
                            a: ({ children, href }) => (
                              <a 
                                href={href} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[#5051F9] hover:text-[#1EA7FF] underline"
                              >
                                {children}
                              </a>
                            ),
                            table: ({ children }) => (
                              <div className="overflow-x-auto mb-2 custom-scrollbar">
                                <table className="min-w-full border-collapse border border-[#E8EDF1] dark:border-[#282932]">
                                  {children}
                                </table>
                              </div>
                            ),
                            th: ({ children }) => (
                              <th className="border border-[#E8EDF1] dark:border-[#282932] px-3 py-2 bg-[#F4F7FE] dark:bg-[#1E1F25] text-left font-semibold text-[#5051F9]">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="border border-[#E8EDF1] dark:border-[#282932] px-3 py-2 text-[#232360] dark:text-white">
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
                      message.type === 'user' ? 'text-white/70' : 'text-[#768396] dark:text-[#898999]'
                    }`}>
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                  {message.type === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#768396] to-[#5F6388] flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#5051F9] to-[#1EA7FF] flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-white dark:bg-[#282932] border border-[#E8EDF1] dark:border-[#282932] rounded-lg px-4 py-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-[#5051F9] rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-[#5051F9] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-[#5051F9] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Suggested Prompts */}
          <div className="space-y-2">
            <p className="text-xs text-[#768396] dark:text-[#898999] font-mono">SUGGESTED PROMPTS</p>
            <div className="flex flex-wrap gap-2">
              {suggestedPrompts.map((prompt, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-[#F4F7FE] dark:bg-[#282932] border-[#E8EDF1] dark:border-[#282932] hover:bg-white dark:hover:bg-[#212329] hover:border-[#5051F9]/50 text-[#232360] dark:text-white"
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
                className="w-full min-h-[60px] max-h-32 px-4 py-3 bg-[#F4F7FE] dark:bg-[#1E1F25] border border-[#E8EDF1] dark:border-[#282932] rounded-lg text-[#232360] dark:text-white placeholder-[#768396] dark:placeholder-[#768396] resize-none focus:outline-none focus:ring-2 focus:ring-[#5051F9]/50 focus:border-transparent"
                disabled={isLoading}
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="px-4 bg-gradient-to-r from-[#5051F9] to-[#1EA7FF] hover:from-[#4142E0] hover:to-[#1890D6] text-white self-end"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="bg-white dark:bg-[#212329] border-[#E8EDF1] dark:border-[#282932] w-96">
            <CardHeader>
              <CardTitle className="text-[#232360] dark:text-white flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-[#FF6B6B]" />
                Reset Conversation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[#768396] dark:text-[#898999]">
                Are you sure you want to clear the entire conversation? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowResetConfirm(false)}
                  className="bg-[#F4F7FE] dark:bg-[#282932] border-[#E8EDF1] dark:border-[#282932] text-[#232360] dark:text-white hover:bg-[#E8EDF1] dark:hover:bg-[#1E1F25]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleResetConversation}
                  className="bg-[#FF6B6B] hover:bg-[#E65C5C] text-white"
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