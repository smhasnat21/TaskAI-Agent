import React from 'react';
import { Task, Priority } from '../types';
import { CheckCircle2, Circle, Trash2, ArrowDown, ArrowUp, CornerDownRight } from 'lucide-react';

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  level?: number;
}

const PriorityIcon: React.FC<{ priority: Priority }> = ({ priority }) => {
  switch (priority) {
    case Priority.HIGH:
      return <ArrowUp className="w-4 h-4 text-red-500" />;
    case Priority.LOW:
      return <ArrowDown className="w-4 h-4 text-blue-400" />;
    default:
      return <div className="w-4 h-4" />; // Spacer
  }
};

export const TaskItem: React.FC<TaskItemProps> = ({ task, onToggle, onDelete, level = 0 }) => {
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  
  return (
    <div className="flex flex-col w-full">
      <div className={`group flex items-center justify-between p-3 mb-1 bg-white rounded-lg shadow-sm border border-slate-100 hover:border-blue-200 transition-all ${task.isCompleted ? 'opacity-60 bg-slate-50' : ''}`}>
        <div className="flex items-center gap-3 overflow-hidden flex-1">
          {level > 0 && (
            <div className="text-slate-300">
               <CornerDownRight className="w-4 h-4" />
            </div>
          )}
          
          <button
            onClick={() => onToggle(task.id)}
            className="text-slate-400 hover:text-blue-600 transition-colors focus:outline-none flex-shrink-0"
          >
            {task.isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>
          
          <div className="flex flex-col min-w-0">
            <span className={`text-sm font-medium truncate ${task.isCompleted ? 'line-through text-slate-500' : 'text-slate-800'}`}>
              {task.title}
            </span>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <PriorityIcon priority={task.priority} />
              <span className="uppercase tracking-wider text-[10px]">{task.priority}</span>
              {/* Only show ID in debug or if needed, keeping UI clean */}
            </div>
          </div>
        </div>

        <button
          onClick={() => onDelete(task.id)}
          className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all flex-shrink-0"
          aria-label="Delete task"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Recursive Rendering of Subtasks */}
      {hasSubtasks && (
        <div className={`flex flex-col ${level === 0 ? 'ml-6 border-l-2 border-slate-100 pl-2 mb-2' : 'ml-4'}`}>
          {task.subtasks!.map(subtask => (
            <TaskItem 
              key={subtask.id} 
              task={subtask} 
              onToggle={onToggle} 
              onDelete={onDelete} 
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};