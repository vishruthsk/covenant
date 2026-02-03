import type { Task } from '../types';
import { cn, shortenAddress } from '../lib/utils';
import { Clock, Shield, User, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function TaskCard({ task }: { task: Task }) {
    const statusConfig = {
        0: { label: 'Created', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
        1: { label: 'Accepted', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
        2: { label: 'Submitted', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
        3: { label: 'Verified', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
        4: { label: 'Resolved', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    }[task.status] || { label: 'Unknown', color: 'bg-slate-800 text-slate-500' };

    return (
        <div className="group bg-surface border border-border rounded-xl p-5 hover:border-slate-600 transition-all cursor-pointer">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-500">#{task.id}</span>
                    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium border", statusConfig.color)}>
                        {statusConfig.label}
                    </span>
                </div>
                <div className="flex items-center text-xs text-slate-500 gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(task.timestamp * 1000, { addSuffix: true })}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <div className="text-xs text-slate-500 mb-1">Escrow</div>
                    <div className="text-sm font-mono text-slate-200">{task.escrowAmount} ETH</div>
                </div>
                <div className="text-right">
                    <div className="text-xs text-slate-500 mb-1">Data Hash</div>
                    <div className="text-sm font-mono text-slate-400 truncate max-w-[120px] ml-auto">
                        {task.taskData.slice(0, 10)}...
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="flex items-center gap-1.5 text-slate-400">
                        <User className="w-3 h-3" />
                        {shortenAddress(task.executor) || 'No Executor'}
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                        <Shield className="w-3 h-3" />
                        {shortenAddress(task.verifier)}
                    </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-primary transition-colors" />
            </div>
        </div>
    );
}
