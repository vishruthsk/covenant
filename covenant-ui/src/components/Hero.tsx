import { Activity, Radio } from 'lucide-react';
import { useWeb3Context } from '../contexts/Web3Context';
import { CONTRACT_ADDRESS } from '../constants';
import { shortenAddress } from '../lib/utils';

export function Hero() {
    const { chainId } = useWeb3Context();

    return (
        <div className="mb-10 text-center relative py-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-6 animate-pulse-slow">
                <Radio className="w-3 h-3" />
                LIVE ON {chainId === 31337 ? 'LOCALHOST' : chainId ? `CHAIN ${chainId}` : 'NETWORK'}
            </div>

            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
                Autonomous Tasks with <span className="text-primary">Consequences</span>
            </h2>

            <p className="text-slate-400 max-w-lg mx-auto text-lg mb-8">
                Create tasks, stake escrow, and let autonomous agents execute with cryptographic accountability.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-slate-500">
                <div className="flex items-center gap-2 px-4 py-2 bg-surface rounded-lg border border-border">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    System Operational
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-surface rounded-lg border border-border">
                    <Activity className="w-3 h-3 text-slate-400" />
                    Contract: {shortenAddress(CONTRACT_ADDRESS)}
                </div>
            </div>
        </div>
    );
}
