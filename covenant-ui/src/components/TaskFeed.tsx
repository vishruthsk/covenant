import { TaskCard } from './TaskCard';
import { useCovenant } from '../hooks/useCovenant';
import { Loader2 } from 'lucide-react';

export function TaskFeed() {
    const { tasks, isLoading } = useCovenant();

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                    Recent Activity
                </h3>
                <span className="text-xs text-slate-500 font-mono flex items-center gap-2">
                    {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                    Live Feed
                </span>
            </div>

            <div className="space-y-3">
                {tasks.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-border rounded-xl">
                        No tasks found. Create one to get started.
                    </div>
                ) : (
                    tasks.map((task) => (
                        <TaskCard key={task.id} task={task} />
                    ))
                )}
            </div>
        </div>
    );
}
