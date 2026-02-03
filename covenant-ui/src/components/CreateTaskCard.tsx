import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useCovenant } from '../hooks/useCovenant';

export function CreateTaskCard() {
    const [taskData, setTaskData] = useState('');
    const [amount, setAmount] = useState('0.01');
    const [verifier, setVerifier] = useState('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
    const [isLoading, setIsLoading] = useState(false);

    const { createTask } = useCovenant();

    const handleCreate = async () => {
        if (!taskData || !amount) return;
        setIsLoading(true);
        try {
            await createTask(taskData, amount, verifier);
            setTaskData('');
        } catch (e: any) {
            console.error(e);
            alert(e.message || "Failed to create task");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-200">Create New Task</h2>
                <div className="text-xs text-slate-500 font-mono">
                    Min Bond: 1%
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                        Task Data (String or Hex)
                    </label>
                    <input
                        type="text"
                        value={taskData}
                        onChange={(e) => setTaskData(e.target.value)}
                        placeholder="e.g. process_image_id_123 or 0x..."
                        className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-mono placeholder:text-slate-700"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                        Verifier Address
                    </label>
                    <input
                        type="text"
                        value={verifier}
                        onChange={(e) => setVerifier(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-mono placeholder:text-slate-700"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                            Escrow Amount (ETH)
                        </label>
                        <input
                            type="number"
                            step="0.001"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-mono"
                        />
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={handleCreate}
                            disabled={isLoading || !taskData}
                            className={cn(
                                "w-full h-[46px] flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all",
                                "bg-primary text-white shadow-lg shadow-primary/20",
                                "hover:bg-primary-hover active:scale-[0.98]",
                                "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                            )}
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    Create Task
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
