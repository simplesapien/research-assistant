'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Home, MessageSquare, Wrench, Book, LogOut, Plus, Pencil, Trash } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { API_URL } from '@/lib/config'

export default function InsightsPage() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const [insights, setInsights] = useState([])
  const [editingInsight, setEditingInsight] = useState(null)
  const [newInsight, setNewInsight] = useState({ content: '', type: '', tags: '' })
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchInsights()
    }
  }, [user])

  const fetchInsights = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/insights`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setInsights(data);
    } catch (error) {
      console.error('Error fetching insights:', error);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/insights/${editingInsight._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editingInsight)
      })

      if (!response.ok) throw new Error('Failed to update insight')
      
      await fetchInsights()
      setEditingInsight(null)
    } catch (error) {
      console.error('Error updating insight:', error)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this insight?')) return
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/insights/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      })

      if (!response.ok) throw new Error('Failed to delete insight')
      
      await fetchInsights()
    } catch (error) {
      console.error('Error deleting insight:', error)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/insights`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newInsight,
          tags: newInsight.tags.split(',').map(tag => tag.trim())
        })
      })

      if (!response.ok) throw new Error('Failed to add insight')
      
      await fetchInsights()
      setIsAdding(false)
      setNewInsight({ content: '', type: '', tags: '' })
    } catch (error) {
      console.error('Error adding insight:', error)
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
        <Tabs defaultValue="knowledge">
          <TabsList>
            <TabsTrigger value="chat">
              <Link href="/" className="flex items-center">
                <MessageSquare className="w-4 h-4 mr-2" />
                Chat
              </Link>
            </TabsTrigger>
            <TabsTrigger value="tools">
              <Link href="/tools" className="flex items-center">
                <Wrench className="w-4 h-4 mr-2" />
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
          <div className="mb-4">
            <Button onClick={() => setIsAdding(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add Insight
            </Button>
          </div>

          {isAdding && (
            <Card className="mb-4">
              <CardContent>
                <form onSubmit={handleAdd} className="space-y-4">
                  <Textarea
                    placeholder="Content"
                    value={newInsight.content}
                    onChange={(e) => setNewInsight({...newInsight, content: e.target.value})}
                    required
                  />
                  <Input
                    type="text"
                    placeholder="Type (e.g., trend_analysis, market_timing)"
                    value={newInsight.type}
                    onChange={(e) => setNewInsight({...newInsight, type: e.target.value})}
                    required
                  />
                  <Input
                    type="text"
                    placeholder="Tags (comma-separated)"
                    value={newInsight.tags}
                    onChange={(e) => setNewInsight({...newInsight, tags: e.target.value})}
                  />
                  <div className="flex gap-2">
                    <Button type="submit">Save</Button>
                    <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {insights.map((insight) => (
              <Card key={insight._id}>
                {editingInsight?._id === insight._id ? (
                  <CardContent>
                    <form onSubmit={handleEdit} className="space-y-4">
                      <Textarea
                        value={editingInsight.content}
                        onChange={(e) => setEditingInsight({...editingInsight, content: e.target.value})}
                      />
                      <Input
                        type="text"
                        value={editingInsight.type}
                        onChange={(e) => setEditingInsight({...editingInsight, type: e.target.value})}
                      />
                      <div className="flex gap-2">
                        <Button type="submit">Save</Button>
                        <Button type="button" variant="outline" onClick={() => setEditingInsight(null)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                ) : (
                  <>
                    <CardHeader>
                      <CardTitle>{insight.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p>{insight.content}</p>
                      <div className="mt-2 text-sm text-gray-500">
                        <span>Type: {insight.type}</span>
                        {insight.createdAt && (
                          <span className="ml-4">
                            Created: {new Date(insight.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingInsight(insight)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(insight._id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </>
                )}
              </Card>
            ))}
          </div>
        </ScrollArea>
      </main>
    </div>
  )
}