import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chat } from "@google/genai";
import { ai, MODEL_NAME, SYSTEM_INSTRUCTION, taskTools } from './services/geminiService';
import { Task, Priority, ChatMessage, Sender, generateId } from './types';
import { TaskItem } from './components/TaskItem';
import { ChatBubble } from './components/ChatBubble';
import { Send, Sparkles, ListTodo, Bot } from 'lucide-react';

// --- Recursive Helpers for State Management ---

// Deep clone is often safest for complex nested state updates, 
// though we can use map/filter for immutability.

const toggleTaskRecursive = (tasks: Task[], id: string): Task[] => {
  return tasks.map(task => {
    if (task.id === id) {
      return { ...task, isCompleted: !task.isCompleted };
    }
    if (task.subtasks) {
      return { ...task, subtasks: toggleTaskRecursive(task.subtasks, id) };
    }
    return task;
  });
};

const deleteTaskRecursive = (tasks: Task[], id: string): Task[] => {
  return tasks
    .filter(task => task.id !== id)
    .map(task => ({
      ...task,
      subtasks: task.subtasks ? deleteTaskRecursive(task.subtasks, id) : undefined
    }));
};

const addSubtaskRecursive = (tasks: Task[], parentQuery: string, newSubtask: Task): { updatedTasks: Task[], success: boolean } => {
  let added = false;
  
  const updateInfo = (list: Task[]): Task[] => {
    return list.map(task => {
      // Check exact ID match or fuzzy Title match
      const isMatch = task.id === parentQuery || task.title.toLowerCase().includes(parentQuery.toLowerCase());
      
      if (isMatch && !added) { // Only add to the first distinct match
        added = true;
        return {
          ...task,
          subtasks: task.subtasks ? [...task.subtasks, newSubtask] : [newSubtask]
        };
      }
      
      // Try children
      if (task.subtasks) {
        return { ...task, subtasks: updateInfo(task.subtasks) };
      }
      return task;
    });
  };

  const updatedTasks = updateInfo(tasks);
  return { updatedTasks, success: added };
};

const findAndRemoveRecursive = (tasks: Task[], taskId?: string, searchTitle?: string): { updatedTasks: Task[], removedCount: number } => {
  let count = 0;
  
  const filterList = (list: Task[]): Task[] => {
    return list.reduce((acc: Task[], task) => {
      const matchId = taskId && task.id === taskId;
      const matchTitle = searchTitle && task.title.toLowerCase().includes(searchTitle.toLowerCase());
      
      if (matchId || matchTitle) {
        count++;
        return acc; // Skip adding this task (delete it)
      }
      
      // Process children
      const updatedTask = { ...task };
      if (task.subtasks) {
        updatedTask.subtasks = filterList(task.subtasks);
      }
      
      acc.push(updatedTask);
      return acc;
    }, []);
  };

  const updatedTasks = filterList(tasks);
  return { updatedTasks, removedCount: count };
};

const updateStatusRecursive = (tasks: Task[], taskId: string, completed: boolean): { updatedTasks: Task[], found: boolean } => {
  let found = false;
  
  const updateList = (list: Task[]): Task[] => {
    return list.map(task => {
      if (task.id === taskId) {
        found = true;
        return { ...task, isCompleted: completed };
      }
      if (task.subtasks) {
        return { ...task, subtasks: updateList(task.subtasks) };
      }
      return task;
    });
  };

  const updatedTasks = updateList(tasks);
  return { updatedTasks, found };
};

