"use client"

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from "@/components/ui/card"
import { ArrowLeft, ExternalLink } from "lucide-react"
import Link from "next/link"
import { Loading } from "@/components/ui/loading"
import { DownloadMenu } from "@/components/download-menu"
import ReactMarkdown from "react-markdown"
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import { ChatTab, Workspace, ComposerChat } from "@/types/workspace"
import { Badge } from "@/components/ui/badge"
import { CopyButton } from "@/components/copy-button"

interface WorkspaceState {
  workspace: Workspace | null;
  tabs: ChatTab[];
  composers: ComposerChat[];
  selectedId: string | null;
  selectedType: 'chat' | 'composer';
  isLoading: boolean;
}

export default function WorkspacePage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams()
  const [state, setState] = useState<WorkspaceState>({
    workspace: null,
    tabs: [],
    composers: [],
    selectedId: searchParams.get('tab'),
    selectedType: (searchParams.get('type') as 'chat' | 'composer') || 'chat',
    isLoading: true
  })

  const handleSelect = (id: string, type: 'chat' | 'composer') => {
    setState(prev => ({ ...prev, selectedId: id, selectedType: type }))
    const url = new URL(window.location.href)
    url.searchParams.set('tab', id)
    url.searchParams.set('type', type)
    window.history.pushState({}, '', url.toString())
  }

  const fetchWorkspace = useCallback(async () => {
    try {
      const [workspaceRes, tabsRes] = await Promise.all([
        fetch(`/api/workspaces/${params.id}`),
        fetch(`/api/workspaces/${params.id}/tabs`)
      ])

      const workspace = await workspaceRes.json()
      const data = await tabsRes.json()

      setState(prev => ({
        ...prev,
        workspace,
        tabs: data.tabs || [],
        composers: data.composers?.allComposers || [],
        isLoading: false
      }))
    } catch (error) {
      console.error('Failed to fetch workspace:', error)
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [params.id])

  useEffect(() => {
    fetchWorkspace()
  }, [fetchWorkspace])

  useEffect(() => {
    if (!state.selectedId) {
      if (state.tabs.length > 0) {
        setState(prev => ({ ...prev, selectedId: state.tabs[0].id, selectedType: 'chat' }))
      } else if (state.composers.length > 0) {
        setState(prev => ({ ...prev, selectedId: state.composers[0].composerId, selectedType: 'composer' }))
      }
    }
  }, [state.tabs, state.composers, state.selectedId])

  const handleOpenInCursor = () => {
    // Cursor protocol handler URL
    const cursorUrl = `cursor://workspace/${params.id}`
    window.open(cursorUrl, '_blank')
  }

  if (state.isLoading) {
    return <Loading />
  }

  if (!state.workspace) {
    return <div>Workspace not found</div>
  }

  const selectedChat = state.selectedType === 'chat'
    ? state.tabs.find(tab => tab.id === state.selectedId)
    : null

  const selectedComposer = state.selectedType === 'composer'
    ? state.composers.find(composer => composer.composerId === state.selectedId)
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex justify-between w-full">
          <Button variant="ghost" size="sm" asChild className="gap-2">
            <Link href="/chat">
              <ArrowLeft className="w-4 h-4" />
              Back to Chat Logs
            </Link>
          </Button>
          <div className="flex gap-2">
            {selectedChat && <CopyButton tab={selectedChat} />}
            {selectedChat && <DownloadMenu tab={selectedChat} />}
            {selectedComposer && <DownloadMenu tab={{
              id: selectedComposer.composerId,
              title: selectedComposer.text || 'Untitled',
              timestamp: new Date(selectedComposer.lastUpdatedAt || selectedComposer.createdAt).toISOString(),
              bubbles: (selectedComposer.conversation || []).map(msg => ({
                type: msg.type === 1 ? 'user' : 'ai',
                text: msg.text,
                modelType: msg.type === 2 ? 'Composer Assistant' : undefined,
                selections: msg.context?.selections || []
              }))
            }} />}
          </div>
        </div>
      </div>

      {state.workspace?.folder && (
        <div className="bg-muted/50 dark:bg-muted/10 p-6 rounded-lg border">
          <h2 className="font-semibold mb-2">Workspace Location</h2>
          <p className="text-sm text-muted-foreground">{state.workspace.folder}</p>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-3 space-y-4">
          {state.composers.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Composer Logs</h2>
              <div className="space-y-2">
                {state.composers
                  .sort((a, b) => {
                    const aTime = a.lastUpdatedAt || a.createdAt;
                    const bTime = b.lastUpdatedAt || b.createdAt;
                    return new Date(bTime).getTime() - new Date(aTime).getTime();
                  })
                  .map((composer) => (
                  <Button
                    key={composer.composerId}
                    variant={state.selectedId === composer.composerId ? "default" : "outline"}
                    className="w-full justify-start px-4 py-3 h-auto"
                    onClick={() => handleSelect(composer.composerId, 'composer')}
                    title={composer.name || 'Untitled'}
                  >
                    <div className="text-left w-full">
                      <div className="font-medium truncate">
                        {composer.name || `Composer ${composer.composerId.slice(0, 8)}`}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(composer.lastUpdatedAt || composer.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Chat Logs</h2>
            <div className="space-y-2">
              {state.tabs
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .map((tab) => (
                <Button
                  key={tab.id}
                  variant={state.selectedId === tab.id ? "default" : "outline"}
                  className="w-full justify-start px-4 py-3 h-auto"
                  onClick={() => handleSelect(tab.id, 'chat')}
                  title={tab.title}
                >
                  <div className="text-left w-full">
                    <div className="font-medium truncate">
                      {tab.title || `Chat ${tab.id.slice(0, 8)}`}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(tab.timestamp).toLocaleString()}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-9">
          {(selectedChat || selectedComposer) ? (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">
                  {selectedChat?.title || selectedComposer?.text || 'Untitled'}
                </h2>
                <Badge variant={state.selectedType === 'chat' ? 'default' : 'secondary'}>
                  {state.selectedType === 'chat' ? 'Chat Log' : 'Composer Log'}
                </Badge>
              </div>
              <div className="space-y-6">
                {selectedChat && selectedChat.bubbles.map((bubble, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      bubble.type === 'ai'
                        ? 'bg-muted/50 dark:bg-muted/10'
                        : 'bg-background'
                    }`}
                  >
                    <div className="font-semibold mb-3 text-foreground">
                      {bubble.type === 'ai' ? `AI (${bubble.modelType})` : 'User'}
                    </div>
                    {(bubble.selections?.length ?? 0) > 0 && (
                      <div className="mb-4">
                        <div className="font-medium text-sm text-muted-foreground mb-2">
                          Selections:
                        </div>
                        {bubble.selections?.map((selection, idx) => (
                          <pre
                            key={idx}
                            className="bg-muted/50 dark:bg-muted/10 mt-2 text-sm"
                          >
                            <code>{selection.text}</code>
                          </pre>
                        ))}
                      </div>
                    )}
                    {bubble.text && (
                      <div className="rounded-lg overflow-hidden">
                        <ReactMarkdown
                          className="prose dark:prose-invert max-w-none"
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({inline, className, children, ...props}: any) {
                              const match = /language-(\w+)/.exec(className || '')
                              const language = match ? match[1] : null

                              if (inline) {
                                return <code className={className}>{children}</code>
                              }

                              return (
                                <SyntaxHighlighter
                                  PreTag="div"
                                  language={language || 'text'}
                                  style={vscDarkPlus as any}
                                >
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              )
                            }
                          }}
                        >
                          {bubble.text}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                ))}
                {selectedComposer && (selectedComposer.conversation || []).map((message) => (
                  <div
                    key={message.bubbleId}
                    className={`p-4 rounded-lg border ${
                      message.type === 1 ? 'bg-muted/50 dark:bg-muted/10' : 'bg-background'
                    }`}
                  >
                    <div className="font-semibold mb-3 text-foreground">
                      {message.type === 1 ? 'User' : 'AI'}
                    </div>
                    {message.text && (
                      <div className="rounded-lg overflow-hidden">
                        <ReactMarkdown
                          className="prose dark:prose-invert max-w-none"
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({inline, className, children, ...props}: any) {
                              const match = /language-(\w+)/.exec(className || '')
                              const language = match ? match[1] : null

                              if (inline) {
                                return <code className={className}>{children}</code>
                              }

                              return (
                                <SyntaxHighlighter
                                  PreTag="div"
                                  language={language || 'text'}
                                  style={vscDarkPlus as any}
                                >
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              )
                            }
                          }}
                        >
                          {message.text}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <div className="text-center text-muted-foreground mt-8">
              Select a log to view the conversation
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
