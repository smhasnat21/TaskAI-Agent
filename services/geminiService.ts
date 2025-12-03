import { GoogleGenAI, FunctionDeclaration, Type, Tool } from "@google/genai";

// 1. Initialize Gemini
// NOTE: In a real production app, you might want to proxy these requests 
// through a backend to hide the API KEY, but for this demo/prototype, we use the env var directly.
export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// 2. Define the Model
export const MODEL_NAME = "gemini-2.5-flash";

// 3. Define Tool Schemas (Function Declarations)

const addTaskDeclaration: FunctionDeclaration = {
  name: "addTask",
  description: "Add a new top-level task to the to-do list. Infer priority (low, medium, high) if mentioned, default to medium.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "The content of the task (e.g., 'Buy groceries')",
      },
      priority: {
        type: Type.STRING,
        enum: ["low", "medium", "high"],
        description: "The priority level of the task.",
      },
    },
    required: ["title"],
  },
};

const addSubtaskDeclaration: FunctionDeclaration = {
  name: "addSubtask",
  description: "Add a subtask to an existing task. Identify the parent task by its title.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      parentQuery: {
        type: Type.STRING,
        description: "The title (or part of the title) of the parent task to attach this subtask to.",
      },
      title: {
        type: Type.STRING,
        description: "The content of the subtask.",
      },
      priority: {
        type: Type.STRING,
        enum: ["low", "medium", "high"],
        description: "The priority level of the subtask.",
      },
    },
    required: ["parentQuery", "title"],
  },
};

const removeTaskDeclaration: FunctionDeclaration = {
  name: "removeTask",
  description: "Remove a task (or subtask) by providing its exact ID or a fuzzy search of its title. Prefer ID if known.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskId: {
        type: Type.STRING,
        description: "The unique ID of the task to remove.",
      },
      searchTitle: {
        type: Type.STRING,
        description: "A string to match against task titles if ID is unknown.",
      },
    },
  },
};

const updateTaskStatusDeclaration: FunctionDeclaration = {
  name: "updateTaskStatus",
  description: "Mark a task (or subtask) as completed or incomplete.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskId: {
        type: Type.STRING,
        description: "The unique ID of the task.",
      },
      completed: {
        type: Type.BOOLEAN,
        description: "True if the task is done, false otherwise.",
      },
    },
    required: ["taskId", "completed"],
  },
};

const getTasksDeclaration: FunctionDeclaration = {
  name: "getTasks",
  description: "Get the current list of all tasks (including subtasks) to inspect their IDs, status, or details.",
  parameters: {
    type: Type.OBJECT,
    properties: {}, // No parameters needed
  },
};

export const taskTools: Tool[] = [
  {
    functionDeclarations: [
      addTaskDeclaration,
      addSubtaskDeclaration,
      removeTaskDeclaration,
      updateTaskStatusDeclaration,
      getTasksDeclaration,
    ],
  },
];

export const SYSTEM_INSTRUCTION = `
You are a highly efficient personal productivity assistant. 
You help the user manage a Task List using the provided tools.

Rules:
1. When the user asks to add a task, call 'addTask'.
2. If the user asks to add a "subtask", "child task", or "step" to a specific task, call 'addSubtask'.
3. When the user asks to delete/remove a task, ask for clarification if it's ambiguous, or call 'removeTask'.
4. When the user asks what is on the list, call 'getTasks' first to see the current state, then summarize it.
5. If you perform an action (add/remove/update), confirm briefly to the user what you did.
6. Be concise and professional but friendly.
`;