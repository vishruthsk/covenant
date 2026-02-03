import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

declare global {
    interface Window {
        ethereum?: any;
    }
}

export function useWeb3() {
    const [account, setAccount] = useState<string | null>(null);
    const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
    const [provider, setProvider] = useState<ethers.BrowserProvider | ethers.JsonRpcProvider | null>(null);
    const [chainId, setChainId] = useState<number | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    // Initialize
    useEffect(() => {
        const init = async () => {
            if (window.ethereum) {
                const p = new ethers.BrowserProvider(window.ethereum);
                setProvider(p);
                p.getNetwork().then(n => setChainId(Number(n.chainId))).catch(() => { });

                // Listeners
                window.ethereum.on('accountsChanged', (accounts: string[]) => {
                    if (accounts.length > 0) {
                        setAccount(accounts[0]);
                        p.getSigner().then(setSigner);
                    } else {
                        setAccount(null);
                        setSigner(null);
                    }
                });
                window.ethereum.on('chainChanged', () => window.location.reload());
            } else {
                // Fallback to local node
                try {
                    const p = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
                    await p.getNetwork(); // check connection
                    setProvider(p);
                    setChainId(31337);
                } catch (e) {
                    console.log("No local node found");
                }
            }
        };
        init();
    }, []);

    const connect = useCallback(async () => {
        if (!window.ethereum) {
            window.open('https://metamask.io/download/', '_blank');
            return;
        }

        try {
            setIsConnecting(true);
            const p = new ethers.BrowserProvider(window.ethereum);
            const s = await p.getSigner();

            const addr = await s.getAddress();
            const network = await p.getNetwork();

            setProvider(p);
            setSigner(s);
            setAccount(addr);
            setChainId(Number(network.chainId));
        } catch (e) {
            console.error(e);
        } finally {
            setIsConnecting(false);
        }
    }, []);

    return { account, signer, provider, chainId, connect, isConnecting };
}
