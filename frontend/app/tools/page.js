'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Home, MessageSquare, Wrench, Book, LogOut, Plus, Edit, Trash } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { API_URL } from '@/lib/config'

export default function ToolsPage() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const [tools, setTools] = useState([])
  const [editingTool, setEditingTool] = useState(null)
  const [newTool, setNewTool] = useState({ name: '', description: '', category: '', url: '' })

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchTools()
    }
  }, [user])

  const fetchTools = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/tools`, {
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
      setTools(data);
    } catch (error) {
      console.error('Error fetching tools:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this tool?')) {
      try {
        const token = localStorage.getItem('token')
        const response = await fetch(`${API_URL}/api/tools/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          setTools(tools.filter(tool => tool._id !== id));
        }
      } catch (error) {
        console.error('Error deleting tool:', error);
      }
    }
  };

  const handleSubmit = async (e, tool, isEdit = false) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token')
      const url = isEdit ? `${API_URL}/api/tools/${tool._id}` : `${API_URL}/api/tools`;
      const method = isEdit ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tool)
      });
      
      if (response.ok) {
        fetchTools();
        setEditingTool(null);
        setNewTool({ name: '', description: '', category: '', url: '' });
      }
    } catch (error) {
      console.error('Error saving tool:', error);
    }
  };

  if (loading) return null;
  if (!user) return null;

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between p-4 border-b">
        <Link href="/" className="flex items-center space-x-2">
          <Home className="w-6 h-6" />
          <span className="text-xl font-bold">Research Assistant</span>
        </Link>
        <Tabs defaultValue="tools">
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
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Add New Tool</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => handleSubmit(e, newTool, false)} className="space-y-4">
                <Input
                  type="text"
                  placeholder="Tool Name"
                  value={newTool.name}
                  onChange={(e) => setNewTool({...newTool, name: e.target.value})}
                />
                <Textarea
                  placeholder="Description"
                  value={newTool.description}
                  onChange={(e) => setNewTool({...newTool, description: e.target.value})}
                />
                <Input
                  type="text"
                  placeholder="Category"
                  value={newTool.category}
                  onChange={(e) => setNewTool({...newTool, category: e.target.value})}
                />
                <Input
                  type="url"
                  placeholder="URL"
                  value={newTool.url}
                  onChange={(e) => setNewTool({...newTool, url: e.target.value})}
                />
                <Button type="submit">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Tool
                </Button>
              </form>
            </CardContent>
          </Card>
          {tools.map(tool => (
            <Card key={tool._id} className="mb-4">
              <CardContent className="pt-6">
                {editingTool?._id === tool._id ? (
                  <form onSubmit={(e) => handleSubmit(e, editingTool, true)} className="space-y-4">
                    <Input
                      type="text"
                      value={editingTool.name}
                      onChange={(e) => setEditingTool({...editingTool, name: e.target.value})}
                    />
                    <Textarea
                      value={editingTool.description}
                      onChange={(e) => setEditingTool({...editingTool, description: e.target.value})}
                    />
                    <Input
                      type="text"
                      value={editingTool.category}
                      onChange={(e) => setEditingTool({...editingTool, category: e.target.value})}
                    />
                    <Input
                      type="url"
                      value={editingTool.url}
                      onChange={(e) => setEditingTool({...editingTool, url: e.target.value})}
                    />
                    <div className="space-x-2">
                      <Button type="submit">Save</Button>
                      <Button variant="outline" onClick={() => setEditingTool(null)}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <h3 className="text-lg font-bold">{tool.name}</h3>
                    <p className="text-gray-600">{tool.description}</p>
                    <p className="text-sm text-gray-500">Category: {tool.category}</p>
                    {tool.url && (
                      <a 
                        href={tool.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-sm"
                      >
                        Visit Tool
                      </a>
                    )}
                  </>
                )}
              </CardContent>
              {!editingTool && (
                <CardFooter className="justify-end space-x-2">
                  <Button onClick={() => setEditingTool(tool)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button variant="destructive" onClick={() => handleDelete(tool._id)}>
                    <Trash className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </ScrollArea>
      </main>
    </div>
  )
}