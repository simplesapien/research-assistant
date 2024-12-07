'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { Home, MessageSquare, Tool, Book, LogOut } from 'lucide-react'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { API_URL } from '@/lib/config'

export function ChatApp() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const [messages, setMessages] = useState([
    { id: 1, content: "Hello! How can I help you today?", role: "assistant" }
  ])
  const [inputMessage, setInputMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => Math.random().toString(36).substring(7))

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputMessage.trim() || isLoading) return

    const userMessage = inputMessage.trim()
    setInputMessage('')
    setMessages(prev => [...prev, { id: Date.now(), content: userMessage, role: 'user' }])
    setIsLoading(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage,
          sessionId,
          searchOptions: {
            searchType: 'hybrid',
            limit: 5,
            threshold: 0.3,
            filters: {}
          }
        }),
      })

      if (!response.ok) throw new Error('Chat request failed')

      const data = await response.json()
      
      setMessages(prev => [...prev, {
        id: Date.now(),
        content: data.response,
        role: 'assistant',
        tools: data.relevantTools,
        insights: data.insights
      }])
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        id: Date.now(),
        content: 'Sorry, I encountered an error. Please try again.',
        role: 'assistant'
      }])
    } finally {
      setIsLoading(false)
    }
  }

  if (loading) return null
  if (!user) return null

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between p-4 border-b">
        <Link href="/" className="flex items-center space-x-2">
          <Home className="w-6 h-6" />
          <span className="text-xl font-bold">Research Assistant</span>
        </Link>
        <Tabs defaultValue="chat">
          <TabsList>
            <TabsTrigger value="chat">
              <Link href="/" className="flex items-center">
                <MessageSquare className="w-4 h-4 mr-2" />
                Chat
              </Link>
            </TabsTrigger>
            <TabsTrigger value="tools">
              <Link href="/tools" className="flex items-center">
                <Tool className="w-4 h-4 mr-2" />
                Tools
              </Link>
            </TabsTrigger>
            <TabsTrigger value="knowledge">
              <Link href="/insights" className="flex items-center">
                <Book className="w-4 h-4 mr-2" />
                Knowledge
              </Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="ghost" onClick={logout}>
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </header>
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full p-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`mb-4 ${
                message.role === 'user' ? 'text-right' : 'text-left'
              }`}
            >
              <div
                className={`inline-block p-4 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <div className="prose prose-sm dark:prose-invert">
                  {message.content}
                </div>
                {message.tools && message.tools.length > 0 && (
                  <div className="mt-4 text-sm">
                    <div className="font-medium">Relevant Tools:</div>
                    <ul className="mt-2 space-y-1">
                      {message.tools.map((tool) => (
                        <li key={tool.id || tool._id}>
                          <a
                            href={tool.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {tool.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </ScrollArea>
      </main>
      <footer className="p-4 border-t">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <Input
            type="text"
            placeholder="Ask about research tools..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading}>
            Send
          </Button>
        </form>
      </footer>
    </div>
  )
}

export default ChatApp;