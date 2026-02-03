import { Wallet, Loader2 } from 'lucide-react';
import { cn, shortenAddress } from '../lib/utils';
import { useWeb3Context } from '../contexts/Web3Context';

export function Header() {
    const { account, connect, isConnecting } = useWeb3Context();

    return (
        <header className="border-b border-border bg-background/50 backdrop-blur-md sticky top-0 z-50">
            <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-baseline gap-3">
                    <h1 className="text-xl font-bold tracking-tight text-slate-100">COVENANT</h1>
                    <span className="text-xs text-slate-500 font-medium hidden sm:inline-block">
                        Autonomous Execution Protocol
                    </span>
                </div>

                <button
                    onClick={!account ? connect : undefined}
                    disabled={isConnecting}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                        "bg-surface border border-border text-slate-300",
                        !account && "hover:text-white hover:border-slate-600 hover:bg-slate-800",
                        account && "cursor-default border-primary/20 text-primary bg-primary/5"
                    )}
                >
                    {isConnecting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Wallet className="w-4 h-4" />
                    )}
                    {account ? shortenAddress(account) : "Connect Wallet"}
                </button>
            </div>
        </header>
    );
}