export default function App() {
  // --- State ---
  const [tasks, setTasks] = useState<Task[]>(() => {
    // Initial state with a few dummy tasks or load from local storage
    const saved = localStorage.getItem('taskai_tasks');
    if (saved) return JSON.parse(saved);
    
    // Default initial data with a subtask example
    return [
      { 
        id: generateId(), 
        title: "Review project requirements", 
        isCompleted: false, 
        priority: Priority.HIGH, 
        createdAt: Date.now(),
        subtasks: [
           { id: generateId(), title: "Check email specs", isCompleted: false, priority: Priority.MEDIUM, createdAt: Date.now() }
        ]
      },
      { id: generateId(), title: "Buy coffee beans", isCompleted: true, priority: Priority.LOW, createdAt: Date.now() },
    ];
  });
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: generateId(),
      text: "Hello! I'm your Task AI. I can help you manage your tasks. Try saying 'Add a subtask to Review project requirements called Read documentation'.",
      sender: Sender.AI,
      timestamp: Date.now(),
    }
  ]);
  
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Effects ---
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('taskai_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    if (!chatSessionRef.current) {
      chatSessionRef.current = ai.chats.create({
        model: MODEL_NAME,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: taskTools,
        },
      });
    }
  }, []);

  // --- Tool Execution Logic ---

  const executeAddTask = useCallback((args: any) => {
    const { title, priority } = args;
    const newTask: Task = {
      id: generateId(),
      title,
      priority: (priority as Priority) || Priority.MEDIUM,
      isCompleted: false,
      createdAt: Date.now(),
      subtasks: []
    };
    setTasks(prev => [newTask, ...prev]);
    return { result: `Task added successfully with ID: ${newTask.id}` };
  }, []);

  const executeAddSubtask = useCallback((args: any) => {
    const { parentQuery, title, priority } = args;
    const newSubtask: Task = {
      id: generateId(),
      title,
      priority: (priority as Priority) || Priority.MEDIUM,
      isCompleted: false,
      createdAt: Date.now(),
      subtasks: []
    };

    let success = false;
    setTasks(prev => {
      const result = addSubtaskRecursive(prev, parentQuery, newSubtask);
      success = result.success;
      return result.updatedTasks;
    });

    if (success) return { result: `Subtask '${title}' added to parent matching '${parentQuery}'.` };
    return { result: `Could not find a parent task matching '${parentQuery}' to add the subtask to.` };
  }, []);

  const executeRemoveTask = useCallback((args: any) => {
    const { taskId, searchTitle } = args;
    let removedCount = 0;
    
    setTasks(prev => {
      const result = findAndRemoveRecursive(prev, taskId, searchTitle);
      removedCount = result.removedCount;
      return result.updatedTasks;
    });

    if (removedCount > 0) return { result: `Successfully removed ${removedCount} task(s).` };
    return { result: "No tasks found matching that criteria." };
  }, []);

  const executeUpdateTaskStatus = useCallback((args: any) => {
    const { taskId, completed } = args;
    let found = false;
    
    setTasks(prev => {
      const result = updateStatusRecursive(prev, taskId, completed);
      found = result.found;
      return result.updatedTasks;
    });

    if (found) return { result: `Task ${taskId} marked as ${completed ? 'completed' : 'incomplete'}.` };
    return { result: `Task with ID ${taskId} not found.` };
  }, []);

  const executeGetTasks = (currentTasks: Task[]) => {
    // Recursive extraction for the AI to see the full tree
    const simplify = (list: Task[]): any[] => list.map(t => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      completed: t.isCompleted,
      subtasks: t.subtasks ? simplify(t.subtasks) : []
    }));

    return { tasks: simplify(currentTasks) };
  };

  // --- Main Chat Handler ---

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !chatSessionRef.current || isLoading) return;

    const userText = input;
    setInput("");
    setIsLoading(true);

    setMessages(prev => [...prev, {
      id: generateId(),
      text: userText,
      sender: Sender.USER,
      timestamp: Date.now()
    }]);

    try {
      let result = await chatSessionRef.current.sendMessage({ message: userText });
      
      const functionCalls = result.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        const responseParts = [];

        for (const call of functionCalls) {
          const { name, args } = call;
          let toolResult: any = { error: "Unknown tool" };

          setMessages(prev => [...prev, {
            id: generateId(),
            text: `Executing: ${name}...`,
            sender: Sender.SYSTEM,
            timestamp: Date.now()
          }]);

          if (name === 'addTask') {
            toolResult = executeAddTask(args);
          } else if (name === 'addSubtask') {
            toolResult = executeAddSubtask(args);
          } else if (name === 'removeTask') {
            toolResult = executeRemoveTask(args);
          } else if (name === 'updateTaskStatus') {
            toolResult = executeUpdateTaskStatus(args);
          } else if (name === 'getTasks') {
            toolResult = executeGetTasks(tasks); 
          }

          responseParts.push({
            functionResponse: {
              name: call.name,
              response: { result: toolResult },
              id: call.id
            }
          });
        }

        // Send tool responses back to the model
        result = await chatSessionRef.current.sendMessage(responseParts);
      }

      const aiText = result.text;
      setMessages(prev => [...prev, {
        id: generateId(),
        text: aiText,
        sender: Sender.AI,
        timestamp: Date.now()
      }]);

    } catch (error) {
      console.error("Gemini Error:", error);
      setMessages(prev => [...prev, {
        id: generateId(),
        text: "Sorry, I encountered an error processing that request. Please try again.",
        sender: Sender.AI,
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handlers for manual UI interactions ---
  const toggleTask = (id: string) => {
    setTasks(prev => toggleTaskRecursive(prev, id));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => deleteTaskRecursive(prev, id));
  };

  // --- Render ---

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      
      {/* Left Sidebar: Task List */}
      <div className="w-full md:w-1/3 lg:w-[400px] flex flex-col border-r border-slate-200 bg-white h-full shadow-xl z-10">
        <div className="p-6 border-b border-slate-100 bg-white sticky top-0 z-20">
          <div className="flex items-center gap-2 mb-1 text-indigo-600">
            <ListTodo className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">TaskAI</h1>
          </div>
          <p className="text-slate-500 text-sm">
            {/* Simple count of total tasks including subtasks for now is okay, or just top level */}
            Dashboard
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-center p-6 border-2 border-dashed border-slate-100 rounded-lg mt-4">
              <Sparkles className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No tasks yet.</p>
              <p className="text-xs mt-1">Ask the AI to add one!</p>
            </div>
          ) : (
            tasks
              .sort((a, b) => b.createdAt - a.createdAt)
              .sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted))
              .map(task => (
                <TaskItem 
                  key={task.id} 
                  task={task} 
                  onToggle={toggleTask} 
                  onDelete={deleteTask} 
                />
              ))
          )}
        </div>
        
        <div className="p-4 border-t border-slate-100 bg-slate-50 text-center">
          <p className="text-xs text-slate-400">Pro tip: Try "Add subtask to [Task] called [Step]"</p>
        </div>
      </div>

      {/* Right Content: Chat Interface */}
      <div className="hidden md:flex flex-1 flex-col h-full bg-slate-50 relative">
        {/* Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            AI Assistant
          </h2>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}
            
            {isLoading && (
              <div className="flex gap-3 mb-4">
                 <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                 </div>
                 <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm">
                   <div className="flex gap-1.5 pt-1">
                     <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                     <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></div>
                     <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></div>
                   </div>
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-6 pt-2 bg-gradient-to-t from-slate-50 to-transparent">
          <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <form onSubmit={handleSendMessage} className="flex items-center p-2 pl-4">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a command... (e.g., 'Add subtask to Review Report: Verify data')"
                className="flex-1 py-3 bg-transparent focus:outline-none text-slate-700 placeholder-slate-400"
                disabled={isLoading}
              />
              <button 
                type="submit" 
                disabled={isLoading || !input.trim()}
                className={`p-3 rounded-xl transition-all ${
                  input.trim() 
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md' 
                    : 'bg-slate-100 text-slate-300'
                }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
          <p className="text-center text-xs text-slate-400 mt-3">
            Powered by Gemini 2.5 • capable of managing your list autonomously.
          </p>
        </div>
      </div>
    </div>
  );
}